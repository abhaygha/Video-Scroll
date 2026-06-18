import type { UploadResult } from "@/lib/publish/youtube";

export async function uploadToInstagramReel(
  filePath: string,
  caption: string,
): Promise<UploadResult> {
  return {
    platform: "instagram",
    status: "stub",
    message: `Instagram Reel upload ready (${filePath}). Connect Meta Business account to enable. Caption: ${caption.slice(0, 80)}…`,
  };
}
