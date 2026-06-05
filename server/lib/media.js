import { spawn } from "node:child_process";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || `${cmd} exited ${code}`))));
  });
}

/** Probe audio duration in seconds via ffprobe. Returns null if ffprobe is unavailable. */
export async function probeDurationSeconds(file) {
  try {
    const out = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    const d = parseFloat(out.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

/** Convert any audio to 16kHz mono wav (what whisper.cpp needs). Returns wav path or null. */
export async function toWav16k(input, output) {
  try {
    await run("ffmpeg", ["-y", "-i", input, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", output]);
    return output;
  } catch {
    return null;
  }
}

/** Grab a representative frame as a poster JPEG. Returns out path or null. */
export async function extractPoster(video, out, atSeconds = 3) {
  try {
    await run("ffmpeg", ["-y", "-ss", String(atSeconds), "-i", video, "-frames:v", "1", "-q:v", "4", out]);
    return out;
  } catch {
    return null;
  }
}

export const hasFfmpeg = async () => {
  try {
    await run("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
};
