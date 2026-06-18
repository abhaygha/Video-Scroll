import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/publish/google-oauth";
import { isGoogleOAuthConfigured } from "@/lib/publish/oauth-store";

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env" },
      { status: 503 },
    );
  }

  return NextResponse.redirect(getGoogleAuthUrl());
}
