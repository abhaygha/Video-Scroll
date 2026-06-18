import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getOutputDir } from "@/lib/media/ffmpeg";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 8;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export type SavedAsset = {
  type: "IMAGE" | "VIDEO";
  fileName: string;
  filePath: string;
  mimeType: string;
};

export function getProjectAssetsDir(projectId: string): string {
  return path.join(getOutputDir(), projectId, "assets");
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "video/quicktime") return ".mov";
  if (mime === "video/webm") return ".webm";
  if (mime.startsWith("video/")) return ".mp4";
  return ".jpg";
}

export function validateUploadFile(file: File): SavedAsset {
  if (file.size > MAX_BYTES) {
    throw new Error(`"${file.name}" is too large (max 20 MB).`);
  }

  const mime = file.type || "application/octet-stream";
  let type: SavedAsset["type"] | null = null;
  if (IMAGE_TYPES.has(mime)) type = "IMAGE";
  if (VIDEO_TYPES.has(mime)) type = "VIDEO";

  if (!type) {
    throw new Error(
      `"${file.name}" must be JPG, PNG, WebP, or MP4 video.`,
    );
  }

  return {
    type,
    fileName: file.name,
    filePath: "",
    mimeType: mime,
  };
}

export async function saveUploadFile(
  projectId: string,
  file: File,
): Promise<SavedAsset> {
  const meta = validateUploadFile(file);
  const dir = getProjectAssetsDir(projectId);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || extFromMime(meta.mimeType);
  const storedName = `${randomUUID()}${ext}`;
  const filePath = path.join(dir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return { ...meta, filePath };
}

export { MAX_FILES };
