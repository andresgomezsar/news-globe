import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DisplayFont, SansFont } from "./fonts";
import type { Cue } from "./schema";

// Visual cues planned by the server-side director agent: photo cards with a
// Ken Burns drift, pull-quote cards, and big count-up stat callouts. Each cue
// renders a dim layer over the globe zone so the card reads cleanly.

const useEnterExit = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 10 });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { frame, fps, durationInFrames, enter, exit };
};

const CueShell: React.FC<{ opacity: number; children: React.ReactNode }> = ({ opacity, children }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ background: "rgba(2,6,12,0.6)", opacity }} />
    <div style={{ position: "absolute", left: 70, right: 70, top: 560 }}>{children}</div>
  </AbsoluteFill>
);

const Credit: React.FC<{ label: string; accent: string }> = ({ label, accent }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      fontFamily: DisplayFont,
      fontWeight: 600,
      fontSize: 22,
      letterSpacing: 3,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.75)",
    }}
  >
    <span style={{ width: 10, height: 10, borderRadius: 10, background: accent }} />
    {label}
  </div>
);

const PhotoCue: React.FC<{ cue: Cue; accent: string }> = ({ cue, accent }) => {
  const { frame, durationInFrames, enter, exit } = useEnterExit();
  if (!cue.src) return null;

  const dir = (cue.storyIndex ?? 0) % 2 === 0 ? 1 : -1;
  const kb = interpolate(frame, [0, durationInFrames], [1.08, 1.22]);
  const px = interpolate(frame, [0, durationInFrames], [0, 30 * dir]);
  const py = interpolate(frame, [0, durationInFrames], [0, -18 * dir]);

  return (
    <CueShell opacity={enter * exit}>
      <div
        style={{
          height: 640,
          borderRadius: 24,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          opacity: enter * exit,
          transform: `scale(${interpolate(enter, [0, 1], [0.92, 1])}) translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
          position: "relative",
        }}
      >
        <Img
          src={cue.src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${kb}) translate(${px}px, ${py}px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(6, 14, 24, 0.82)",
            backdropFilter: "blur(8px)",
            padding: "14px 22px",
          }}
        >
          <Credit label={`Photo • ${cue.credit || "wire"}`} accent={accent} />
        </div>
      </div>
    </CueShell>
  );
};

const QuoteCue: React.FC<{ cue: Cue; accent: string }> = ({ cue, accent }) => {
  const { enter, exit } = useEnterExit();
  return (
    <CueShell opacity={enter * exit}>
      <div
        style={{
          background: "rgba(6, 14, 24, 0.82)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: `5px solid ${accent}`,
          borderRadius: 16,
          padding: "30px 38px 34px",
          opacity: enter * exit,
          transform: `scale(${interpolate(enter, [0, 1], [0.94, 1])}) translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
        }}
      >
        <div style={{ fontFamily: DisplayFont, fontWeight: 700, fontSize: 110, lineHeight: 0.5, color: accent, opacity: 0.9, marginTop: 28 }}>
          “
        </div>
        <div
          style={{
            fontFamily: SansFont,
            fontWeight: 600,
            fontSize: 44,
            lineHeight: 1.3,
            color: "white",
            marginTop: 14,
            textShadow: "0 4px 18px rgba(0,0,0,0.6)",
          }}
        >
          {cue.text}
        </div>
        {cue.credit ? (
          <div style={{ marginTop: 22 }}>
            <Credit label={`— ${cue.credit}`} accent={accent} />
          </div>
        ) : null}
      </div>
    </CueShell>
  );
};

const StatCue: React.FC<{ cue: Cue; accent: string }> = ({ cue, accent }) => {
  const { frame, fps, enter, exit } = useEnterExit();
  const value = cue.value ?? "";
  const m = value.match(/^([^0-9]*)([\d,]+(?:\.\d+)?)(.*)$/);
  const target = m ? parseFloat(m[2].replace(/,/g, "")) : NaN;
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const progress = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 24 });
  const shown = Number.isFinite(target)
    ? `${m![1]}${(target * progress).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${m![3]}`
    : value;

  return (
    <CueShell opacity={enter * exit}>
      <div
        style={{
          textAlign: "center",
          opacity: enter * exit,
          transform: `scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
        }}
      >
        <div
          style={{
            fontFamily: DisplayFont,
            fontWeight: 700,
            fontSize: 150,
            lineHeight: 1,
            color: accent,
            textShadow: `0 0 60px ${accent}55`,
          }}
        >
          {shown}
        </div>
        {cue.text ? (
          <div style={{ fontFamily: SansFont, fontWeight: 600, fontSize: 36, color: "white", marginTop: 18 }}>
            {cue.text}
          </div>
        ) : null}
        {cue.credit ? (
          <div style={{ marginTop: 16 }}>
            <Credit label={cue.credit} accent={accent} />
          </div>
        ) : null}
      </div>
    </CueShell>
  );
};

export const Cues: React.FC<{ cues: Cue[]; accent: string }> = ({ cues, accent }) => {
  const { fps } = useVideoConfig();
  if (cues.length === 0) return null;
  return (
    <AbsoluteFill>
      {cues.map((cue, i) => (
        <Sequence
          key={i}
          from={Math.round(cue.atSeconds * fps)}
          durationInFrames={Math.max(1, Math.round(cue.durationSeconds * fps))}
        >
          {cue.type === "image" ? (
            <PhotoCue cue={cue} accent={accent} />
          ) : cue.type === "stat" ? (
            <StatCue cue={cue} accent={accent} />
          ) : (
            <QuoteCue cue={cue} accent={accent} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
