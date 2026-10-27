import { safeFetch } from "./safe-fetch.js";
// Story image fetcher. Downloads each story's article image into the job's render
// dir (served to Remotion over the same local static route as the audio) and
// validates it so a broken/garbage image can never take down a render.

import fs from "node:fs/promises";
import path from "node:path";
import { PORT, RENDER_TOKEN } from "./config.js";
import { probeImageSize } from "./media.js";

const MAX_BYTES = 8 * 1024 * 1024;
const MIN_W = 480;
const MIN_H = 320;
const EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

// Platform logos masquerading as og:image (e.g. the Google News interstitial).
const BLOCKED_HOSTS = /(^|\.)(googleusercontent\.com|gstatic\.com|news\.google\.com)$/i;

async function downloadOne(story, storyIndex, renderDir, id) {
  try {
    if (BLOCKED_HOSTS.test(new URL(story.imageUrl).hostname)) return null;
  } catch {
    return null;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await safeFetch(story.imageUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; news-globe/1.0)", Accept: "image/*" },
    });
    if (!res.ok) return null;

    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = EXT[type];
    if (!ext) return null;

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return null;

    const file = path.join(renderDir, `story-${storyIndex}.${ext}`);
    await fs.writeFile(file, buf);

    // Filter logos/tracking pixels; accept best-effort when ffprobe is missing.
    const dims = await probeImageSize(file);
    if (dims && (dims.width < MIN_W || dims.height < MIN_H)) {
      await fs.rm(file, { force: true });
      return null;
    }

    return {
      storyIndex,
      src: `http://127.0.0.1:${PORT}/renders/${id}/story-${storyIndex}.${ext}?token=${RENDER_TOKEN}`,
      credit: story.source || "wire",
      width: dims?.width,
      height: dims?.height,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Download + validate article images for the kept stories.
 * Returns [{ storyIndex, src, credit, width, height }] — failures are silent skips.
 */
export async function downloadStoryImages({ stories, renderDir, id, log }) {
  const targets = stories
    .slice(0, 6)
    .map((s, i) => ({ story: s, storyIndex: i }))
    .filter((t) => t.story.imageUrl);

  if (!targets.length) return [];

  const results = await Promise.allSettled(
    targets.map((t) => downloadOne(t.story, t.storyIndex, renderDir, id)),
  );
  const assets = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean);

  log?.(`Downloaded ${assets.length}/${targets.length} story images`);
  return assets;
}
