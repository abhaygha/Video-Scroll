import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { access, copyFile, mkdir } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const PROJECT_FONT_REL = "assets/fonts/arial.ttf";

async function ensureFont(): Promise<string | null> {
  const dest = path.join(process.cwd(), PROJECT_FONT_REL);
  try {
    await access(dest);
    return PROJECT_FONT_REL;
  } catch {
    return null;
  }
}

function escapeDrawtext(text: string): string {
  return text
    .slice(0, 60)
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  title: string,
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const framePath = outputPath.replace(/\.jpg$/i, "_frame.jpg");

  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    "2",
    "-i",
    videoPath,
    "-vframes",
    "1",
    "-q:v",
    "2",
    framePath,
  ]);

  const font = await ensureFont();
  if (!font) {
    await copyFile(framePath, outputPath);
    return;
  }

  const text = escapeDrawtext(title);
  const vf =
    `scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,` +
    `drawtext=fontfile=${font}:text='${text}':fontsize=52:fontcolor=white:` +
    `borderw=4:bordercolor=black:x=(w-text_w)/2:y=h-120`;

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    framePath,
    "-vf",
    vf,
    "-q:v",
    "3",
    outputPath,
  ]);
}
