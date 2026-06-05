import { fetchFeed } from "./rss.js";
import { cleanTitle } from "../text.js";

// Curated keyless RSS feeds, tagged by topic so we only pull what's relevant.
const FEEDS = [
  // World / general
  { outlet: "BBC", topics: ["world", "politics"], url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  { outlet: "The Guardian", topics: ["world", "politics"], url: "https://www.theguardian.com/world/rss" },
  { outlet: "NYT", topics: ["world", "politics"], url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { outlet: "Al Jazeera", topics: ["world", "politics"], url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { outlet: "NPR", topics: ["world", "politics"], url: "https://feeds.npr.org/1001/rss.xml" },
  // Technology
  { outlet: "BBC", topics: ["technology"], url: "http://feeds.bbci.co.uk/news/technology/rss.xml" },
  { outlet: "The Guardian", topics: ["technology"], url: "https://www.theguardian.com/technology/rss" },
  { outlet: "NYT", topics: ["technology"], url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml" },
  // Markets / business
  { outlet: "BBC", topics: ["markets"], url: "http://feeds.bbci.co.uk/news/business/rss.xml" },
  { outlet: "The Guardian", topics: ["markets"], url: "https://www.theguardian.com/business/rss" },
  { outlet: "NYT", topics: ["markets"], url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml" },
  // Law / justice
  { outlet: "The Guardian", topics: ["law"], url: "https://www.theguardian.com/law/rss" },
  // Science
  { outlet: "BBC", topics: ["science"], url: "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
  { outlet: "The Guardian", topics: ["science"], url: "https://www.theguardian.com/science/rss" },
  { outlet: "NYT", topics: ["science"], url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml" },
  // Health
  { outlet: "NYT", topics: ["health"], url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml" },
  { outlet: "NPR", topics: ["health"], url: "https://feeds.npr.org/1128/rss.xml" },
  // Sports
  { outlet: "BBC", topics: ["sports"], url: "http://feeds.bbci.co.uk/sport/rss.xml" },
  { outlet: "NYT", topics: ["sports"], url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml" },
  // Culture / entertainment
  { outlet: "The Guardian", topics: ["entertainment"], url: "https://www.theguardian.com/culture/rss" },
  // Climate / environment
  { outlet: "The Guardian", topics: ["climate"], url: "https://www.theguardian.com/environment/rss" },
];

function selectFeeds(topics) {
  const wanted = new Set((topics || []).map((t) => t.toLowerCase()));
  let feeds = FEEDS.filter((f) => f.topics.some((t) => wanted.has(t)));
  // Always include a couple of world feeds for local/place coverage.
  const world = FEEDS.filter((f) => f.topics.includes("world"));
  feeds = [...new Set([...feeds, ...world.slice(0, 3)])];
  return feeds.slice(0, 9);
}

export async function fetchOutlets({ location, topics, perFeed = 10 }) {
  const feeds = selectFeeds(topics);
  const place = (location?.name || "").toLowerCase();

  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const items = await fetchFeed(f.url);
      return items.slice(0, perFeed).map((it) => ({
        title: cleanTitle(it.title),
        source: f.outlet,
        url: it.link,
        excerpt: it.description && it.description.length > 40 ? it.description.slice(0, 1200) : "",
        publishedAt: it.pubDate || "",
        origin: "rss",
        // Light hint: does this item mention the target place? Helps ranking.
        _mentionsPlace: place ? `${it.title} ${it.description}`.toLowerCase().includes(place) : false,
      }));
    }),
  );

  const out = [];
  for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
  return out.filter((a) => a.title && a.title.length >= 18);
}
