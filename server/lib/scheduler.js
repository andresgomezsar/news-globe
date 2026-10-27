import { validateSchedule, validateJob } from "./validation.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import cron from "node-cron";
import { SCHEDULES_FILE, TIMEZONE } from "./config.js";

// Build the cron that represents the *target* (publish) time.
function buildTargetCron(freq, time) {
  const [hRaw, mRaw] = (time || "08:00").split(":");
  const hour = Math.min(23, Math.max(0, parseInt(hRaw, 10) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(mRaw, 10) || 0));
  if (freq === "hourly") return { cron: `${minute} * * * *`, hour: null, minute, dow: "*" };
  if (freq === "weekdays") return { cron: `${minute} ${hour} * * 1-5`, hour, minute, dow: "1-5" };
  return { cron: `${minute} ${hour} * * *`, hour, minute, dow: "*" };
}

// Shift a target time earlier by `lead` minutes so generation finishes by the target.
// Clamped to the same day (won't roll past midnight) to keep the day-of-week stable.
function shiftEarlierCron(hour, minute, dow, lead) {
  const total = Math.max(0, hour * 60 + minute - lead);
  return `${total % 60} ${Math.floor(total / 60)} * * ${dow}`;
}

/**
 * Cron-based automation. Each schedule is a recurring briefing spec:
 *   { id, name, cron, timezone, location, topics, voice, tone, durationSeconds,
 *     autoUpload, platforms, enabled, createdAt, lastRun, lastResult }
 *
 * Schedules persist to schedules.json and re-register on boot. When a schedule
 * fires, it runs `runJob` (injected) — the same pipeline a manual request uses.
 */
export class Scheduler {
  constructor(runJob) {
    this.runJob = runJob; // async ({spec}) => result
    this.schedules = [];
    this.tasks = new Map(); // id -> cron task
  }

  async init() {
    try {
      const raw = await fs.readFile(SCHEDULES_FILE, "utf8");
      this.schedules = JSON.parse(raw);
    } catch {
      this.schedules = [];
    }
    if (!Array.isArray(this.schedules)) this.schedules = [];
    this.schedules = this.schedules.filter(s => {
      try { validateJob(s); return true; }
      catch (e) { console.warn("Skipping invalid stored schedule:", e.message); return false; }
    });
    for (const s of this.schedules) if (s.enabled) {
      try { this.register(s); } catch (e) { console.warn("Invalid stored schedule:", e.message); }
    }
    console.log(`🕒  Scheduler: ${this.schedules.length} schedule(s), ${this.tasks.size} active`);
  }

  async persist() {
    await fs.writeFile(SCHEDULES_FILE, JSON.stringify(this.schedules, null, 2));
  }

  register(spec) {
    if (this.tasks.has(spec.id)) {
      this.tasks.get(spec.id).stop();
      this.tasks.delete(spec.id);
    }
    if (!cron.validate(spec.cron)) {
      console.warn(`Invalid cron for schedule ${spec.id}: ${spec.cron}`);
      return;
    }
    const task = cron.schedule(
      spec.cron,
      () => this.fire(spec.id).catch(e => console.error("Schedule failed:", e.message)),
      { timezone: spec.timezone || TIMEZONE },
    );
    this.tasks.set(spec.id, task);
  }

  async fire(id) {
    const spec = this.schedules.find((s) => s.id === id);
    if (!spec || !spec.enabled) return;
    console.log(`🕒  Schedule "${spec.name}" firing…`);
    spec.lastRun = new Date().toISOString();
    // We fired `leadMinutes` before the target, so (now + lead) ≈ the chosen publish
    // instant — timezone-agnostic because it's an absolute UTC ms value.
    const scheduledPublishMs = spec.publishAtTime ? Date.now() + spec.leadMinutes * 60000 : null;
    try {
      const result = await this.runJob({ spec, scheduledPublishMs });
      spec.lastResult = { ok: true, videoUrl: result?.videoUrl, upload: result?.upload, at: spec.lastRun };
    } catch (e) {
      console.error(`Schedule ${id} failed:`, e.message);
      spec.lastResult = { ok: false, error: e.message, at: spec.lastRun };
    }
    await this.persist();
  }

  async create(input) {
    input = validateSchedule(input, TIMEZONE);

    const freq = input.freq || "daily";
    const time = input.time || "08:00";
    const leadMinutes = Math.max(2, Math.min(60, Number(input.leadMinutes) || 15));
    const autoUpload = Boolean(input.autoUpload);
    const target = buildTargetCron(freq, time);

    // Publish-at-time: fire early to generate, then schedule the post for the target.
    // Only meaningful when we're auto-publishing on a fixed daily/weekday time.
    const publishAtTime = autoUpload && freq !== "hourly";
    const cronExpr = publishAtTime
      ? shiftEarlierCron(target.hour, target.minute, target.dow, leadMinutes)
      : target.cron;

    if (!cron.validate(cronExpr)) throw new Error(`Invalid cron expression: ${cronExpr}`);

    const spec = {
      id: crypto.randomUUID().slice(0, 8),
      name: input.name || `${input.location.name} • ${(input.topics || []).join(", ") || "top stories"}`,
      cron: cronExpr,
      targetCron: target.cron,
      freq,
      targetTime: freq === "hourly" ? null : time,
      leadMinutes,
      publishAtTime,
      timezone: input.timezone || TIMEZONE,
      location: input.location,
      topics: input.topics || [],
      voice: input.voice || "verse",
      tone: input.tone || "sharp and energetic",
      durationSeconds: Math.max(20, Math.min(180, Number(input.durationSeconds) || 45)),
      autoUpload,
      platforms: input.platforms?.length ? input.platforms : ["tiktok"],
      enabled: input.enabled !== false,
      createdAt: new Date().toISOString(),
      lastRun: null,
      lastResult: null,
    };
    this.schedules.push(spec);
    if (spec.enabled) this.register(spec);
    await this.persist();
    return spec;
  }

  async remove(id) {
    const idx = this.schedules.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    this.tasks.get(id)?.stop();
    this.tasks.delete(id);
    this.schedules.splice(idx, 1);
    await this.persist();
    return true;
  }

  async setEnabled(id, enabled) {
    const spec = this.schedules.find((s) => s.id === id);
    if (!spec) return null;
    spec.enabled = enabled;
    if (enabled) this.register(spec);
    else {
      this.tasks.get(id)?.stop();
      this.tasks.delete(id);
    }
    await this.persist();
    return spec;
  }

  list() {
    return this.schedules;
  }

  get(id) {
    return this.schedules.find((s) => s.id === id) || null;
  }
}
