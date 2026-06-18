import { db } from "@/lib/db";
import type { CompositingLayout } from "@/generated/prisma/client";

const DEFAULT_LAYOUT: CompositingLayout = "PIP_LARGE";

export async function ensureCreatorProfile() {
  return db.creatorProfile.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
    include: { assets: { orderBy: { order: "asc" } } },
  });
}

/** Returns default layout if profile table/client is unavailable. */
export async function getDefaultCompositingLayout(): Promise<CompositingLayout> {
  try {
    const profile = await ensureCreatorProfile();
    return profile.layout;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export async function getCreatorProfile() {
  return ensureCreatorProfile();
}

export async function updateCreatorProfile(data: {
  displayName?: string;
  voiceId?: string;
  layout?: CompositingLayout;
  brandColor?: string;
}) {
  await ensureCreatorProfile();
  return db.creatorProfile.update({
    where: { id: "default" },
    data,
    include: { assets: { orderBy: { order: "asc" } } },
  });
}

import path from "node:path";
import { getOutputDir } from "@/lib/media/ffmpeg";

export function getCreatorAssetsDir(): string {
  return path.join(getOutputDir(), "creator");
}
