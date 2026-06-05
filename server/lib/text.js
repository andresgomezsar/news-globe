// Shared text utilities for news sources (entity decoding, tag stripping, dedupe keys).

const ENTITIES = {
  "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
  "&lt;": "<", "&gt;": ">", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
  "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”",
};

export function decodeEntities(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

export function stripTags(html = "") {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Strip a trailing " - Source Name" and collapse whitespace. */
export function cleanTitle(t = "") {
  return decodeEntities(t)
    .replace(/\s*[-|–]\s*[^-|–]{0,40}$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable key for dedup across sources. */
export function titleKey(title = "") {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
}
