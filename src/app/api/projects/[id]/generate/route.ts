import { NextResponse } from "next/server";
import { generateScript, normalizeKeywords } from "@/lib/ai/generate-script";
import { computeScrollScore } from "@/lib/ai/scroll-score";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const project = await db.project.findUnique({
    where: { id },
    include: { assets: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await db.project.update({
    where: { id },
    data: { status: "GENERATING" },
  });

  try {
    const generated = await generateScript(
      project.topic,
      project.targetDurationMin,
      project.assets.length,
    );

    await db.scene.deleteMany({ where: { projectId: id } });

    const scrollScore = computeScrollScore({
      hook: generated.hook,
      scenes: generated.scenes.map((s) => ({
        text: s.text,
        durationSec: s.durationSec,
        isHook: s.isHook ?? false,
      })),
      targetDurationMin: generated.effectiveDurationMin,
    });

    await db.project.update({
      where: { id },
      data: {
        title: generated.title,
        script: generated.script,
        hook: generated.hook,
        targetDurationMin: generated.effectiveDurationMin,
        status: "READY",
        lastRenderError: null,
        renderProgress: 0,
        renderStep: null,
        scrollScoreJson: JSON.stringify(scrollScore),
        scenes: {
          create: generated.scenes.map((scene, index) => ({
            order: scene.order,
            text: scene.text,
            keywords: normalizeKeywords(scene.keywords),
            durationSec: scene.durationSec,
            isHook: scene.isHook ?? index === 0,
            assetOrder: scene.assetOrder ?? null,
            clipReady: false,
          })),
        },
      },
    });

    const updated = await db.project.findUnique({
      where: { id },
      include: {
        scenes: { orderBy: { order: "asc" } },
        renders: true,
        assets: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({
      project: updated,
      scrollScore,
      placeCount: generated.scenes.length - 2,
      effectiveDurationMin: generated.effectiveDurationMin,
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
