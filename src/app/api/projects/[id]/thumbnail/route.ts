import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project?.thumbnailPath) {
    return NextResponse.json({ error: "No thumbnail" }, { status: 404 });
  }

  try {
    await access(project.thumbnailPath);
    const buf = await readFile(project.thumbnailPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Thumbnail file missing" }, { status: 404 });
  }
}
