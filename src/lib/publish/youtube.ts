export type YouTubeUploadInput = {
  filePath: string;
  title: string;
  description: string;
};

export type UploadResult = {
  platform: "youtube" | "instagram";
  status: "stub";
  message: string;
};

export async function uploadToYouTube(
  input: YouTubeUploadInput,
): Promise<UploadResult> {
  return {
    platform: "youtube",
    status: "stub",
    message: `YouTube upload ready for: ${input.title} (${input.filePath}). Connect Google OAuth to enable.`,
  };
}
