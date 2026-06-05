import path from "node:path";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";
import { REMOTION_ENTRY, REMOTION_PUBLIC, OUTPUT_DIR } from "./config.js";

let bundlePromise = null;

// Bundle the Remotion project once and reuse the served output across renders.
function getBundle(log) {
  if (!bundlePromise) {
    log?.("bundling the Remotion project (first render only)…");
    bundlePromise = bundle({
      entryPoint: REMOTION_ENTRY,
      publicDir: REMOTION_PUBLIC,
      onProgress: () => {},
    });
  }
  return bundlePromise;
}

export async function renderPodcast({ id, inputProps, log }) {
  await ensureBrowser();
  const serveUrl = await getBundle(log);

  const composition = await selectComposition({
    serveUrl,
    id: "NewsPodcast",
    inputProps,
  });

  const outputLocation = path.join(OUTPUT_DIR, `${id}.mp4`);

  // onProgress fires on every frame tick; only log when the whole-number percent
  // actually changes so we don't spam "13%, 13%, 13%…".
  let lastPct = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct === lastPct) return;
      lastPct = pct;
      log?.(`rendering frames… ${pct}%`, { render: progress });
    },
  });

  return { outputLocation, publicPath: `/output/${id}.mp4` };
}
