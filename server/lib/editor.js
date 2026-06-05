import { openai, SCRIPT_MODEL } from "./config.js";

/**
 * The "editor" agent. Reviews candidate articles against the brief (place + topics),
 * scores each for relevance + newsworthiness, keeps the strong ones in priority
 * order with grounded talking points, and — when coverage is thin — proposes fresh
 * GDELT search queries to go find better material.
 */
export async function editorReview({ location, topics, candidates, minStories = 4 }) {
  const list = candidates
    .map((c, i) => {
      const body = c.excerpt ? c.excerpt.slice(0, 700) : "(no body text retrieved)";
      return `[${i}] SOURCE: ${c.source}\nTITLE: ${c.title}\nBODY: ${body}`;
    })
    .join("\n\n");

  const sys = `You are the editor-in-chief of a localized news briefing. You are decisive and skeptical.
Given a brief (a place + topics) and a list of candidate articles, you must:
1. Judge each candidate's RELEVANCE to the brief (the place AND/OR the topics) and its newsworthiness.
2. Discard the off-topic, low-signal, spammy, or duplicate items.
3. Keep the strongest stories, ordered by importance (most important first).
4. For each kept story, write a one-line "angle" and 2-4 factual "talkingPoints" pulled ONLY from its BODY text.
5. If you have fewer than ${minStories} genuinely strong, on-brief stories, propose up to 4 new GDELT search
   query strings that would surface better coverage (use quotes for phrases, OR for alternatives, and the
   place name + topic terms). Otherwise return an empty "suggestedQueries" array.`;

  const user = `BRIEF
place: ${location.name}${location.country ? ", " + location.country : ""}
topics: ${topics.join(", ") || "general"}

CANDIDATES
${list || "(none)"}

Return JSON:
{
  "kept": [{ "index": <number>, "relevance": <0..1>, "importance": <1..10>, "angle": "...", "talkingPoints": ["...", "..."] }],
  "discarded": [{ "index": <number>, "reason": "..." }],
  "suggestedQueries": ["...", "..."]
}
Only include indexes that exist. Keep at most 6 stories.`;

  const res = await openai.chat.completions.create({
    model: SCRIPT_MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  let parsed;
  try {
    parsed = JSON.parse(res.choices[0].message.content);
  } catch {
    parsed = {};
  }

  const kept = Array.isArray(parsed.kept) ? parsed.kept : [];
  const stories = kept
    .filter((k) => Number.isInteger(k.index) && candidates[k.index])
    .map((k) => ({
      ...candidates[k.index],
      relevance: clamp01(k.relevance),
      importance: Number(k.importance) || 5,
      angle: String(k.angle || "").slice(0, 160),
      talkingPoints: Array.isArray(k.talkingPoints) ? k.talkingPoints.slice(0, 4).map(String) : [],
    }))
    .sort((a, b) => b.importance - a.importance);

  const suggestedQueries = Array.isArray(parsed.suggestedQueries)
    ? parsed.suggestedQueries.map(String).filter(Boolean).slice(0, 4)
    : [];

  return { stories, suggestedQueries, discarded: parsed.discarded || [] };
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0.5;
  return Math.max(0, Math.min(1, x));
}
