import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..", "..");
export const SERVER_DIR = path.resolve(__dirname, "..");
export const REMOTION_DIR = path.join(ROOT, "remotion");
export const REMOTION_ENTRY = path.join(REMOTION_DIR, "src", "index.ts");
export const REMOTION_PUBLIC = path.join(REMOTION_DIR, "public");
export const RENDERS_DIR = path.join(REMOTION_PUBLIC, "renders");
export const OUTPUT_DIR = path.join(SERVER_DIR, "public", "output");

dotenv.config({ path: path.join(ROOT, ".env") });

export const PORT = Number(process.env.PORT || 5174);
export const HOST = process.env.HOST || "127.0.0.1";
export const RENDER_TOKEN = crypto.randomBytes(32).toString("hex");
export const SECURITY = {
  accessToken: process.env.NEWS_GLOBE_TOKEN,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || `http://localhost:5173,http://127.0.0.1:5173,http://localhost:${PORT},http://127.0.0.1:${PORT}`).split(",").map(s => s.trim()),
  secureCookie: process.env.COOKIE_SECURE === "true",
  publishingEnabled: process.env.ENABLE_PUBLISHING === "true",
  renderToken: RENDER_TOKEN,
  defaultTimezone: process.env.TIMEZONE || "America/Los_Angeles",
};
export const SCRIPT_MODEL = process.env.SCRIPT_MODEL || "gpt-4o-mini";
export const TTS_MODEL = process.env.TTS_MODEL || "gpt-4o-mini-tts";
export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
export const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || "nova-3";
export const NEWS_SOURCES = (process.env.NEWS_SOURCES || "gdelt,googlenews,outlets")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
export const UPLOAD_POST_API_KEY = process.env.UPLOAD_POST_API_KEY || "";
export const UPLOAD_POST_USER = process.env.UPLOAD_POST_USER || "";
export const TIMEZONE = process.env.TIMEZONE || "America/Los_Angeles";
export const SCHEDULES_FILE = path.join(SERVER_DIR, "schedules.json");

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  OPENAI_API_KEY is not set — script + voice generation will fail.");
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
