import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { PORT, OUTPUT_DIR, RENDERS_DIR } from "./lib/config.js";
import { runPipeline } from "./lib/pipeline.js";
import { VOICES } from "./lib/tts.js";
import { uploadConfigured } from "./lib/upload.js";
import { Scheduler } from "./lib/scheduler.js";
import { addBriefing, listBriefings, removeBriefing } from "./lib/history.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/output", express.static(OUTPUT_DIR));
// Per-job render assets (audio) served over HTTP so the Remotion render fetches them
// live — avoids the stale bundled-public-dir problem across cached bundles.
app.use("/renders", express.static(RENDERS_DIR));

/** In-memory job registry. Each job buffers its event log so late SSE clients catch up. */
const jobs = new Map();

function emitter(job) {
  return (type, message, extra = {}) => {
    const event = { type, message, ...extra, t: Date.now() };
    job.events.push(event);
    for (const res of job.clients) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
}

function startJob({ location, topics, voice, tone, durationSeconds, autoUpload, platforms, scheduledPublishMs }) {
  const id = crypto.randomUUID().slice(0, 8);
  const job = { id, events: [], clients: new Set(), done: false, result: null, error: null };
  jobs.set(id, job);
  const emit = emitter(job);
  const dur = Math.max(20, Math.min(180, Number(durationSeconds) || 45));

  const promise = runPipeline({ id, location, topics, voice, tone, durationSeconds: dur, autoUpload, platforms, scheduledPublishMs, emit })
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
      for (const res of job.clients) res.end();
    });

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

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/voices", (_req, res) => res.json({ voices: VOICES }));
app.get("/api/config", (_req, res) =>
  res.json({ uploadConfigured: uploadConfigured(), platforms: ["tiktok", "instagram", "youtube", "facebook", "x", "linkedin", "threads"] }),
);

app.post("/api/jobs", (req, res) => {
  const { location, topics = [], voice = "verse", tone = "", durationSeconds = 45, autoUpload = false, platforms } = req.body || {};
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    return res.status(400).json({ error: "A location with numeric lat/lng is required." });
  }
  const { id } = startJob({ location, topics, voice, tone, durationSeconds, autoUpload, platforms: platforms?.length ? platforms : ["tiktok"] });
  res.json({ jobId: id });
});

app.get("/api/jobs/:id/events", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).end();
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.write(`retry: 3000\n\n`);
  for (const event of job.events) res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (job.done) return res.end();
  job.clients.add(res);
  req.on("close", () => job.clients.delete(res));
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json({ id: job.id, done: job.done, result: job.result, error: job.error });
});

// ── Briefing library (history) ──
app.get("/api/briefings", async (_req, res) => res.json({ briefings: await listBriefings() }));

app.delete("/api/briefings/:id", async (req, res) => {
  const ok = await removeBriefing(req.params.id);
  res.status(ok ? 200 : 404).json({ ok });
});

// ── Schedules (cron automation) ──
app.get("/api/schedules", (_req, res) => res.json({ schedules: scheduler.list() }));

app.post("/api/schedules", async (req, res) => {
  try {
    const spec = await scheduler.create(req.body || {});
    res.json({ schedule: spec });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/schedules/:id", async (req, res) => {
  const { enabled } = req.body || {};
  const spec = await scheduler.setEnabled(req.params.id, Boolean(enabled));
  if (!spec) return res.status(404).json({ error: "not found" });
  res.json({ schedule: spec });
});

app.delete("/api/schedules/:id", async (req, res) => {
  const ok = await scheduler.remove(req.params.id);
  res.status(ok ? 200 : 404).json({ ok });
});

app.post("/api/schedules/:id/run", async (req, res) => {
  const spec = scheduler.get(req.params.id);
  if (!spec) return res.status(404).json({ error: "not found" });
  scheduler.fire(spec.id); // fire-and-forget
  res.json({ ok: true, message: `Running "${spec.name}" now` });
});

await scheduler.init();
app.listen(PORT, () => {
  console.log(`\n🌍  News Globe server → http://localhost:${PORT}\n`);
});
