import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MAX_FILES, saveUploadFile } from "@/lib/media/assets";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const assets = await db.projectAsset.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ assets });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const existing = await db.projectAsset.count({ where: { projectId: id } });
  if (existing >= MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} photos/videos per project.` },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  try {
    const saved = await saveUploadFile(id, file);
    const asset = await db.projectAsset.create({
      data: {
        projectId: id,
        type: saved.type,
        fileName: saved.fileName,
        filePath: saved.filePath,
        mimeType: saved.mimeType,
        order: existing,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId");

  if (!assetId) {
    return NextResponse.json({ error: "assetId required" }, { status: 400 });
  }

  const asset = await db.projectAsset.findFirst({
    where: { id: assetId, projectId: id },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  await db.projectAsset.delete({ where: { id: assetId } });
  return NextResponse.json({ ok: true });
}
