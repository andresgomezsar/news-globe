import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DisplayFont, SansFont } from "./fonts";

// Deepgram-detected entities ("key players") that animate in down the right rail.
export const KeyPlayers: React.FC<{ players: string[]; accent: string }> = ({
  players,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!players.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 70,
        top: 470,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: DisplayFont,
          fontSize: 22,
          letterSpacing: 3,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        Key Players
      </div>
      {players.map((p, i) => {
        const delay = 20 + i * 8;
        const enter = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 10 });
        const x = interpolate(enter, [0, 1], [80, 0]);
        return (
          <div
            key={p + i}
            style={{
              transform: `translateX(${x}px)`,
              opacity: enter,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(8, 16, 26, 0.78)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRight: `4px solid ${accent}`,
              borderRadius: 10,
              padding: "10px 16px",
              fontFamily: SansFont,
              fontWeight: 700,
              fontSize: 28,
              color: "white",
              maxWidth: 460,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 8, background: accent, flexShrink: 0 }} />
            {p}
          </div>
        );
      })}
    </div>
  );
};
