import { NextResponse } from "next/server";
import path from "node:path";
import { db } from "@/lib/db";
import { ensureCreatorProfile, getCreatorAssetsDir } from "@/lib/creator/profile";
import { saveUploadFile } from "@/lib/media/assets";

export async function GET() {
  await ensureCreatorProfile();
  const assets = await db.creatorProfileAsset.findMany({
    where: { profileId: "default" },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  await ensureCreatorProfile();
  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const existing = await db.creatorProfileAsset.count({
    where: { profileId: "default" },
  });

  const saved = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const meta = await saveUploadFile("creator-profile", file);
    const destDir = getCreatorAssetsDir();
    const destPath = path.join(destDir, path.basename(meta.filePath));

    const { rename, mkdir } = await import("node:fs/promises");
    await mkdir(destDir, { recursive: true });
    await rename(meta.filePath, destPath);

    const asset = await db.creatorProfileAsset.create({
      data: {
        profileId: "default",
        type: meta.type,
        fileName: meta.fileName,
        filePath: destPath,
        mimeType: meta.mimeType,
        order: existing + i,
      },
    });
    saved.push(asset);
  }

  return NextResponse.json({ assets: saved });
}
