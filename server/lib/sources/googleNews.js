import { fetchFeed } from "./rss.js";
import { cleanTitle } from "../text.js";

const BASE = "https://news.google.com/rss/search";

function hostFrom(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalize(items) {
  const out = [];
  for (const it of items) {
    const title = cleanTitle(it.title);
    if (!title || title.length < 18) continue;
    out.push({
      title,
      source: it.source || hostFrom(it.link) || "google news",
      url: it.link,
      // Google News snippets double as a usable excerpt when the article body won't extract.
      excerpt: it.description && it.description.length > 40 ? it.description.slice(0, 1200) : "",
      publishedAt: it.pubDate || "",
      origin: "googlenews",
    });
  }
  return out;
}

/** Run an arbitrary Google News query (used by the editor's self-authored re-search too). */
export async function searchGoogleNews(query, { recencyDays = 7 } = {}) {
  const q = recencyDays ? `${query} when:${recencyDays}d` : query;
  const url = `${BASE}?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  return normalize(await fetchFeed(url));
}

export async function fetchGoogleNews({ location, topics }) {
  const place = location?.name ? `"${location.name}"` : "";
  const topicExpr = topics?.length ? `(${topics.join(" OR ")})` : "";
  const query = [place, topicExpr].filter(Boolean).join(" ") || "world news";
  return searchGoogleNews(query, { recencyDays: 7 });
}
