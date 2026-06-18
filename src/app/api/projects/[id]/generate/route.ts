import { NextResponse } from "next/server";
import { generateScript, normalizeKeywords } from "@/lib/ai/generate-script";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await db.project.update({
    where: { id },
    data: { status: "GENERATING" },
  });

  try {
    const generated = await generateScript(project.topic);

    await db.scene.deleteMany({ where: { projectId: id } });

    await db.project.update({
      where: { id },
      data: {
        title: generated.title,
        script: generated.script,
        status: "READY",
        scenes: {
          create: generated.scenes.map((scene) => ({
            order: scene.order,
            text: scene.text,
            keywords: normalizeKeywords(scene.keywords),
            durationSec: scene.durationSec,
          })),
        },
      },
    });

    const updated = await db.project.findUnique({
      where: { id },
      include: {
        scenes: { orderBy: { order: "asc" } },
        renders: true,
      },
    });

    return NextResponse.json({
      project: updated,
      demoMode: !process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    await db.project.update({
      where: { id },
      data: { status: "FAILED" },
    });

    const message =
      error instanceof Error ? error.message : "Script generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
