import { NextResponse } from "next/server";
import { renderProject } from "@/lib/media/render";
import { db } from "@/lib/db";

export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const project = await db.project.findUnique({
    where: { id },
    include: { scenes: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.scenes.length === 0) {
    return NextResponse.json(
      { error: "Generate a script before rendering." },
      { status: 400 },
    );
  }

  try {
    const result = await renderProject(id);

    const updated = await db.project.findUnique({
      where: { id },
      include: {
        scenes: { orderBy: { order: "asc" } },
        renders: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ project: updated, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
