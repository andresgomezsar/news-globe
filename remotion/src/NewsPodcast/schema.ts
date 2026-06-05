import { z } from "zod";

export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable().optional(),
});

export const headlineSchema = z.object({
  source: z.string(),
  title: z.string(),
  /** Seconds into the podcast where this headline becomes "active" in the ticker. */
  atSeconds: z.number().optional(),
});

export const locationSchema = z.object({
  name: z.string(),
  country: z.string().optional().default(""),
  lat: z.number(),
  lng: z.number(),
});

export const newsPodcastSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  accent: z.string().default("#37e6c9"),
  location: locationSchema,
  topics: z.array(z.string()).default([]),
  headlines: z.array(headlineSchema).default([]),
  keyPlayers: z.array(z.string()).default([]),
  summary: z.string().default(""),
  audioSrc: z.string(),
  durationInSeconds: z.number().default(60),
  captions: z.array(captionSchema).default([]),
});

export type NewsPodcastProps = z.infer<typeof newsPodcastSchema>;
export type Caption = z.infer<typeof captionSchema>;
export type Headline = z.infer<typeof headlineSchema>;
export type GeoLocation = z.infer<typeof locationSchema>;
