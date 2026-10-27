import crypto from "node:crypto";
import express from "express";
import { installAuth, equalSecret } from "./lib/auth.js";
import { validateJob, validateSchedule, invalid } from "./lib/validation.js";

export function createApp({ config, runPipeline, VOICES, uploadConfigured, Scheduler, addBriefing, listBriefings, removeBriefing }) {
  const app = express();
  const { accessToken, allowedOrigins, secureCookie, renderToken, outputDir, rendersDir, publishingEnabled, defaultTimezone, maxConcurrentJobs = 2 } = config;
  app.use(express.json({ limit: "16kb" }));
  // Per-job render assets (audio) served over HTTP so the Remotion render fetches them
  // live — avoids the stale bundled-public-dir problem across cached bundles.
  app.use("/renders", (req, res, next) => {
    if (!equalSecret(req.query.token, renderToken)) return res.status(401).end();
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Referrer-Policy", "no-referrer");
    next();
  }, express.static(rendersDir));
  const requireAuth = installAuth(app, { accessToken, allowedOrigins, secureCookie });
  app.use("/output", requireAuth, express.static(outputDir));
  const on = (method, path, handler) => app[method](path, (req, res, next) => {
    Promise.resolve().then(() => handler(req, res)).catch(next);
  });
  let activeJobs = 0;

  /** In-memory job registry. Each job buffers its event log so late SSE clients catch up. */
  const jobs = new Map();

  function emitter(job) {
    return (type, message, extra = {}) => {
      const event = { type, message, ...extra, t: Date.now() };
      job.events.push(event);
      for (const res of job.clients) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
  }

  function startJob(input) {
    const { location, topics, voice, tone, durationSeconds, autoUpload, platforms } = validateJob(input);
    const { scheduledPublishMs } = input;
    if (autoUpload && !publishingEnabled) throw invalid("Publishing is disabled by the server operator", 403);
    if (activeJobs >= maxConcurrentJobs) throw invalid("Generation is busy. Try again later.", 429);
    for (const [key, value] of jobs) if (jobs.size >= 100 && value.done) jobs.delete(key);
    activeJobs++;
    const id = crypto.randomUUID().slice(0, 8);
    const job = { id, events: [], clients: new Set(), done: false, result: null, error: null };
    jobs.set(id, job);
    const emit = emitter(job);
    const dur = Math.max(20, Math.min(180, Number(durationSeconds) || 45));

    const promise = Promise.resolve().then(() => runPipeline({ id, location, topics, voice, tone, durationSeconds: dur, autoUpload, platforms, scheduledPublishMs, emit }))
      .then((result) => {
        job.done = true;
        job.result = result;
        // Save to the briefing library (survives restarts).
        addBriefing({ ...result, location, topics, createdAt: new Date().toISOString() }).catch((e) =>
          console.error("history save failed:", e.message),
        );
        return result;
      })
      .catch((err) => {
        console.error(`[job ${id}]`, err);
        job.done = true;
        job.error = err.message || String(err);
        emit("error", job.error);
        throw err;
      })
      .finally(() => {
        activeJobs--;
        for (const res of job.clients) res.end();
      });

    // Mark failures handled even when the HTTP caller only consumes the job ID.
    // Keep the original rejecting promise so scheduled callers still see failures.
    promise.catch(() => {});
    return { id, job, promise };
  }

  // ── Scheduler: scheduled runs reuse the exact same pipeline ──
  const scheduler = new Scheduler(async ({ spec, scheduledPublishMs }) => {
    const { promise } = startJob({
      location: spec.location,
      topics: spec.topics,
      voice: spec.voice,
      tone: spec.tone,
      durationSeconds: spec.durationSeconds,
      autoUpload: spec.autoUpload,
      platforms: spec.platforms,
      scheduledPublishMs,
    });
    return promise;
  });

  on("get", "/api/health", (_req, res) => res.json({ ok: true }));
  on("get", "/api/voices", (_req, res) => res.json({ voices: VOICES }));
  on("get", "/api/config", (_req, res) =>
    res.json({ uploadConfigured: publishingEnabled && uploadConfigured(), platforms: ["tiktok", "instagram", "youtube", "facebook", "x", "linkedin", "threads"] }),
  );

  on("post", "/api/jobs", (req, res) => {
    const { id } = startJob(req.body);
    res.json({ jobId: id });
  });

  on("get", "/api/jobs/:id/events", (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).end();
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(`retry: 3000\n\n`);
    for (const event of job.events) res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (job.done) return res.end();
    job.clients.add(res);
    req.on("close", () => job.clients.delete(res));
  });

  on("get", "/api/jobs/:id", (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "not found" });
    res.json({ id: job.id, done: job.done, result: job.result, error: job.error });
  });

  // ── Briefing library (history) ──
  on("get", "/api/briefings", async (_req, res) => res.json({ briefings: await listBriefings() }));

  on("delete", "/api/briefings/:id", async (req, res) => {
    const ok = await removeBriefing(req.params.id);
    res.status(ok ? 200 : 404).json({ ok });
  });

  // ── Schedules (cron automation) ──
  on("get", "/api/schedules", (_req, res) => res.json({ schedules: scheduler.list() }));

  on("post", "/api/schedules", async (req, res) => {
    try {
      const input = validateSchedule(req.body, defaultTimezone);
      if (input.autoUpload && !publishingEnabled) throw invalid("Publishing is disabled by the server operator", 403);
      const spec = await scheduler.create(input);
      res.json({ schedule: spec });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message });
    }
  });

  on("patch", "/api/schedules/:id", async (req, res) => {
    const { enabled } = req.body || {};
    if (typeof enabled !== "boolean") throw invalid("enabled must be a boolean");
    const spec = await scheduler.setEnabled(req.params.id, enabled);
    if (!spec) return res.status(404).json({ error: "not found" });
    res.json({ schedule: spec });
  });

  on("delete", "/api/schedules/:id", async (req, res) => {
    const ok = await scheduler.remove(req.params.id);
    res.status(ok ? 200 : 404).json({ ok });
  });

  on("post", "/api/schedules/:id/run", async (req, res) => {
    const spec = scheduler.get(req.params.id);
    if (!spec) return res.status(404).json({ error: "not found" });
    scheduler.fire(spec.id).catch(e => console.error("Schedule failed:", e.message));
    res.json({ ok: true, message: `Running "${spec.name}" now` });
  });

  app.use((err, _req, res, _next) => {
    if (!err.status || err.status >= 500) console.error("Request failed:", err.message);
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.status ? err.message : "Request failed" });
  });
  return { app, scheduler };
}
