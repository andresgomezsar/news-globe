// Multi-source news aggregator. Each source returns a normalized article:
//   { title, source, url, excerpt, publishedAt, origin }
// Sources run in parallel, are merged + deduped, then the editor agent ranks them.

import { NEWS_SOURCES } from "./config.js";
import { decodeEntities, stripTags, cleanTitle, titleKey } from "./text.js";
import { fetchGoogleNews, searchGoogleNews } from "./sources/googleNews.js";
import { fetchOutlets } from "./sources/outlets.js";

const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";

// ── GDELT source ──
async function gdeltQuery(query, maxrecords = 20) {
  const url = `${GDELT}?query=${encodeURIComponent(query)}&mode=ArtList&format=json&sort=DateDesc&maxrecords=${maxrecords}`;
  const res = await fetch(url, { headers: { "User-Agent": "news-globe/1.0 (+local)" } });
  const text = await res.text();
  if (!text.trim().startsWith("{")) throw new Error(`GDELT rejected query: ${text.slice(0, 120)}`);
  const data = JSON.parse(text);
  return Array.isArray(data.articles) ? data.articles : [];
}

function normalizeGdelt(articles) {
  return articles
    .map((a) => ({
      title: cleanTitle(a.title),
      source: a.domain ? a.domain.replace(/^www\./, "") : "wire",
      url: a.url,
      excerpt: "",
      publishedAt: a.seendate || "",
      origin: "gdelt",
    }))
    .filter((a) => a.title && a.title.length >= 18);
}

async function fetchGdelt({ location, topics }) {
  const topicExpr = topics?.length ? `(${topics.map((t) => `"${t}"`).join(" OR ")})` : "";
  const place = location?.name ? `"${location.name}"` : "";
  const attempts = [
    [place, topicExpr, "sourcelang:english"].filter(Boolean).join(" "),
    [topicExpr, "sourcelang:english"].filter(Boolean).join(" "),
    [place, "sourcelang:english"].filter(Boolean).join(" "),
    "(world OR breaking) sourcelang:english",
  ].filter(Boolean);

  for (const query of attempts) {
    try {
      const articles = normalizeGdelt(await gdeltQuery(query, 30));
      if (articles.length) return articles;
    } catch {
      /* try the next, less specific query */
    }
  }
  return [];
}

// ── Aggregation ──
const SOURCE_FNS = {
  gdelt: fetchGdelt,
  googlenews: fetchGoogleNews,
  outlets: fetchOutlets,
};

function dedupeMerge(lists, place) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const a of list) {
      const key = titleKey(a.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const hay = `${a.title} ${a.excerpt || ""}`.toLowerCase();
      out.push({ ...a, _mentionsPlace: place ? hay.includes(place) : false });
    }
  }
  return out;
}

function rankScore(a) {
  let s = 0;
  if (a._mentionsPlace) s += 3;
  if (a.excerpt && a.excerpt.length > 80) s += 1;
  const ts = Date.parse(a.publishedAt);
  if (Number.isFinite(ts)) {
    const ageH = (Date.now() - ts) / 3.6e6;
    if (ageH < 24) s += 2;
    else if (ageH < 72) s += 1;
  }
  return s;
}

/**
 * Pull candidate stories from every enabled source, merged + ranked.
 * Returns more than `limit` so the editor agent has material to filter.
 */
export async function fetchHeadlines({ location, topics, limit = 10 }) {
  const place = (location?.name || "").toLowerCase();
  const active = NEWS_SOURCES.filter((s) => SOURCE_FNS[s]);

  const results = await Promise.allSettled(active.map((s) => SOURCE_FNS[s]({ location, topics })));
  const lists = results.map((r) => (r.status === "fulfilled" ? r.value : []));
  const usedCounts = active.map((s, i) => `${s}:${lists[i].length}`);

  const merged = dedupeMerge(lists, place)
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, Math.max(limit, 18));

  return { headlines: merged, query: usedCounts.join(" · ") };
}

// ── Editor's self-authored re-search (GDELT + Google News) ──
export async function searchMore(queries, seenTitles = new Set(), perQuery = 10) {
  const out = [];
  for (const q of queries.slice(0, 4)) {
    const lists = await Promise.allSettled([
      gdeltQuery(q, perQuery).then(normalizeGdelt).catch(() => []),
      searchGoogleNews(q).catch(() => []),
    ]);
    for (const r of lists) {
      if (r.status !== "fulfilled") continue;
      for (const a of r.value) {
        const key = titleKey(a.title);
        if (!key || seenTitles.has(key)) continue;
        seenTitles.add(key);
        out.push(a);
      }
    }
  }
  return out;
}

// ── Article body extraction (fills/upgrades excerpts) ──
async function fetchArticleText(url, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; news-globe/1.0)", Accept: "text/html" },
    });
    if (!res.ok) return "";
    if (!(res.headers.get("content-type") || "").includes("html")) return "";

    let html = await res.text();
    html = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ");

    const metaMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const meta = metaMatch ? decodeEntities(metaMatch[1]).trim() : "";

    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripTags(m[1]))
      .filter((t) => t.length > 60 && /[.!?]/.test(t));

    let body = "";
    for (const p of paras) {
      if (body.length > 1100) break;
      body += (body ? " " : "") + p;
    }
    return [meta, body].filter(Boolean).join(" ").slice(0, 1200).trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch readable bodies in parallel, keeping the richer of fetched vs existing excerpt. */
export async function enrichWithContent(headlines, max = 6) {
  const targets = headlines.slice(0, max);
  const results = await Promise.allSettled(targets.map((h) => fetchArticleText(h.url)));
  results.forEach((r, i) => {
    const fetched = r.status === "fulfilled" ? r.value : "";
    const existing = targets[i].excerpt || "";
    targets[i].excerpt = fetched.length > existing.length ? fetched : existing;
  });
  return headlines;
}
