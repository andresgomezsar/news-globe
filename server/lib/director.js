import { openai, SCRIPT_MODEL } from "./config.js";

/**
 * The "visual director" agent. After the narration is voiced and captioned, it
 * reads the transcript word timings, sees which stories have a validated photo
 * asset, and plans the on-screen cue timeline: photo cards, pull-quote cards,
 * and stat callouts — each timed to the moment its story is being spoken.
 * Its plan is validated in code (missing assets, overlaps, ungrounded quotes)
 * and it gets one repair round to fix the named problems before we salvage
 * whatever individually passes.
 */

const INTRO_SECONDS = 2.4; // intro card: 72 frames @ 30fps (NewsPodcast/index.tsx)
const MIN_CUE = 2.5;
const MAX_CUE = 6;
const GAP = 0.5;

const STOPWORDS = new Set([
  "this", "that", "with", "from", "have", "will", "their", "after", "over",
  "into", "amid", "says", "said", "more", "than", "what", "when", "where",
  "while", "could", "would", "should", "about", "against", "between", "during",
]);

const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

// ── Deterministic story anchoring ──
// Slide a window over the caption words; the first window holding enough of a
// story's distinctive title terms marks when that story starts being narrated.
export function anchorStories(stories, captions) {
  const words = captions
    .map((c) => ({ w: norm(c.text.trim()), s: c.startMs / 1000 }))
    .filter((x) => x.w);

  return stories.map((story) => {
    const terms = [
      ...new Set(
        (story.title || "")
          .split(/\s+/)
          .map(norm)
          .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
      ),
    ].slice(0, 6);
    if (!terms.length) return null;
    const needed = Math.min(2, terms.length);

    const WINDOW = 14;
    for (let i = 0; i < words.length; i++) {
      const slice = words.slice(i, i + WINDOW);
      const hits = new Set(slice.map((x) => x.w).filter((w) => terms.includes(w)));
      if (hits.size >= needed) {
        const first = slice.find((x) => terms.includes(x.w)) ?? slice[0];
        return Math.round(first.s * 10) / 10;
      }
    }
    return null;
  });
}

// ── Transcript downsampling for the prompt ──
function transcriptLines(captions, wordsPerLine = 12) {
  const lines = [];
  for (let i = 0; i < captions.length; i += wordsPerLine) {
    const chunk = captions.slice(i, i + wordsPerLine);
    const t = (chunk[0].startMs / 1000).toFixed(1);
    lines.push(`[t=${t}s] ${chunk.map((c) => c.text.trim()).join(" ")}`);
  }
  return lines.join("\n");
}

// ── Validation ──
function validateCues(rawCues, { minStart, maxEnd, maxCues, assets, stories }) {
  const assetByStory = new Map(assets.map((a) => [a.storyIndex, a]));
  const errors = [];
  const cues = [];

  const list = Array.isArray(rawCues) ? rawCues.slice(0, maxCues * 2) : [];
  list.forEach((raw, i) => {
    const type = raw?.type;
    if (!["image", "quote", "stat"].includes(type)) {
      errors.push(`cue ${i}: unknown type "${type}"`);
      return;
    }
    const at = Number(raw.atSeconds);
    let dur = Number(raw.durationSeconds);
    if (!Number.isFinite(at) || !Number.isFinite(dur)) {
      errors.push(`cue ${i}: atSeconds/durationSeconds must be numbers`);
      return;
    }
    dur = Math.max(MIN_CUE, Math.min(MAX_CUE, dur));
    if (at < minStart || at + dur > maxEnd) {
      errors.push(`cue ${i}: must fit between ${minStart}s and ${maxEnd}s (got ${at}s–${(at + dur).toFixed(1)}s)`);
      return;
    }

    const storyIndex = Number.isInteger(raw.storyIndex) ? raw.storyIndex : -1;
    const story = stories[storyIndex];
    const cue = { type, atSeconds: at, durationSeconds: dur, storyIndex };

    if (type === "image") {
      const asset = assetByStory.get(storyIndex);
      if (!asset) {
        errors.push(`cue ${i}: story ${storyIndex} has no downloaded image — only HAS_PHOTO stories may get image cues`);
        return;
      }
      // src/credit come from the validated asset record, never from the model.
      cue.src = asset.src;
      cue.credit = asset.credit;
    } else if (type === "quote") {
      const text = String(raw.text || "").trim();
      if (!text || text.length > 140) {
        errors.push(`cue ${i}: quote text must be 1-140 chars`);
        return;
      }
      if (story) {
        const hay = `${(story.talkingPoints || []).join(" ")} ${story.excerpt || ""}`.toLowerCase();
        const sig = text.split(/\s+/).map(norm).filter((w) => w.length >= 4);
        const found = sig.filter((w) => hay.includes(w)).length;
        if (sig.length && found / sig.length < 0.6) {
          errors.push(`cue ${i}: quote not found in story ${storyIndex}'s source material — quotes must be verbatim`);
          return;
        }
      }
      cue.text = text;
      cue.credit = story?.source || "";
    } else {
      const value = String(raw.value || "").trim();
      const text = String(raw.text || "").trim().slice(0, 60);
      if (!value || value.length > 12 || !/\d/.test(value)) {
        errors.push(`cue ${i}: stat value must contain a digit and be at most 12 chars (got "${value}")`);
        return;
      }
      cue.value = value;
      cue.text = text;
      cue.credit = story?.source || "";
    }
    cues.push(cue);
  });

  // Overlap check (after individual validation so indexes in errors stay stable).
  cues.sort((a, b) => a.atSeconds - b.atSeconds);
  for (let i = 0; i + 1 < cues.length; i++) {
    const end = cues[i].atSeconds + cues[i].durationSeconds;
    if (end + GAP - 0.1 > cues[i + 1].atSeconds) {
      errors.push(
        `cues at ${cues[i].atSeconds}s and ${cues[i + 1].atSeconds}s overlap — leave at least ${GAP}s between cues`,
      );
    }
  }

  return { cues: cues.slice(0, maxCues), errors };
}

/** Drop overlapping later cues so a partially-bad plan still yields a clean timeline. */
function salvage(cues) {
  const out = [];
  for (const cue of cues) {
    const prev = out[out.length - 1];
    if (!prev || prev.atSeconds + prev.durationSeconds + GAP - 0.1 <= cue.atSeconds) out.push(cue);
  }
  return out;
}

function buildPrompts({ stories, assets, captions, anchors, captionMethod, minStart, maxEnd, maxCues }) {
  const hasPhoto = new Set(assets.map((a) => a.storyIndex));

  const sys = `You are the visual director for a vertical (1080x1920) broadcast news video. Given the narration transcript with timestamps, the stories being covered, and which stories have a photo available, you plan the on-screen visual cues: photo cards, pull-quote cards, and big-number stat callouts. You are precise about timing — a cue must appear exactly while its story is being narrated. Rules:
1. Cues may only be scheduled between ${minStart}s and ${maxEnd.toFixed(1)}s (an intro card and a closing summary occupy the rest of the video).
2. Cues must never overlap; leave at least ${GAP}s between one ending and the next starting.
3. "image" cues: 3-5 seconds long, ONLY for stories marked HAS_PHOTO, referenced by storyIndex. Show the photo as the story's narration begins.
4. "quote" cues: a short verbatim phrase (max 140 chars) taken word-for-word from a story's POINTS.
5. "stat" cues: one striking number from the stories (like "$3.2B" or "+14%") as "value", with a max-8-word "text" caption explaining it. Never invent numbers.
6. Schedule at most ${maxCues} cues total, prioritizing one image per HAS_PHOTO story.`;

  const storyList = stories
    .map((s, i) => {
      const photo = hasPhoto.has(i) ? "HAS_PHOTO" : "NO_PHOTO";
      const anchor = anchors[i] != null ? ` | first mentioned ~${anchors[i]}s` : "";
      const points = (s.talkingPoints || []).map((p) => `      • ${p}`).join("\n");
      return `[${i}] (${s.source}) ${s.title} | ${photo}${anchor}\n    ANGLE: ${s.angle || "—"}\n    POINTS:\n${points || "      (none)"}`;
    })
    .join("\n");

  const timingNote =
    captionMethod === "estimated"
      ? "\nCAPTION TIMING: estimated — timings are approximate, so make every cue at least 3.5s long and avoid the first and last second of each story's segment."
      : "\nCAPTION TIMING: word-accurate";

  const user = `STORIES
${storyList}
${timingNote}

TRANSCRIPT
${transcriptLines(captions)}

Return JSON:
{ "cues": [ { "type": "image"|"quote"|"stat", "atSeconds": <number>, "durationSeconds": <number>, "storyIndex": <number>, "text": "...", "value": "..." } ] }`;

  return { sys, user };
}

// ── Deterministic fallback (no LLM) ──
function fallbackCues({ assets, anchors, minStart, maxEnd }) {
  const cues = [];
  let nextFree = minStart;
  const spread = (i) => minStart + ((maxEnd - minStart) / Math.max(assets.length, 1)) * i;
  assets.forEach((a, i) => {
    const at = Math.max(nextFree, anchors[a.storyIndex] ?? spread(i), minStart);
    if (at + 4 > maxEnd) return;
    cues.push({ type: "image", atSeconds: at, durationSeconds: 4, storyIndex: a.storyIndex, src: a.src, credit: a.credit });
    nextFree = at + 4 + GAP;
  });
  return cues;
}

/**
 * Plan the cue timeline. Returns { cues, anchors, method: "director"|"fallback" }.
 * Never throws — like captions, this feature degrades rather than breaking the pipeline.
 */
export async function directCues({ script, stories, assets, captions, durationSeconds, captionMethod, log }) {
  const anchors = anchorStories(stories, captions);

  const summaryLen = Math.min(4.5, durationSeconds * 0.3); // mirrors SummaryCard math
  const minStart = INTRO_SECONDS + 0.4;
  const maxEnd = durationSeconds - summaryLen - 0.3;
  if (maxEnd - minStart < 6 || (!stories.length && !assets.length)) {
    return { cues: [], anchors, method: "fallback" };
  }
  const maxCues = Math.min(6, Math.floor((maxEnd - minStart) / 5));

  const { sys, user } = buildPrompts({ stories, assets, captions, anchors, captionMethod, minStart, maxEnd, maxCues });
  const messages = [
    { role: "system", content: sys },
    { role: "user", content: user },
  ];

  try {
    let raw = "";
    let parsed = {};
    for (let round = 0; round < 2; round++) {
      const res = await openai.chat.completions.create({
        model: SCRIPT_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      });
      raw = res.choices[0].message.content;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }

      const { cues, errors } = validateCues(parsed.cues, { minStart, maxEnd, maxCues, assets, stories });
      if (!errors.length) return { cues, anchors, method: "director" };

      if (round === 0) {
        log?.(`Director repair round: ${errors.length} issue${errors.length > 1 ? "s" : ""}`);
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: `Your cue list had these problems:\n${errors.map((e) => `- ${e}`).join("\n")}\nReturn the corrected full JSON cue list, same format.`,
        });
      } else {
        const kept = salvage(cues);
        log?.(`Director plan partially invalid — keeping ${kept.length} of ${cues.length} cues`);
        return { cues: kept, anchors, method: "director" };
      }
    }
  } catch (err) {
    log?.(`Director unavailable (${err.message}) — falling back to anchored image cues`);
  }

  return { cues: fallbackCues({ assets, anchors, minStart, maxEnd }), anchors, method: "fallback" };
}
