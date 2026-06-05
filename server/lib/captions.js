import fs from "node:fs/promises";
import { DEEPGRAM_API_KEY, DEEPGRAM_MODEL } from "./config.js";

const EMPTY_INTEL = { summary: "", topics: [], entities: [], sentiment: "" };

/**
 * Word-level captions (@remotion/captions format) + Deepgram "intelligence":
 *   captions:  { text, startMs, endMs, timestampMs, confidence }
 *   intelligence: { summary, topics[], entities[{label,value}], sentiment }
 *
 * Primary: Deepgram (hosted STT, mp3 direct). Fallback: estimate timing from
 * the known script so captions always exist.
 */
export async function generateCaptions({ audioPath, script, durationSeconds, log }) {
  if (DEEPGRAM_API_KEY) {
    try {
      const out = await deepgram({ audioPath, log });
      if (out.captions.length) return { ...out, method: "deepgram" };
      log?.("Deepgram returned no words; estimating caption timing");
    } catch (e) {
      log?.(`Deepgram unavailable (${e.message}); estimating caption timing`);
    }
  } else {
    log?.("No DEEPGRAM_API_KEY set; estimating caption timing");
  }
  return { captions: estimateCaptions(script, durationSeconds), intelligence: EMPTY_INTEL, method: "estimated" };
}

async function callDeepgram(audio, withIntelligence) {
  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    smart_format: "true",
    punctuate: "true",
  });
  if (withIntelligence) {
    params.set("language", "en");
    params.set("summarize", "v2");
    params.set("topics", "true");
    params.set("sentiment", "true");
    params.set("detect_entities", "true");
  }
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, "Content-Type": "audio/mpeg" },
    body: audio,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status} ${body.slice(0, 140)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function deepgram({ audioPath, log }) {
  log?.("transcribing audio with Deepgram (+ intelligence)…");
  const audio = await fs.readFile(audioPath);

  let data;
  try {
    data = await callDeepgram(audio, true);
  } catch (e) {
    // An unsupported intelligence add-on shouldn't cost us the captions.
    log?.(`Deepgram intelligence call failed (${e.message}); retrying transcription only`);
    data = await callDeepgram(audio, false);
  }

  const results = data?.results ?? {};
  const alt = results?.channels?.[0]?.alternatives?.[0] ?? {};
  const words = alt.words ?? [];

  const captions = words.map((w, i) => {
    const text = w.punctuated_word || w.word || "";
    const startMs = Math.round((w.start ?? 0) * 1000);
    const endMs = Math.round((w.end ?? 0) * 1000);
    return {
      text: (i === 0 ? "" : " ") + text,
      startMs,
      endMs,
      timestampMs: Math.round((startMs + endMs) / 2),
      confidence: w.confidence ?? null,
    };
  });

  return { captions, intelligence: extractIntelligence(results, alt) };
}

function extractIntelligence(results, alt) {
  const summary = results?.summary?.short || "";

  const topics = [];
  for (const group of alt.topics ?? []) {
    for (const t of group.topics ?? []) {
      if (t.topic && !topics.includes(t.topic)) topics.push(t.topic);
    }
  }

  const entities = [];
  const seen = new Set();
  const NUMERIC_LABELS = /^(date|time|cardinal|ordinal|quantity|duration|money|percent|number|age)$/i;
  const NUMERIC_VALUE = /^[\$€£¥]?\s?[\d,.\s]+\s?(%|percent|million|billion|trillion|dollars?|euros?)?$/i;
  for (const e of alt.entities ?? []) {
    const value = (e.value || "").trim();
    const label = e.label || "";
    const key = `${label}:${value.toLowerCase()}`;
    // Keep the "who/what" players — drop pure dates / numbers / money / percentages.
    if (!value || value.length < 2 || NUMERIC_LABELS.test(label) || NUMERIC_VALUE.test(value)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push({ label, value });
  }

  // Dominant sentiment across segments.
  const counts = {};
  for (const seg of alt.sentiments?.segments ?? []) {
    if (seg.sentiment) counts[seg.sentiment] = (counts[seg.sentiment] || 0) + 1;
  }
  const sentiment = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  return { summary, topics, entities, sentiment };
}

const SENTENCE_END = /[.!?]$/;

function estimateCaptions(script, durationSeconds) {
  const words = (script || "").split(/\s+/).filter(Boolean);
  if (!words.length || !durationSeconds) return [];
  const weights = words.map((w) => w.length + 1 + (SENTENCE_END.test(w) ? 6 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const msTotal = durationSeconds * 1000;
  const caps = [];
  let cursor = 0;
  for (let i = 0; i < words.length; i++) {
    const dur = (weights[i] / total) * msTotal;
    const startMs = Math.round(cursor);
    const endMs = Math.round(cursor + dur);
    caps.push({
      text: (i === 0 ? "" : " ") + words[i],
      startMs,
      endMs,
      timestampMs: Math.round((startMs + endMs) / 2),
      confidence: null,
    });
    cursor += dur;
  }
  return caps;
}
