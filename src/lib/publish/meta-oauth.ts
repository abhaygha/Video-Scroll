import { appUrl } from "@/lib/crypto";
import {
  getOAuthConnection,
  saveOAuthConnection,
  isMetaOAuthConfigured,
} from "@/lib/publish/oauth-store";

const GRAPH = "https://graph.facebook.com/v21.0";

export function getMetaAuthUrl(): string {
  const appId = process.env.META_APP_ID!;
  const redirectUri = encodeURIComponent(appUrl("/api/oauth/meta/callback"));
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
  ].join(",");

  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scopes}&response_type=code`;
}

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}&access_token=${accessToken}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API error: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function handleMetaCallback(code: string): Promise<void> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = appUrl("/api/oauth/meta/callback");

  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
  );
  if (!tokenRes.ok) {
    throw new Error(await tokenRes.text());
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const userToken = tokenData.access_token;
  const pages = await graphGet<{
    data: { id: string; name: string; access_token: string }[];
  }>(`/me/accounts?fields=id,name,access_token`, userToken);

  const page = pages.data[0];
  if (!page) {
    throw new Error("No Facebook Page linked to this account.");
  }

  const igAccounts = await graphGet<{
    instagram_business_account?: { id: string; username?: string };
  }>(`/${page.id}?fields=instagram_business_account{id,username}`, page.access_token);

  const ig = igAccounts.instagram_business_account;
  if (!ig?.id) {
    throw new Error(
      "No Instagram Business account linked to your Facebook Page.",
    );
  }

  await saveOAuthConnection("INSTAGRAM", {
    accessToken: page.access_token,
    refreshToken: null,
    expiresAt: tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null,
    channelId: null,
    channelName: null,
    accountId: ig.id,
    accountName: ig.username ?? page.name,
  });
}

export async function getInstagramAccountId(): Promise<{
  accountId: string;
  accessToken: string;
  accountName: string | null;
} | null> {
  if (!isMetaOAuthConfigured()) return null;
  const stored = await getOAuthConnection("INSTAGRAM");
  if (!stored?.accountId) return null;
  return {
    accountId: stored.accountId,
    accessToken: stored.accessToken,
    accountName: stored.accountName,
  };
}
