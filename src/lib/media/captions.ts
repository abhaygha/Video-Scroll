export type CaptionPhrase = {
  text: string;
  start: number;
  end: number;
};

/** Split narration into timed phrases synced to voiceover length. */
export function buildCaptionPhrases(
  text: string,
  durationSec: number,
  isHook = false,
): CaptionPhrase[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunkSize = isHook ? 2 : 3;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  const totalWords = words.length;
  let cursor = 0;

  return chunks.map((chunk) => {
    const chunkWords = chunk.split(/\s+/).filter(Boolean).length;
    const chunkDur = (chunkWords / totalWords) * durationSec;
    const start = cursor;
    cursor += chunkDur;
    return {
      text: chunk,
      start,
      end: cursor,
    };
  });
}

function escapeDrawtext(text: string): string {
  return text
    .slice(0, 48)
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

/** FFmpeg drawtext chain — word groups pop in sync with voiceover. */
export function buildKineticCaptionFilters(
  text: string,
  durationSec: number,
  fontFile: string,
  isHook = false,
): string {
  const phrases = buildCaptionPhrases(text, durationSec, isHook);
  if (phrases.length === 0) return "";

  const fontsize = isHook ? 64 : 46;
  const y = isHook ? "(h-text_h)/2" : "h-th-90";
  const fontcolor = isHook ? "0xFFE135" : "white";

  return phrases
    .map((phrase) => {
      const label = escapeDrawtext(phrase.text);
      const start = phrase.start.toFixed(2);
      const end = phrase.end.toFixed(2);
      return (
        `drawtext=fontfile=${fontFile}:text='${label}':fontsize=${fontsize}` +
        `:fontcolor=${fontcolor}:borderw=3:bordercolor=black@0.65` +
        `:x=(w-text_w)/2:y=${y}:enable='between(t\\,${start}\\,${end})'`
      );
    })
    .join(",");
}
