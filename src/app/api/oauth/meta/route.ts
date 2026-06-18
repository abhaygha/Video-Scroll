import { NextResponse } from "next/server";
import { getMetaAuthUrl } from "@/lib/publish/meta-oauth";
import { isMetaOAuthConfigured } from "@/lib/publish/oauth-store";

export async function GET() {
  if (!isMetaOAuthConfigured()) {
    return NextResponse.json(
      { error: "Set META_APP_ID and META_APP_SECRET in .env" },
      { status: 503 },
    );
  }

  return NextResponse.redirect(getMetaAuthUrl());
}
