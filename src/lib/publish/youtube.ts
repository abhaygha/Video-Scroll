import { createReadStream } from "node:fs";
import { getAuthenticatedYouTubeClient } from "@/lib/publish/google-oauth";
import { isGoogleOAuthConfigured } from "@/lib/publish/oauth-store";

export type YouTubeUploadInput = {
  filePath: string;
  title: string;
  description: string;
  tags?: string;
};

export type UploadResult = {
  platform: "youtube" | "instagram";
  status: "completed" | "stub" | "failed";
  message: string;
  remoteId?: string;
};

export async function uploadToYouTube(
  input: YouTubeUploadInput,
): Promise<UploadResult> {
  if (!isGoogleOAuthConfigured()) {
    return {
      platform: "youtube",
      status: "stub",
      message: `YouTube upload ready for: ${input.title}. Connect Google OAuth in Settings → Connections.`,
    };
  }

  const youtube = await getAuthenticatedYouTubeClient();
  if (!youtube) {
    return {
      platform: "youtube",
      status: "stub",
      message:
        "YouTube not connected. Go to Settings → Connections and link your Google account.",
    };
  }

  try {
    const tags = input.tags
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 15);

    const res = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: input.title.slice(0, 100),
          description: input.description.slice(0, 5000),
          tags,
          categoryId: "19",
        },
        status: {
          privacyStatus: "private",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: createReadStream(input.filePath),
      },
    });

    const videoId = res.data.id;
    return {
      platform: "youtube",
      status: "completed",
      remoteId: videoId ?? undefined,
      message: videoId
        ? `Uploaded to YouTube (private): https://youtube.com/watch?v=${videoId}`
        : "Uploaded to YouTube as private video.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "YouTube upload failed";
    return {
      platform: "youtube",
      status: "failed",
      message,
    };
  }
}
