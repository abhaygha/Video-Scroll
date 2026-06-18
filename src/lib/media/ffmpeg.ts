import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

const SYSTEM_FONT_CANDIDATES = [
  "C:/Windows/Fonts/arial.ttf",
  "C:/Windows/Fonts/segoeui.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
];

const PROJECT_FONT_REL = "assets/fonts/arial.ttf";

const OUTPUT_FPS = "30";

export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function hasAudioStream(inputPath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      inputPath,
    ]);
    return stdout.trim() === "audio";
  } catch {
    return false;
  }
}

export async function cropToPortrait(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vf",
    "crop=ih*9/16:ih",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

function escapeDrawtext(text: string): string {
  return text
    .slice(0, 40)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

async function ensureProjectFont(): Promise<string | null> {
  const dest = path.join(process.cwd(), PROJECT_FONT_REL);

  try {
    await access(dest);
    return PROJECT_FONT_REL;
  } catch {
    // copy from system
  }

  for (const src of SYSTEM_FONT_CANDIDATES) {
    try {
      await access(src);
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(src, dest);
      return PROJECT_FONT_REL;
    } catch {
      continue;
    }
  }

  return null;
}

function buildVideoFilter(label: string, fontFile: string): string {
  const text = escapeDrawtext(label);
  return `drawtext=fontfile=${fontFile}:text='${text}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`;
}

async function runPlaceholderFfmpeg(
  outputPath: string,
  durationSec: number,
  videoFilter: string | null,
): Promise<void> {
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x1a1a2e:s=1920x1080:d=${durationSec}`,
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=44100:cl=stereo:d=${durationSec}`,
  ];

  if (videoFilter) {
    args.push("-vf", videoFilter);
  }

  args.push(
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath,
  );
  await execFileAsync("ffmpeg", args);
}

export async function createPlaceholderVideo(
  outputPath: string,
  durationSec: number,
  label: string,
): Promise<void> {
  const fontFile = await ensureProjectFont();
  const videoFilter = fontFile ? buildVideoFilter(label, fontFile) : null;

  try {
    await runPlaceholderFfmpeg(outputPath, durationSec, videoFilter);
  } catch (error) {
    if (!videoFilter) throw error;
    await runPlaceholderFfmpeg(outputPath, durationSec, null);
  }
}

/** Normalize every scene to 1080p30 + stereo AAC (clip audio or silence). */
export async function prepareSceneClip(
  inputPath: string,
  outputPath: string,
  durationSec: number,
  caption: string,
): Promise<void> {
  const fontFile = await ensureProjectFont();
  const text = escapeDrawtext(caption);
  const captionPart = fontFile
    ? `,drawtext=fontfile=${fontFile}:text='${text}':fontsize=34:fontcolor=white:borderw=2:bordercolor=black@0.5:x=(w-text_w)/2:y=h-th-60`
    : "";

  const dur = String(durationSec);
  const vf = `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=${OUTPUT_FPS}${captionPart}`;
  const hasAudio = await hasAudioStream(inputPath);

  const commonTail = [
    "-t",
    dur,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-fps_mode",
    "cfr",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  if (hasAudio) {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      vf,
      "-af",
      "aresample=44100,aformat=channel_layouts=stereo,volume=1.2",
      ...commonTail,
    ]);
  } else {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=44100:cl=stereo:d=${dur}`,
      "-vf",
      vf,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-shortest",
      ...commonTail,
    ]);
  }
}

function toConcatPath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/").replace(/'/g, "'\\''");
}

export async function concatVideos(
  scenePaths: string[],
  outputPath: string,
  listFilePath: string,
): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  const list = scenePaths.map((p) => `file '${toConcatPath(p)}'`).join("\n");
  await writeFile(listFilePath, list, "utf8");

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFilePath,
    "-fflags",
    "+genpts",
    "-reset_timestamps",
    "1",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-r",
    OUTPUT_FPS,
    "-fps_mode",
    "cfr",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function normalizeVideoAudio(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const hasAudio = await hasAudioStream(inputPath);

  if (!hasAudio) {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);
    const dur = parseFloat(stdout.trim()) || 30;

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=44100:cl=stereo:d=${dur}`,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
    return;
  }

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-14:TP=-1.5:LRA=11",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export function getOutputDir(): string {
  return process.env.OUTPUT_DIR ?? path.join(process.cwd(), "output");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
