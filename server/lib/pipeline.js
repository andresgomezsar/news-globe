import fs from "node:fs/promises";
import path from "node:path";
import { RENDERS_DIR, OUTPUT_DIR, PORT } from "./config.js";
import { fetchHeadlines, enrichWithContent, searchMore } from "./news.js";
import { editorReview } from "./editor.js";
import { writeScript } from "./script.js";
import { synthesizeVoice } from "./tts.js";
import { generateCaptions } from "./captions.js";
import { probeDurationSeconds, extractPoster } from "./media.js";
import { renderPodcast } from "./render.js";
import { uploadVideo, buildCaption, uploadConfigured } from "./upload.js";

const ACCENTS = {
  technology: "#37e6c9",
  markets: "#f7b733",
  politics: "#ff6b6b",
  law: "#a78bfa",
  science: "#7c9cff",
  sports: "#5be584",
  entertainment: "#e06cff",
  health: "#4ad9ff",
  world: "#37e6c9",
};

function pickAccent(topics) {
  for (const t of topics) {
    const key = t.toLowerCase();
    if (ACCENTS[key]) return ACCENTS[key];
  }
  return ACCENTS.world;
}

/**
 * Run the full briefing pipeline, emitting progress via `emit(stage, message, extra)`.
 * Returns the data the client needs to play + inspect the result.
 */
export async function runPipeline({
  id,
  location,
  topics,
  voice,
  tone,
  durationSeconds,
  autoUpload = false,
  platforms = ["tiktok"],
  scheduledPublishMs = null,
  emit,
}) {
  const log = (message, extra) => emit("log", message, extra);
  const renderDir = path.join(RENDERS_DIR, id);
  await fs.mkdir(renderDir, { recursive: true });

  // 1. NEWS — agentic editorial loop: gather → read → editor review → re-search if thin
  emit("stage", "news", { label: "Scanning the wires" });
  const MIN_STORIES = 4;
  const seen = new Set();
  let candidates = [];

  const { headlines: first, query } = await fetchHeadlines({ location, topics, limit: 10 });
  for (const h of first) seen.add(h.title.toLowerCase().slice(0, 60));
  candidates = first;
  log(first.length ? `Found ${first.length} candidate stories${query ? ` (${query})` : ""}` : "No live wire — writing a general briefing");

  if (candidates.length) {
    log("Reading the full articles…");
    await enrichWithContent(candidates, 8);
  }

  // The editor always reviews — even on an empty first pass it can cold-start
  // its own search queries to go find coverage.
  log("Editor reviewing for relevance + importance…");
  let review = await editorReview({ location, topics, candidates, minStories: MIN_STORIES });
  if (candidates.length) {
    log(`Editor kept ${review.stories.length}, dropped ${candidates.length - review.stories.length} off-topic`);
  }

  // Self-directed re-search when coverage is thin.
  let round = 0;
  while (review.stories.length < MIN_STORIES && review.suggestedQueries.length && round < 2) {
    round++;
    log(`Thin coverage — agent searching round ${round}: ${review.suggestedQueries.join(" | ")}`);
    const more = await searchMore(review.suggestedQueries, seen, 12);
    if (!more.length) {
      log("No new stories surfaced; proceeding");
      break;
    }
    await enrichWithContent(more, 6);
    candidates = [...candidates, ...more];
    review = await editorReview({ location, topics, candidates, minStories: MIN_STORIES });
    log(`After round ${round}: editor keeps ${review.stories.length} stories`);
  }

  // The editor's ranked stories drive both the script and the on-screen ticker.
  // If nothing passed the relevance bar, write an on-brief general briefing from
  // knowledge rather than reading off-topic wire copy.
  const stories = review.stories;
  if (!stories.length) {
    log("No stories cleared the relevance bar — writing an on-topic general briefing");
  }

  // 2. SCRIPT
  emit("stage", "script", { label: "Writing the script" });
  const { title, subtitle, script } = await writeScript({
    location,
    topics,
    headlines: stories,
    tone,
    durationSeconds,
  });
  log(`Script ready (${script.split(/\s+/).length} words)`);
  emit("script", script, { title, subtitle });

  // 3. VOICE
  emit("stage", "voice", { label: `Voicing with “${voice}”` });
  const audioFile = path.join(renderDir, "audio.mp3");
  await synthesizeVoice({ script, voice, tone, outPath: audioFile });
  const measured = await probeDurationSeconds(audioFile);
  const realDuration = measured || durationSeconds;
  log(`Voice generated (${realDuration.toFixed(1)}s)`);

  // 4. CAPTIONS (+ Deepgram intelligence)
  emit("stage", "captions", { label: "Syncing captions" });
  const { captions, intelligence, method } = await generateCaptions({
    audioPath: audioFile,
    script,
    durationSeconds: realDuration,
    log,
  });
  log(`Captions ready via ${method} (${captions.length} tokens)`);
  if (intelligence?.entities?.length || intelligence?.topics?.length) {
    log(
      `Deepgram intelligence: ${intelligence.entities.length} entities, ` +
        `${intelligence.topics.length} topics${intelligence.sentiment ? `, ${intelligence.sentiment} tone` : ""}`,
    );
  }

  // Spread the editor's ranked stories across the timeline for the lower-third ticker.
  const tickerHeadlines = stories.slice(0, 6).map((h, i, arr) => ({
    source: h.source,
    title: h.title,
    atSeconds: arr.length > 1 ? (i / arr.length) * realDuration + 1.5 : 1.5,
  }));

  // Top "key players" — detected entities, most informative labels first.
  const ENTITY_PRIORITY = ["organization", "person", "product", "location", "event", "work_of_art", "law"];
  const keyPlayers = (intelligence?.entities ?? [])
    .slice()
    .sort((a, b) => {
      const ai = ENTITY_PRIORITY.indexOf((a.label || "").toLowerCase());
      const bi = ENTITY_PRIORITY.indexOf((b.label || "").toLowerCase());
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    })
    .slice(0, 6)
    .map((e) => e.value);

  const accent = pickAccent(topics);
  const inputProps = {
    title: title.toUpperCase(),
    subtitle,
    accent,
    location,
    topics,
    headlines: tickerHeadlines,
    keyPlayers,
    summary: intelligence?.summary || "",
    audioSrc: `http://127.0.0.1:${PORT}/renders/${id}/audio.mp3`,
    durationInSeconds: realDuration + 1.2,
    captions,
  };

  // 5. RENDER
  emit("stage", "render", { label: "Rendering the broadcast" });
  const { publicPath, outputLocation } = await renderPodcast({ id, inputProps, log });
  log("Render complete");

  // Poster thumbnail for the library (a frame past the intro card).
  const posterPath = path.join(OUTPUT_DIR, `${id}.jpg`);
  const poster = await extractPoster(outputLocation, posterPath, Math.max(3, Math.min(realDuration * 0.4, realDuration - 1)));
  const posterUrl = poster ? `/output/${id}.jpg` : null;

  // 6. PUBLISH (optional)
  let uploadResult = null;
  if (autoUpload) {
    emit("stage", "upload", { label: "Publishing to social" });
    if (!uploadConfigured()) {
      log("Auto-publish requested but UPLOAD_POST_USER is not set — skipping upload");
      uploadResult = { skipped: true, reason: "not configured" };
    } else {
      const caption = buildCaption({
        title,
        subtitle,
        summary: intelligence?.summary || "",
        topics: intelligence?.topics?.length ? intelligence.topics : topics,
        location,
      });
      // Publish-at-time: if the target instant is comfortably in the future, hand it
      // to Upload-Post as a scheduled post; otherwise post immediately.
      const scheduledDate =
        scheduledPublishMs && scheduledPublishMs > Date.now() + 30000
          ? new Date(scheduledPublishMs).toISOString()
          : null;
      if (scheduledDate) log(`Scheduling post for ${new Date(scheduledPublishMs).toLocaleString()}`);
      log(`Uploading to ${platforms.join(", ")}…`);
      try {
        uploadResult = await uploadVideo({ videoPath: outputLocation, caption, platforms, scheduledDate });
        if (uploadResult.skipped) log(`Upload skipped: ${uploadResult.reason}`);
        else if (uploadResult.ok) log(`Published ✓ (${platforms.join(", ")})${scheduledDate ? ` — scheduled for ${new Date(scheduledPublishMs).toLocaleTimeString()}` : ""}`);
        else log(`Upload failed: HTTP ${uploadResult.httpStatus} ${uploadResult.error || JSON.stringify(uploadResult).slice(0, 160)}`);
      } catch (e) {
        log(`Upload error: ${e.message}`);
        uploadResult = { ok: false, error: e.message };
      }
    }
  }

  const result = {
    id,
    videoUrl: publicPath,
    posterUrl,
    title,
    subtitle,
    script,
    headlines: stories.map((s) => ({ source: s.source, title: s.title, url: s.url, relevance: s.relevance })),
    keyPlayers,
    summary: intelligence?.summary || "",
    sentiment: intelligence?.sentiment || "",
    detectedTopics: intelligence?.topics || [],
    captionMethod: method,
    durationSeconds: realDuration,
    accent,
    upload: uploadResult,
  };
  emit("done", "Your briefing is ready", result);
  return result;
}
