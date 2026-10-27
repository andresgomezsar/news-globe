import test from "node:test";
import assert from "node:assert/strict";

// No provider methods are called; configuration requires a placeholder for import.
process.env.OPENAI_API_KEY = "test-only-placeholder";
process.env.TIMEZONE = "Europe/London";
const { Scheduler } = await import("../lib/scheduler.js");
const valid = { location: { name: "London", lat: 51.5, lng: -0.12 }, topics: ["world"] };

test("real scheduler preserves defaults, validates input and records job failure", async t => {
  const scheduler = new Scheduler(async () => { throw new Error("controlled scheduled failure"); });
  scheduler.persist = async () => {};
  t.after(() => { for (const task of scheduler.tasks.values()) task.stop(); });
  await assert.rejects(scheduler.create({ ...valid, location: { ...valid.location, name: {} } }), /location name/);
  await assert.rejects(scheduler.create({ ...valid, topics: {} }), /topics/);
  const spec = await scheduler.create({ ...valid, enabled: false });
  assert.equal(spec.timezone, "Europe/London");
  assert.equal(spec.durationSeconds, 45);
  assert.equal(spec.targetTime, "08:00");
  assert.equal(spec.autoUpload, false);
  await scheduler.setEnabled(spec.id, true);
  await scheduler.fire(spec.id);
  assert.equal(spec.lastResult.ok, false);
  assert.match(spec.lastResult.error, /controlled scheduled failure/);
  await scheduler.remove(spec.id);
  assert.equal(scheduler.list().length, 0);
});

test("cron callback handles persistence rejection", async t => {
  const scheduler = new Scheduler(async () => ({}));
  scheduler.persist = async () => {};
  const spec = await scheduler.create(valid);
  const task = scheduler.tasks.get(spec.id);
  t.after(() => task.stop());
  scheduler.persist = async () => { throw new Error("controlled persistence failure"); };
  // node-cron's immediate callback path is the same one used by timer ticks.
  task.now();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(spec.lastResult.ok, true);
});
