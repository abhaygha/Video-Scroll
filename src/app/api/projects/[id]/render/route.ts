import { NextResponse } from "next/server";
import { renderProject } from "@/lib/media/render";
import { db } from "@/lib/db";

export const maxDuration = 900;

type RouteContext = { params: Promise<{ id: string }> };

function latestCompletedRender(
  renders: { format: string; status: string; filePath: string | null; error: string | null; createdAt: Date }[],
  format: string,
) {
  return renders.find((r) => r.format === format && r.status === "COMPLETED" && r.filePath);
}

function latestFailedRender(
  renders: { format: string; status: string; error: string | null; createdAt: Date }[],
  format: string,
) {
  return renders.find((r) => r.format === format && r.status === "FAILED");
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      renders: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: project.status,
    progress: project.renderProgress,
    step: project.renderStep,
    error: project.lastRenderError,
    hook: project.hook,
    landscape: latestCompletedRender(project.renders, "LANDSCAPE_16_9"),
    portrait: latestCompletedRender(project.renders, "PORTRAIT_9_16"),
    lastFailure: latestFailedRender(project.renders, "LANDSCAPE_16_9"),
    sceneErrors: project.scenes
      .filter((s) => s.error)
      .map((s) => ({ order: s.order, error: s.error })),
  });
}

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

  if (project.status === "RENDERING") {
    return NextResponse.json(
      { error: "Render already in progress.", progress: project.renderProgress },
      { status: 409 },
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
