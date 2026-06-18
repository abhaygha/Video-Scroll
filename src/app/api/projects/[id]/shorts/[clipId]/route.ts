import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id, clipId } = await context.params;

  const clip = await db.shortClip.findFirst({
    where: { id: clipId, projectId: id },
  });

  if (!clip?.filePath) {
    return NextResponse.json({ error: "Short clip not found" }, { status: 404 });
  }

  try {
    await access(clip.filePath);
    const buf = await readFile(clip.filePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
