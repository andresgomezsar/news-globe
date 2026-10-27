import fs from "node:fs/promises";
import { openai, TTS_MODEL } from "./config.js";

import { VOICES } from "./validation.js";
export { VOICES };

/**
 * Synthesize the script to an mp3 with OpenAI TTS.
 * gpt-4o-mini-tts honours free-form `instructions` for delivery/tone.
 */
export async function synthesizeVoice({ script, voice = "verse", instructions, outPath }) {
  const safeVoice = VOICES.includes(voice) ? voice : "onyx";
  const res = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice: safeVoice,
    input: script,
    instructions:
      instructions ||
      "Read as a confident, warm broadcast news anchor. Clear diction, natural pace, light energy. Brief pauses between stories.",
    response_format: "mp3",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
  return outPath;
}
