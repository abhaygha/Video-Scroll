import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeTargetDurationMin } from "@/lib/video-length";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  targetDurationMin: z.coerce.number().int().optional(),
  title: z.string().min(1).max(120).optional(),
  compositingLayout: z
    .enum(["PIP_CORNER", "PIP_LARGE", "SPLIT_BOTTOM"])
    .optional(),
  youtubeTitle: z.string().max(100).optional(),
  youtubeDescription: z.string().max(5000).optional(),
  youtubeTags: z.string().max(500).optional(),
  instagramCaption: z.string().max(2200).optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      renders: { orderBy: { createdAt: "desc" } },
      publishes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.targetDurationMin !== undefined) {
    data.targetDurationMin = normalizeTargetDurationMin(
      parsed.data.targetDurationMin,
    );
  }
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.compositingLayout !== undefined) {
    data.compositingLayout = parsed.data.compositingLayout;
  }
  if (parsed.data.youtubeTitle !== undefined) {
    data.youtubeTitle = parsed.data.youtubeTitle;
  }
  if (parsed.data.youtubeDescription !== undefined) {
    data.youtubeDescription = parsed.data.youtubeDescription;
  }
  if (parsed.data.youtubeTags !== undefined) {
    data.youtubeTags = parsed.data.youtubeTags;
  }
  if (parsed.data.instagramCaption !== undefined) {
    data.instagramCaption = parsed.data.instagramCaption;
  }

  const project = await db.project.update({
    where: { id },
    data,
    include: {
      scenes: { orderBy: { order: "asc" } },
      renders: { orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  await db.project.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
