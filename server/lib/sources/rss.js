import { decodeEntities, stripTags } from "../text.js";

// Minimal, dependency-free RSS 2.0 + Atom parser. Good enough for news feeds.

function innerOf(block, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  let v = m[1].trim();
  const cdata = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  if (cdata) v = cdata[1];
  return v.trim();
}

export function parseFeed(xml) {
  const items = [];
  const re = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[2];

    const title = decodeEntities(innerOf(block, "title"));

    // RSS uses <link>url</link>; Atom uses <link href="url" />.
    let link = innerOf(block, "link");
    if (!link) {
      const lm = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (lm) link = lm[1];
    }

    const descRaw =
      innerOf(block, "description") || innerOf(block, "summary") || innerOf(block, "content");
    const description = stripTags(descRaw);

    const pubDate =
      innerOf(block, "pubDate") || innerOf(block, "published") || innerOf(block, "updated") || "";

    // Google News feeds carry the real outlet in <source url="...">Name</source>.
    const source = decodeEntities(innerOf(block, "source"));

    if (title) items.push({ title, link: link.trim(), description, pubDate, source });
  }
  return items;
}

/** Fetch + parse a feed URL with a timeout. Returns [] on any failure. */
export async function fetchFeed(url, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; news-globe/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
