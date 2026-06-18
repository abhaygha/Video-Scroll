import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import type { PublishPlatform } from "@/generated/prisma/client";

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  channelId: string | null;
  channelName: string | null;
  accountId: string | null;
  accountName: string | null;
};

export async function getOAuthConnection(
  platform: PublishPlatform,
): Promise<OAuthTokens | null> {
  const row = await db.oAuthConnection.findUnique({ where: { platform } });
  if (!row) return null;

  return {
    accessToken: decryptToken(row.accessToken),
    refreshToken: row.refreshToken ? decryptToken(row.refreshToken) : null,
    expiresAt: row.expiresAt,
    channelId: row.channelId,
    channelName: row.channelName,
    accountId: row.accountId,
    accountName: row.accountName,
  };
}

export async function saveOAuthConnection(
  platform: PublishPlatform,
  tokens: OAuthTokens,
): Promise<void> {
  await db.oAuthConnection.upsert({
    where: { platform },
    create: {
      platform,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      expiresAt: tokens.expiresAt,
      channelId: tokens.channelId,
      channelName: tokens.channelName,
      accountId: tokens.accountId,
      accountName: tokens.accountName,
    },
    update: {
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      expiresAt: tokens.expiresAt,
      channelId: tokens.channelId,
      channelName: tokens.channelName,
      accountId: tokens.accountId,
      accountName: tokens.accountName,
    },
  });
}

export async function deleteOAuthConnection(
  platform: PublishPlatform,
): Promise<void> {
  await db.oAuthConnection.deleteMany({ where: { platform } });
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(
    process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim(),
  );
}
