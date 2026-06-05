import { openai, SCRIPT_MODEL } from "./config.js";

const WORDS_PER_SECOND = 2.6; // ~155 wpm broadcast pace

export async function writeScript({ location, topics, headlines, tone, durationSeconds }) {
  const targetWords = Math.round(durationSeconds * WORDS_PER_SECOND);
  const headlineList = headlines.length
    ? headlines
        .map((h, i) => {
          const lines = [`${i + 1}. (${h.source}) ${h.title}`];
          if (h.angle) lines.push(`   ANGLE: ${h.angle}`);
          if (h.talkingPoints?.length) {
            lines.push("   POINTS: " + h.talkingPoints.map((p) => `• ${p}`).join("  "));
          } else if (h.excerpt) {
            lines.push(`   STORY: ${h.excerpt}`);
          } else {
            lines.push("   STORY: (no body retrieved — summarise from the headline + general knowledge)");
          }
          return lines.join("\n");
        })
        .join("\n")
    : "No live wire copy available — write a plausible, clearly-framed briefing from general knowledge and say it's a general overview.";

  const sys = `You are the head writer for "News Globe", a slick AI news briefing.
Write a single spoken-word script for ONE host. Rules:
- Pure spoken text only: no stage directions, no speaker labels, no markdown, no emoji.
- Open with a punchy hook that names the place, then weave the stories into a flowing narrative.
- GROUND every claim in the provided STORY text — pull the actual specifics (who, what, numbers, context) from each story rather than just restating its title.
- Cover the most important 3-5 stories with real detail; briefly mention the rest. End with a crisp sign-off.
- Conversational, confident, broadcast cadence. Tone: ${tone || "sharp and energetic"}.
- Target about ${targetWords} words (±15%). Do not exceed it much — timing matters.
- Never invent specific fake statistics; keep claims general if unsure.`;

  const user = `PLACE: ${location.name}${location.country ? ", " + location.country : ""} (lat ${location.lat.toFixed(2)}, lng ${location.lng.toFixed(2)})
TOPICS: ${topics.join(", ") || "general"}
TODAY'S HEADLINES:
${headlineList}

Return a JSON object with exactly these fields:
{
  "title": "<= 16 char punchy title, usually the place name in caps>",
  "subtitle": "short tagline incl. the main topic, e.g. 'AI Daily Briefing • Markets'",
  "script": "the full spoken script as one string"
}`;

  const res = await openai.chat.completions.create({
    model: SCRIPT_MODEL,
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  const parsed = JSON.parse(res.choices[0].message.content);
  return {
    title: String(parsed.title || location.name).slice(0, 22),
    subtitle: String(parsed.subtitle || `AI Daily Briefing • ${topics[0] || "World"}`),
    script: String(parsed.script || "").trim(),
  };
}
