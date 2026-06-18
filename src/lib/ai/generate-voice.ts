import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export function hasVoiceApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Generate MP3 narration for a scene using OpenAI TTS. */
export async function generateSceneVoice(
  text: string,
  outputPath: string,
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Voiceover requires OPENAI_API_KEY in .env (same key used for scripts).",
    );
  }

  const input = text.trim().slice(0, 4096);
  if (!input) {
    throw new Error("Scene has no text for voiceover.");
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input,
      voice: "onyx",
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI TTS failed (${response.status}): ${detail}`);
  }

  if (!response.body) {
    throw new Error("OpenAI TTS returned an empty response.");
  }

  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(outputPath),
  );
}
