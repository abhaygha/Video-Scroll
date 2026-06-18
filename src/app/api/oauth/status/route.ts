import { NextResponse } from "next/server";
import {
  getOAuthConnection,
  deleteOAuthConnection,
  isGoogleOAuthConfigured,
  isMetaOAuthConfigured,
} from "@/lib/publish/oauth-store";

export async function GET() {
  const youtube = await getOAuthConnection("YOUTUBE");
  const instagram = await getOAuthConnection("INSTAGRAM");

  return NextResponse.json({
    youtube: {
      configured: isGoogleOAuthConfigured(),
      connected: Boolean(youtube),
      channelName: youtube?.channelName ?? null,
    },
    instagram: {
      configured: isMetaOAuthConfigured(),
      connected: Boolean(instagram),
      accountName: instagram?.accountName ?? null,
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");

  if (platform === "YOUTUBE" || platform === "INSTAGRAM") {
    await deleteOAuthConnection(platform);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
}
