import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../app.js";
import { validateJob, validateSchedule, VOICES } from "../lib/validation.js";

const token = "test-only-operator-token-".repeat(3);
const renderToken = "test-only-render-token-".repeat(3);
const valid = { location: { name: "Tokyo", country: "Japan", lat: 35.68, lng: 139.69 }, topics: ["technology"] };

class MemoryScheduler {
  constructor(run) { this.run = run; this.rows = []; }
  list() { return this.rows; }
  async create(input) { const s = { ...input, id: "schedule", enabled: true }; this.rows.push(s); return s; }
  get(id) { return this.rows.find(s => s.id === id); }
  async setEnabled(id, enabled) { const s = this.get(id); if (s) s.enabled = enabled; return s; }
  async remove(id) { this.rows = this.rows.filter(s => s.id !== id); return true; }
  async fire(id) { return this.run({ spec: this.get(id) }); }
}

async function fixture(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "news-globe-test-"));
  await fs.writeFile(path.join(dir, "sample.mp4"), "sample-video");
  const calls = [];
  const { app, scheduler } = createApp({
    config: { accessToken: token, allowedOrigins: ["http://localhost:5173"], renderToken,
      outputDir: dir, rendersDir: dir, publishingEnabled: options.publishingEnabled || false },
    VOICES, uploadConfigured: () => true, Scheduler: MemoryScheduler,
    runPipeline: async args => {
      calls.push(args);
      if (options.runPipeline) return options.runPipeline(args);
      args.emit("done", "ready");
      return { videoUrl: `/output/${args.id}.mp4` };
    },
    addBriefing: async () => {}, listBriefings: async () => [], removeBriefing: async () => true,
  });
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); await fs.rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, { body, cookie, headers = {}, ...init } = {}) => fetch(base + url, {
    ...init, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const login = await request("/api/session", { method: "POST", body: { token } });
  const cookieHeader = login.headers.get("set-cookie");
  assert.match(cookieHeader, /HttpOnly/i); assert.match(cookieHeader, /SameSite=Strict/i);
  return { request, cookie: cookieHeader.split(";")[0], scheduler, calls };
}

test("all privileged routes and output media require a session", async t => {
  const { request, cookie, calls } = await fixture(t);
  for (const [method, url] of [
    ["GET", "/api/config"], ["GET", "/api/voices"], ["POST", "/api/jobs"],
    ["GET", "/api/jobs/x"], ["GET", "/api/jobs/x/events"], ["GET", "/api/briefings"],
    ["DELETE", "/api/briefings/x"], ["GET", "/api/schedules"], ["POST", "/api/schedules"],
    ["PATCH", "/api/schedules/x"], ["DELETE", "/api/schedules/x"], ["POST", "/api/schedules/x/run"],
    ["GET", "/output/sample.mp4"], ["GET", "/renders/sample.mp4"],
  ]) assert.equal((await request(url, { method })).status, 401, `${method} ${url}`);
  assert.equal(calls.length, 0);
  assert.equal((await request("/api/session", { cookie: "news_globe_session=9999999999999.forged.bad" })).status, 401);
  assert.equal((await request("/api/session", { method: "POST", body: { token: "wrong" } })).status, 401);
  assert.equal((await request("/api/session", { method: "POST", body: { token }, headers: { origin: "https://attacker.invalid" } })).status, 403);
  assert.equal((await request("/api/jobs", { method: "POST", body: valid, cookie, headers: { origin: "null" } })).status, 403);
  assert.equal((await request("/api/health", { cookie })).status, 200);
  const video = await request("/output/sample.mp4", { cookie, headers: { range: "bytes=0-5" } });
  assert.equal(video.status, 206); assert.equal(await video.text(), "sample");
  const asset = await request(`/renders/sample.mp4?token=${renderToken}`, { headers: { origin: "http://localhost:49999" } });
  assert.equal(asset.status, 200); assert.equal(asset.headers.get("access-control-allow-origin"), "*");
  assert.equal((await request("/renders/sample.mp4?token=wrong")).status, 401);
});

test("malformed jobs and schedules never reach the pipeline", async t => {
  const { request, cookie, calls } = await fixture(t);
  const invalidBodies = [null, [], {}, { ...valid, location: { ...valid.location, name: {} } },
    { ...valid, location: { ...valid.location, lat: 91 } }, { ...valid, location: { lat: 1 } },
    ...[{ topics: {} }, { topics: null }, { topics: [4] }, { platforms: "tiktok" }, { voice: {} },
      { tone: [] }, { autoUpload: "false" }, { durationSeconds: 500 }].map(fields => ({ ...valid, ...fields }))];
  for (const body of invalidBodies) for (const url of ["/api/jobs", "/api/schedules"]) {
    assert.equal((await request(url, { method: "POST", body, cookie })).status, 400, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
  assert.equal((await request("/api/health", { cookie })).status, 200);
});

test("publishing requires explicit operator enablement, including stored schedules", async t => {
  const { request, cookie, calls, scheduler } = await fixture(t);
  for (const url of ["/api/jobs", "/api/schedules"]) {
    assert.equal((await request(url, { method: "POST", cookie, body: { ...valid, autoUpload: true } })).status, 403);
  }
  await assert.rejects(scheduler.run({ spec: { ...valid, autoUpload: true } }), /Publishing is disabled/);
  assert.equal(calls.length, 0);
  const enabled = await fixture(t, { publishingEnabled: true });
  assert.equal((await enabled.request("/api/jobs", { method: "POST", cookie: enabled.cookie, body: { ...valid, autoUpload: true } })).status, 200);
  assert.equal(enabled.calls[0].autoUpload, true);
});

test("failed manual jobs are contained, while scheduled failures still reject", async t => {
  let fail = true;
  const { request, cookie, scheduler } = await fixture(t, { runPipeline: async args => {
    if (fail) throw new Error("controlled pipeline failure");
    args.emit("done", "ready"); return { videoUrl: "/output/sample.mp4" };
  } });
  const response = await request("/api/jobs", { method: "POST", cookie, body: valid });
  const { jobId } = await response.json();
  const job = await (await request(`/api/jobs/${jobId}`, { cookie })).json();
  assert.equal(job.done, true); assert.match(job.error, /controlled pipeline failure/);
  const events = await request(`/api/jobs/${jobId}/events`, { cookie });
  assert.match(await events.text(), /controlled pipeline failure/);
  await assert.rejects(scheduler.run({ spec: valid }), /controlled pipeline failure/);
  fail = false;
  const success = await (await request("/api/jobs", { method: "POST", cookie, body: valid })).json();
  assert.match(await (await request(`/api/jobs/${success.jobId}/events`, { cookie })).text(), /ready/);
  assert.equal((await request("/api/health", { cookie })).status, 200);
});

test("legitimate schedules and bounded concurrency remain functional", async t => {
  const resolvers = [];
  const { request, cookie, scheduler } = await fixture(t, { runPipeline: () => new Promise(resolve => resolvers.push(resolve)) });
  t.after(() => resolvers.forEach(resolve => resolve({})));
  const spec = { ...valid, freq: "weekdays", time: "08:00", timezone: "Asia/Tokyo" };
  assert.equal((await request("/api/schedules", { method: "POST", cookie, body: spec })).status, 200);
  assert.equal(scheduler.list()[0].timezone, "Asia/Tokyo");
  assert.equal((await request("/api/schedules/schedule", { method: "PATCH", cookie, body: { enabled: false } })).status, 200);
  assert.equal((await request("/api/schedules/schedule", { method: "PATCH", cookie, body: { enabled: "false" } })).status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await request("/api/jobs", { method: "POST", cookie, body: valid })).status, 200);
  assert.equal((await request("/api/jobs", { method: "POST", cookie, body: valid })).status, 429);
  resolvers.forEach(resolve => resolve({}));
});

test("shared validation covers alternate types and scheduling controls", () => {
  assert.throws(() => validateJob({ ...valid, location: { ...valid.location, lng: Infinity } }));
  assert.throws(() => validateSchedule({ ...valid, time: {} }));
  assert.throws(() => validateSchedule({ ...valid, timezone: "not/a/timezone" }));
  assert.throws(() => validateSchedule({ ...valid, freq: "every second" }));
  assert.equal(validateJob(valid).voice, "verse");
  assert.equal(validateSchedule(valid).time, "08:00");
});
