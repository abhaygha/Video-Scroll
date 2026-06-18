import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeTargetDurationMin } from "@/lib/video-length";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  targetDurationMin: z.coerce.number().int().optional(),
  title: z.string().min(1).max(120).optional(),
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

  const data: { targetDurationMin?: number; title?: string } = {};
  if (parsed.data.targetDurationMin !== undefined) {
    data.targetDurationMin = normalizeTargetDurationMin(
      parsed.data.targetDurationMin,
    );
  }
  if (parsed.data.title !== undefined) {
    data.title = parsed.data.title;
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
