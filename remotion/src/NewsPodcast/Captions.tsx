import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  createTikTokStyleCaptions,
  type Caption as RemotionCaption,
  type TikTokPage,
} from "@remotion/captions";
import { fitText } from "@remotion/layout-utils";
import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { BoldFont } from "./fonts";
import type { Caption } from "./schema";

const COMBINE_MS = 900;
const DESIRED_FONT_SIZE = 78;

const Page: React.FC<{ page: TikTokPage; accent: string }> = ({ page, accent }) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000;

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 6 });

  const fitted = fitText({
    fontFamily: BoldFont,
    text: page.text,
    withinWidth: width * 0.82,
    textTransform: "uppercase",
  });
  const fontSize = Math.min(DESIRED_FONT_SIZE, fitted.fontSize);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 250 }}>
      <div
        style={{
          fontSize,
          fontFamily: BoldFont,
          color: "white",
          textTransform: "uppercase",
          WebkitTextStroke: "9px black",
          paintOrder: "stroke",
          textAlign: "center",
          lineHeight: 1.05,
          maxWidth: width * 0.84,
          wordSpacing: "0.12em",
          textShadow: "0 0 18px rgba(0,0,0,0.9), 0 8px 24px rgba(0,0,0,0.8)",
          transform: makeTransform([
            scale(interpolate(enter, [0, 1], [0.86, 1])),
            translateY(interpolate(enter, [0, 1], [44, 0])),
          ]),
        }}
      >
        {page.tokens.map((t) => {
          const active = t.fromMs <= timeMs && t.toMs > timeMs;
          return (
            <span
              key={t.fromMs}
              style={{
                display: "inline",
                whiteSpace: "pre",
                color: active ? accent : "white",
                marginRight: "0.14em",
              }}
            >
              {t.text.trim()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{ captions: Caption[]; accent: string }> = ({
  captions,
  accent,
}) => {
  const { fps } = useVideoConfig();

  const { pages } = useMemo(() => {
    const cleaned: RemotionCaption[] = captions.map((c) => ({
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
      timestampMs: c.timestampMs ?? (c.startMs + c.endMs) / 2,
      confidence: c.confidence ?? null,
    }));
    return createTikTokStyleCaptions({ captions: cleaned, combineTokensWithinMilliseconds: COMBINE_MS });
  }, [captions]);

  return (
    <AbsoluteFill>
      {pages.map((page, i) => {
        const next = pages[i + 1] ?? null;
        const start = (page.startMs / 1000) * fps;
        const end = next ? (next.startMs / 1000) * fps : start + (COMBINE_MS / 1000) * fps + fps;
        const dur = Math.max(1, end - start);
        return (
          <Sequence key={i} from={Math.floor(start)} durationInFrames={Math.ceil(dur)}>
            <Page page={page} accent={accent} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
