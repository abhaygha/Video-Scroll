import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOutputDir } from "@/lib/media/ffmpeg";

type RouteContext = { params: Promise<{ id: string }> };

const FORMAT_MAP = {
  landscape: "LANDSCAPE_16_9",
  portrait: "PORTRAIT_9_16",
  youtube: "LANDSCAPE_16_9",
  instagram: "PORTRAIT_9_16",
} as const;

type FormatKey = keyof typeof FORMAT_MAP;

function resolveFormat(raw: string | null): (typeof FORMAT_MAP)[FormatKey] | null {
  if (!raw) return null;
  const key = raw.toLowerCase() as FormatKey;
  return FORMAT_MAP[key] ?? null;
}

async function getVideoFile(projectId: string, formatParam: string | null) {
  const format = resolveFormat(formatParam);
  if (!format) return null;

  const render = await db.render.findFirst({
    where: { projectId, format, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
  });

  if (!render?.filePath) return null;

  const absPath = path.resolve(render.filePath);
  const projectRoot = path.resolve(getOutputDir(), projectId);
  const relative = path.relative(projectRoot, absPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  try {
    await stat(absPath);
    return absPath;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const formatParam = searchParams.get("format");
  const download = searchParams.get("download") === "1";

  const filePath = await getVideoFile(id, formatParam);
  if (!filePath) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const fileStat = await stat(filePath);
  const filename = path.basename(filePath);
  const stream = createReadStream(filePath);

  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Content-Length": String(fileStat.size),
    "Accept-Ranges": "bytes",
  };

  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  } else {
    headers["Content-Disposition"] = `inline; filename="${filename}"`;
  }

  return new NextResponse(stream as unknown as BodyInit, { headers });
}
