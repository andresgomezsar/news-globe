import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DisplayFont, SansFont } from "./fonts";
import type { Headline } from "./schema";

// A lower-third "BREAKING" card that cycles through the headlines as the audio plays.
export const Ticker: React.FC<{ headlines: Headline[]; accent: string }> = ({
  headlines,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (headlines.length === 0) return null;

  const timeSec = frame / fps;
  // Figure out which headline is active based on atSeconds (or even split).
  const withTimes = headlines.map((h, i) => ({
    ...h,
    at:
      h.atSeconds ??
      (i / headlines.length) * (durationInFrames / fps),
  }));
  let activeIndex = 0;
  for (let i = 0; i < withTimes.length; i++) {
    if (timeSec >= withTimes[i].at) activeIndex = i;
  }
  const active = withTimes[activeIndex];
  const localStart = active.at * fps;
  const local = frame - localStart;

  const enter = spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: 8 });
  const x = interpolate(enter, [0, 1], [-700, 0]);
  const op = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        bottom: 470,
        transform: `translateX(${x}px)`,
        opacity: op,
        maxWidth: 880,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          background: accent,
          color: "#04121a",
          fontFamily: DisplayFont,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: 3,
          padding: "8px 18px",
          borderRadius: 6,
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 12, background: "#04121a" }} />
        Live • {active.source}
      </div>
      <div
        style={{
          marginTop: 14,
          background: "rgba(6, 14, 24, 0.82)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: `5px solid ${accent}`,
          borderRadius: 12,
          padding: "20px 26px",
          color: "white",
          fontFamily: SansFont,
          fontWeight: 700,
          fontSize: 40,
          lineHeight: 1.18,
          textShadow: "0 4px 18px rgba(0,0,0,0.6)",
        }}
      >
        {active.title}
      </div>
    </div>
  );
};
