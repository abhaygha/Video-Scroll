import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { cropToPortrait } from "@/lib/media/ffmpeg";

const execFileAsync = promisify(execFile);

type SceneSegment = {
  order: number;
  startSec: number;
  durationSec: number;
  title: string;
};

function buildSegments(
  scenes: { order: number; durationSec: number; text: string; isHook: boolean }[],
): SceneSegment[] {
  let cursor = 0;
  const timed = scenes.map((s) => {
    const seg = {
      order: s.order,
      startSec: cursor,
      durationSec: s.durationSec,
      title: s.text.slice(0, 80),
      isHook: s.isHook,
    };
    cursor += s.durationSec;
    return seg;
  });

  const hook = timed.find((s) => s.isHook) ?? timed[0];
  const body = timed.filter((s) => !s.isHook).slice(0, 2);

  const pack: SceneSegment[] = [];
  if (hook) pack.push(hook);

  let total = pack.reduce((sum, s) => sum + s.durationSec, 0);
  for (const s of body) {
    if (total + s.durationSec > 58) break;
    pack.push(s);
    total += s.durationSec;
  }

  if (pack.length === 0 && timed[0]) {
    return [{ ...timed[0], durationSec: Math.min(45, timed[0].durationSec) }];
  }

  return pack;
}

async function extractClip(
  inputPath: string,
  outputPath: string,
  startSec: number,
  durationSec: number,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    String(startSec),
    "-i",
    inputPath,
    "-t",
    String(durationSec),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export type ShortClipResult = {
  order: number;
  title: string;
  filePath: string;
  startSec: number;
  endSec: number;
};

export async function generateShortClips(
  landscapePath: string,
  workDir: string,
  scenes: { order: number; durationSec: number; text: string; isHook: boolean }[],
): Promise<ShortClipResult[]> {
  await mkdir(workDir, { recursive: true });
  const segments = buildSegments(scenes);
  const results: ShortClipResult[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const rawPath = path.join(workDir, `short_raw_${i}.mp4`);
    const portraitPath = path.join(workDir, `short_${i}.mp4`);

    await extractClip(landscapePath, rawPath, seg.startSec, seg.durationSec);
    await cropToPortrait(rawPath, portraitPath);

    results.push({
      order: i,
      title: seg.title,
      filePath: portraitPath,
      startSec: seg.startSec,
      endSec: seg.startSec + seg.durationSec,
    });
  }

  return results;
}
