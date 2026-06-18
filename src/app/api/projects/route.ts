import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeTargetDurationMin } from "@/lib/video-length";

const createSchema = z.object({
  topic: z.string().min(3).max(500),
  title: z.string().min(1).max(120).optional(),
  targetDurationMin: z.coerce.number().int().optional(),
});

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      scenes: { orderBy: { order: "asc" } },
      renders: true,
      _count: { select: { scenes: true } },
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { topic, title, targetDurationMin } = parsed.data;

    const project = await db.project.create({
      data: {
        topic,
        title: title ?? topic.slice(0, 80),
        targetDurationMin: normalizeTargetDurationMin(targetDurationMin),
        status: "DRAFT",
      },
      include: {
        scenes: { orderBy: { order: "asc" } },
        renders: true,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    const message =
      error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
