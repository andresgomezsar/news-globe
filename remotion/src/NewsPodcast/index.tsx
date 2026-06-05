import React, { useEffect } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Globe } from "./Globe";
import { Captions } from "./Captions";
import { Waveform } from "./Waveform";
import { Ticker } from "./Ticker";
import { KeyPlayers } from "./KeyPlayers";
import { SummaryCard } from "./SummaryCard";
import { DisplayFont, SansFont, loadBoldFont } from "./fonts";
import { newsPodcastSchema, type NewsPodcastProps } from "./schema";

export const calculateNewsPodcastMetadata: CalculateMetadataFunction<
  NewsPodcastProps
> = ({ props }) => {
  const fps = 30;
  return {
    fps,
    durationInFrames: Math.max(fps, Math.round((props.durationInSeconds || 60) * fps)),
  };
};

const Header: React.FC<{ title: string; subtitle: string; topics: string[]; accent: string }> = ({
  title,
  subtitle,
  topics,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blink = (Math.sin((frame / fps) * 6) + 1) / 2;
  return (
    <div style={{ position: "absolute", top: 90, left: 70, right: 70 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            border: `2px solid ${accent}`,
            color: accent,
            fontFamily: DisplayFont,
            fontWeight: 700,
            letterSpacing: 4,
            fontSize: 24,
            padding: "6px 14px",
            borderRadius: 4,
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: 12, background: "#ff4757", opacity: 0.4 + blink * 0.6 }} />
          On Air
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: DisplayFont, color: "rgba(255,255,255,0.6)", fontSize: 24, letterSpacing: 2 }}>
          NEWS&nbsp;GLOBE
        </div>
      </div>

      <div
        style={{
          marginTop: 26,
          fontFamily: DisplayFont,
          fontWeight: 700,
          fontSize: 84,
          lineHeight: 0.98,
          color: "white",
          textTransform: "uppercase",
          letterSpacing: -1,
          textShadow: "0 6px 30px rgba(0,0,0,0.6)",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 12, fontFamily: SansFont, fontSize: 30, color: accent, fontWeight: 600 }}>
        {subtitle}
      </div>

      <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 10 }}>
        {topics.map((t) => (
          <span
            key={t}
            style={{
              fontFamily: SansFont,
              fontSize: 22,
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "6px 14px",
              borderRadius: 999,
            }}
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
};

const IntroCard: React.FC<{ title: string; subtitle: string; accent: string }> = ({
  title,
  subtitle,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  const exit = interpolate(frame, [55, 70], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(2,6,12,0.55)",
        opacity: exit,
      }}
    >
      <div style={{ transform: `scale(${interpolate(enter, [0, 1], [0.85, 1])})`, textAlign: "center" }}>
        <div style={{ fontFamily: DisplayFont, color: accent, letterSpacing: 8, fontSize: 30, fontWeight: 600 }}>
          A I&nbsp;&nbsp;B R I E F I N G
        </div>
        <div
          style={{
            fontFamily: DisplayFont,
            fontWeight: 700,
            fontSize: 120,
            color: "white",
            textTransform: "uppercase",
            lineHeight: 0.95,
            marginTop: 18,
            textShadow: `0 0 60px ${accent}55`,
          }}
        >
          {title}
        </div>
        <div style={{ fontFamily: SansFont, fontSize: 34, color: "rgba(255,255,255,0.8)", marginTop: 18 }}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const NewsPodcast: React.FC<NewsPodcastProps> = (props) => {
  const { accent, location, topics, headlines, keyPlayers, summary, audioSrc, captions, title, subtitle } = props;
  const { width, fps, durationInFrames } = useVideoConfig();
  const summaryFrames = Math.min(Math.round(fps * 4.5), Math.round(durationInFrames * 0.3));

  useEffect(() => {
    loadBoldFont();
  }, []);

  const hasAudio = Boolean(audioSrc);
  const src = !hasAudio
    ? ""
    : audioSrc.startsWith("http") || audioSrc.startsWith("/")
      ? audioSrc
      : staticFile(audioSrc);

  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 18%, #0b2236 0%, #05101c 45%, #02060c 100%)" }}>
      {hasAudio && <Audio src={src} />}

      {/* Globe sits in the upper-middle third */}
      <AbsoluteFill style={{ transform: "translateY(-180px)" }}>
        <Globe location={location} accent={accent} size={Math.min(width * 0.92, 980)} />
      </AbsoluteFill>

      {/* Scan-line / grain texture */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 2px, transparent 4px)",
          mixBlendMode: "overlay",
          opacity: 0.5,
        }}
      />

      {hasAudio && <Waveform src={src} accent={accent} />}

      <Header title={title} subtitle={subtitle} topics={topics} accent={accent} />
      <KeyPlayers players={keyPlayers} accent={accent} />
      <Ticker headlines={headlines} accent={accent} />
      <Captions captions={captions} accent={accent} />

      <Sequence durationInFrames={72}>
        <IntroCard title={location.name} subtitle={subtitle} accent={accent} />
      </Sequence>

      {summary ? (
        <Sequence from={durationInFrames - summaryFrames} durationInFrames={summaryFrames}>
          <SummaryCard summary={summary} accent={accent} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

export { newsPodcastSchema };
