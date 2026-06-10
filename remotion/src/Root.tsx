import React from "react";
import { Composition } from "remotion";
import { NewsPodcast, calculateNewsPodcastMetadata } from "./NewsPodcast";
import { newsPodcastSchema, type NewsPodcastProps } from "./NewsPodcast/schema";

const defaultProps: NewsPodcastProps = {
  title: "Tokyo",
  subtitle: "AI Daily Briefing • Technology",
  accent: "#37e6c9",
  location: { name: "Tokyo", country: "Japan", lat: 35.68, lng: 139.69 },
  topics: ["technology", "markets", "ai"],
  headlines: [
    { source: "Reuters", title: "Chipmakers rally as demand for AI accelerators surges", atSeconds: 0 },
    { source: "NHK", title: "Japan unveils new robotics export framework", atSeconds: 12 },
    { source: "Bloomberg", title: "Yen steadies after central bank commentary", atSeconds: 24 },
  ],
  keyPlayers: ["Broadcom", "Nikkei 225", "SoftBank", "Bank of Japan"],
  summary: "Tokyo markets wobble as AI-chip enthusiasm cools, while new robotics and smart-glasses ventures point to where the next growth is coming from.",
  audioSrc: "",
  durationInSeconds: 36,
  captions: [],
  cues: [
    { type: "stat", atSeconds: 4, durationSeconds: 4, storyIndex: 0, value: "+14%", text: "Chip sector gain this quarter", credit: "Reuters" },
    { type: "quote", atSeconds: 10, durationSeconds: 4.5, storyIndex: 1, text: "The framework opens robotics exports to twelve new markets", credit: "NHK" },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NewsPodcast"
      component={NewsPodcast}
      schema={newsPodcastSchema}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={36 * 30}
      defaultProps={defaultProps}
      calculateMetadata={calculateNewsPodcastMetadata}
    />
  );
};
