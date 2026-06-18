import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOutputDir } from "@/lib/media/ffmpeg";

type RouteContext = { params: Promise<{ id: string; assetId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id, assetId } = await context.params;

  const asset = await db.projectAsset.findFirst({
    where: { id: assetId, projectId: id },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const absPath = path.resolve(asset.filePath);
  const allowedRoot = path.resolve(getOutputDir(), id, "assets");
  const relative = path.relative(allowedRoot, absPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fileStat = await stat(absPath);
  const stream = createReadStream(absPath);
  const contentType =
    asset.mimeType ??
    (asset.type === "VIDEO" ? "video/mp4" : "image/jpeg");

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
