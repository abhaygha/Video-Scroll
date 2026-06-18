import { google } from "googleapis";
import { appUrl } from "@/lib/crypto";
import {
  getOAuthConnection,
  saveOAuthConnection,
  isGoogleOAuthConfigured,
} from "@/lib/publish/oauth-store";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = appUrl("/api/oauth/google/callback");

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(): string {
  const oauth2 = getGoogleOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function handleGoogleCallback(code: string): Promise<void> {
  const oauth2 = getGoogleOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const channels = await youtube.channels.list({
    part: ["snippet"],
    mine: true,
  });

  const channel = channels.data.items?.[0];

  await saveOAuthConnection("YOUTUBE", {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    channelId: channel?.id ?? null,
    channelName: channel?.snippet?.title ?? null,
    accountId: null,
    accountName: null,
  });
}

export async function getAuthenticatedYouTubeClient() {
  if (!isGoogleOAuthConfigured()) return null;

  const stored = await getOAuthConnection("YOUTUBE");
  if (!stored) return null;

  const oauth2 = getGoogleOAuthClient();
  oauth2.setCredentials({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken ?? undefined,
    expiry_date: stored.expiresAt?.getTime(),
  });

  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await saveOAuthConnection("YOUTUBE", {
        ...stored,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? stored.refreshToken,
        expiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : stored.expiresAt,
      });
    }
  });

  return google.youtube({ version: "v3", auth: oauth2 });
}
