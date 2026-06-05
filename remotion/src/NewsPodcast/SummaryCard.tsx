import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DisplayFont, SansFont } from "./fonts";

// Closing card built from the Deepgram-generated audio summary.
export const SummaryCard: React.FC<{ summary: string; accent: string }> = ({
  summary,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!summary) return null;

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  const fade = interpolate(
    frame,
    [0, 12, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(2,6,12,0.82)",
        opacity: fade,
        padding: 90,
      }}
    >
      <div style={{ transform: `scale(${interpolate(enter, [0, 1], [0.92, 1])})`, maxWidth: 860 }}>
        <div
          style={{
            fontFamily: DisplayFont,
            color: accent,
            letterSpacing: 6,
            fontSize: 28,
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          The Takeaway
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: SansFont,
            fontWeight: 600,
            fontSize: 46,
            lineHeight: 1.32,
            color: "white",
            textShadow: "0 6px 30px rgba(0,0,0,0.6)",
          }}
        >
          {summary}
        </div>
      </div>
    </AbsoluteFill>
  );
};
