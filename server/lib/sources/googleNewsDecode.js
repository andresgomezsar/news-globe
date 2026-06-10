// Google News RSS links point at news.google.com/rss/articles/<opaque-id> —
// a JS interstitial, not the article. That breaks body extraction and og:image
// for every googlenews story. This resolves the real publisher URL via Google's
// own redirect-decode endpoint: read the interstitial's signature attributes,
// then ask batchexecute for the target URL. Best-effort — null on any failure.

const CACHE = new Map();
const CACHE_MAX = 400;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

async function fetchWithTimeout(url, init = {}, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function isGoogleNewsUrl(url) {
  try {
    return new URL(url).hostname === "news.google.com";
  } catch {
    return false;
  }
}

async function decode(gnUrl) {
  const page = await fetchWithTimeout(gnUrl, { headers: { "User-Agent": UA } });
  if (!page.ok) return null;
  const html = await page.text();

  const attrId = html.match(/data-n-a-id="([^"]+)"/)?.[1];
  const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) return null;

  const articleId = attrId || gnUrl.split("/articles/")[1]?.split("?")[0];
  if (!articleId) return null;

  const inner = JSON.stringify([
    "garturlreq",
    [
      ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
      "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
    ],
    articleId,
    Number(ts),
    sg,
  ]);
  const body = "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]));

  const res = await fetchWithTimeout("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": UA },
    body,
  });
  if (!res.ok) return null;
  const text = await res.text();

  const exact = text.match(/garturlres\\?","\\?"?(https?:[^"\\]+)/);
  const candidates = exact ? [exact[1]] : text.match(/https?:\/\/[^"\\\s]+/g) || [];
  const real = candidates.find((u) => !/news\.google\.com|googleusercontent\.com|gstatic\.com/.test(u));
  return real || null;
}

/** Resolve a news.google.com article URL to the publisher's URL (cached, null on failure). */
export async function resolveGoogleNewsUrl(url) {
  if (!isGoogleNewsUrl(url)) return null;
  if (CACHE.has(url)) return CACHE.get(url);
  let real = null;
  try {
    real = await decode(url);
  } catch {
    real = null;
  }
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(url, real);
  return real;
}
