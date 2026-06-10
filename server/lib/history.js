import fs from "node:fs/promises";
import path from "node:path";
import { SERVER_DIR, OUTPUT_DIR, RENDERS_DIR } from "./config.js";

const HISTORY_FILE = path.join(SERVER_DIR, "history.json");
const MAX_ENTRIES = 80;

let briefings = null; // lazy-loaded cache

async function load() {
  if (briefings) return briefings;
  try {
    briefings = JSON.parse(await fs.readFile(HISTORY_FILE, "utf8"));
  } catch {
    briefings = [];
  }
  return briefings;
}

async function persist() {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(briefings, null, 2));
}

// Keep only the fields the library needs — trim the heavy bits to a sane size.
function toRecord(r) {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    location: r.location || null,
    topics: r.topics || [],
    videoUrl: r.videoUrl,
    posterUrl: r.posterUrl || null,
    durationSeconds: r.durationSeconds || null,
    accent: r.accent || "#37e6c9",
    captionMethod: r.captionMethod || "",
    sentiment: r.sentiment || "",
    keyPlayers: (r.keyPlayers || []).slice(0, 8),
    summary: r.summary || "",
    headlines: (r.headlines || []).slice(0, 8),
    cues: (r.cues || []).slice(0, 12),
    script: r.script || "",
    upload: r.upload || null,
    createdAt: r.createdAt || new Date().toISOString(),
  };
}

export async function addBriefing(record) {
  await load();
  briefings.unshift(toRecord(record));
  if (briefings.length > MAX_ENTRIES) briefings = briefings.slice(0, MAX_ENTRIES);
  await persist();
}

export async function listBriefings() {
  return await load();
}

export async function getBriefing(id) {
  await load();
  return briefings.find((b) => b.id === id) || null;
}

export async function removeBriefing(id) {
  await load();
  const idx = briefings.findIndex((b) => b.id === id);
  if (idx < 0) return false;
  briefings.splice(idx, 1);
  await persist();
  // Best-effort cleanup of the rendered files.
  await Promise.allSettled([
    fs.rm(path.join(OUTPUT_DIR, `${id}.mp4`), { force: true }),
    fs.rm(path.join(OUTPUT_DIR, `${id}.jpg`), { force: true }),
    fs.rm(path.join(RENDERS_DIR, id), { recursive: true, force: true }),
  ]);
  return true;
}
