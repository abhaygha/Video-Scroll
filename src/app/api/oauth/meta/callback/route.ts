import { NextResponse } from "next/server";
import { handleMetaCallback } from "@/lib/publish/meta-oauth";
import { appUrl } from "@/lib/crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      appUrl(`/settings/connections?error=${encodeURIComponent(error)}`),
    );
  }

  if (!code) {
    return NextResponse.redirect(appUrl("/settings/connections?error=no_code"));
  }

  try {
    await handleMetaCallback(code);
    return NextResponse.redirect(
      appUrl("/settings/connections?connected=instagram"),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      appUrl(`/settings/connections?error=${encodeURIComponent(message)}`),
    );
  }
}
