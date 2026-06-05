import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_POST_API_KEY, UPLOAD_POST_USER, TIMEZONE } from "./config.js";

const UPLOAD_ENDPOINT = "https://api.upload-post.com/api/upload";

export const uploadConfigured = () => Boolean(UPLOAD_POST_API_KEY && UPLOAD_POST_USER);

const CONTENT_TYPES = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };

/** Build a social caption from the briefing metadata. */
export function buildCaption({ title, subtitle, summary, topics = [], location }) {
  const tags = ["news", ...topics, (location?.name || "").replace(/\s+/g, "")]
    .filter(Boolean)
    .map((t) => "#" + t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 1);
  const head = `${title}${subtitle ? " — " + subtitle : ""}`;
  const body = summary ? `\n\n${summary}` : "";
  return `${head}${body}\n\n${[...new Set(tags)].slice(0, 8).join(" ")}`.slice(0, 280);
}

/**
 * Publish a rendered video via Upload-Post.
 * @param scheduledDate optional ISO-8601 string (with offset) to schedule the post.
 */
export async function uploadVideo({ videoPath, caption, platforms = ["tiktok"], scheduledDate }) {
  if (!uploadConfigured()) {
    return { skipped: true, reason: "UPLOAD_POST_API_KEY / UPLOAD_POST_USER not configured" };
  }
  const buf = await fs.readFile(videoPath);
  const ext = path.extname(videoPath).toLowerCase();
  const type = CONTENT_TYPES[ext] || "video/mp4";

  const form = new FormData();
  form.append("user", UPLOAD_POST_USER);
  form.append("title", caption);
  form.append("privacy_level", "PUBLIC_TO_EVERYONE");
  form.append("disable_duet", "false");
  form.append("disable_comment", "false");
  form.append("disable_stitch", "false");
  form.append("post_mode", "DIRECT_POST");
  form.append("cover_timestamp", "1000");
  form.append("is_aigc", "true"); // these are AI-generated briefings
  for (const p of platforms) form.append("platform[]", p);
  if (scheduledDate) {
    form.append("scheduled_date", scheduledDate);
    form.append("timezone", TIMEZONE);
  }
  form.append("video", new Blob([buf], { type }), path.basename(videoPath));

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Apikey ${UPLOAD_POST_API_KEY}` },
    body: form,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, httpStatus: res.status, error: `Non-JSON response: ${text.slice(0, 200)}` };
  }
  return { ok: res.ok, httpStatus: res.status, ...json };
}
