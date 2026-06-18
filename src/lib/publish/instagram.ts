import { readFile } from "node:fs/promises";
import type { UploadResult } from "@/lib/publish/youtube";
import {
  getInstagramAccountId,
} from "@/lib/publish/meta-oauth";
import { isMetaOAuthConfigured } from "@/lib/publish/oauth-store";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function uploadToInstagramReel(
  filePath: string,
  caption: string,
): Promise<UploadResult> {
  if (!isMetaOAuthConfigured()) {
    return {
      platform: "instagram",
      status: "stub",
      message: `Instagram Reel ready (${filePath}). Connect Meta in Settings → Connections.`,
    };
  }

  const account = await getInstagramAccountId();
  if (!account) {
    return {
      platform: "instagram",
      status: "stub",
      message:
        "Instagram not connected. Link your Facebook Page + Instagram Business account in Settings.",
    };
  }

  try {
    const videoBuffer = await readFile(filePath);
    const videoUrl = await uploadVideoToHosting(filePath, videoBuffer);

    const containerRes = await fetch(
      `${GRAPH}/${account.accountId}/media?media_type=REELS&video_url=${encodeURIComponent(videoUrl)}&caption=${encodeURIComponent(caption.slice(0, 2200))}&access_token=${account.accessToken}`,
      { method: "POST" },
    );

    if (!containerRes.ok) {
      throw new Error(await containerRes.text());
    }

    const container = (await containerRes.json()) as { id: string };

    let publishedId: string | undefined;
    for (let attempt = 0; attempt < 12; attempt++) {
      await sleep(5000);
      const statusRes = await fetch(
        `${GRAPH}/${container.id}?fields=status_code&access_token=${account.accessToken}`,
      );
      const status = (await statusRes.json()) as { status_code?: string };
      if (status.status_code === "FINISHED") {
        const publishRes = await fetch(
          `${GRAPH}/${account.accountId}/media_publish?creation_id=${container.id}&access_token=${account.accessToken}`,
          { method: "POST" },
        );
        if (!publishRes.ok) throw new Error(await publishRes.text());
        const published = (await publishRes.json()) as { id: string };
        publishedId = published.id;
        break;
      }
      if (status.status_code === "ERROR") {
        throw new Error("Instagram video processing failed.");
      }
    }

    if (!publishedId) {
      throw new Error("Instagram publish timed out waiting for processing.");
    }

    return {
      platform: "instagram",
      status: "completed",
      remoteId: publishedId,
      message: `Published Reel to @${account.accountName ?? "instagram"}.`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Instagram upload failed";
    return {
      platform: "instagram",
      status: "failed",
      message,
    };
  }
}

async function uploadVideoToHosting(
  filePath: string,
  buffer: Buffer,
): Promise<string> {
  const publicBase = process.env.PUBLIC_VIDEO_BASE_URL?.trim();
  if (publicBase) {
    const name = filePath.replace(/\\/g, "/").split("/").pop();
    return `${publicBase.replace(/\/$/, "")}/${name}`;
  }

  throw new Error(
    "Instagram requires a publicly accessible video URL. Set PUBLIC_VIDEO_BASE_URL in .env (e.g. ngrok or S3) pointing to your rendered files.",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
