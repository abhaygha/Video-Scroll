import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  hasStockApiKeys,
  previewStockForScene,
  suggestKeywordsFromScene,
} from "@/lib/media/stock";

type RouteContext = { params: Promise<{ id: string; sceneId: string }> };

const bodySchema = z.object({
  text: z.string().optional(),
  keywords: z.string().optional(),
});

async function handlePreview(
  scene: { text: string; keywords: string; project: { topic: string } },
) {
  const suggestedKeywords = suggestKeywordsFromScene(
    scene.text,
    scene.project.topic,
  );

  const previews = await previewStockForScene({
    sceneKeywords: scene.keywords,
    topic: scene.project.topic,
    sceneText: scene.text,
    limit: 6,
  });

  const flat = previews.flatMap((p) =>
    p.results.map((r) => ({ ...r, query: p.query })),
  );

  return NextResponse.json({
    suggestedKeywords,
    previews: flat.slice(0, 6),
    queriesTried: previews.map((p) => p.query),
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id, sceneId } = await context.params;

  if (!hasStockApiKeys()) {
    return NextResponse.json(
      { error: "Add PEXELS_API_KEY or PIXABAY_API_KEY to .env" },
      { status: 503 },
    );
  }

  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId: id },
    include: { project: true },
  });

  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  return handlePreview(scene);
}

export async function POST(request: Request, context: RouteContext) {
  const { id, sceneId } = await context.params;

  if (!hasStockApiKeys()) {
    return NextResponse.json(
      { error: "Add PEXELS_API_KEY or PIXABAY_API_KEY to .env" },
      { status: 503 },
    );
  }

  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId: id },
    include: { project: true },
  });

  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  let overrides: z.infer<typeof bodySchema> = {};
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) overrides = parsed.data;
  } catch {
    // use saved scene values
  }

  return handlePreview({
    text: overrides.text ?? scene.text,
    keywords: overrides.keywords ?? scene.keywords,
    project: scene.project,
  });
}
