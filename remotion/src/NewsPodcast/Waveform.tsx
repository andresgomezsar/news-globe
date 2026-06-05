import React from "react";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { useCurrentFrame, useVideoConfig } from "remotion";

export const Waveform: React.FC<{ src: string; accent: string; bars?: number }> = ({
  src,
  accent,
  bars = 64,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const audioData = useAudioData(src);

  if (!audioData) return null;

  const spectrum = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: 128,
  }).slice(0, bars);

  const gap = 6;
  const barWidth = (width - gap * (bars - 1)) / bars;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 220,
        display: "flex",
        alignItems: "flex-end",
        gap,
        padding: "0 0 0 0",
        maskImage: "linear-gradient(to top, black, transparent)",
        WebkitMaskImage: "linear-gradient(to top, black, transparent)",
      }}
    >
      {spectrum.map((v, i) => {
        const h = Math.max(4, Math.min(200, v * 1400));
        const t = i / bars;
        return (
          <div
            key={i}
            style={{
              width: barWidth,
              height: h,
              borderRadius: barWidth,
              background: `linear-gradient(to top, ${accent}, rgba(255,255,255,0.85))`,
              opacity: 0.18 + t * 0.12 + Math.min(0.5, v * 4),
            }}
          />
        );
      })}
    </div>
  );
};
