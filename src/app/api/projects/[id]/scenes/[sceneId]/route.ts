import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeKeywords } from "@/lib/ai/generate-script";
import { clampSceneDuration } from "@/lib/video-length";

type RouteContext = { params: Promise<{ id: string; sceneId: string }> };

const patchSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  keywords: z.string().min(1).max(200).optional(),
  durationSec: z.coerce.number().min(2).max(60).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { id, sceneId } = await context.params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId: id },
    include: { project: true },
  });

  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  const data: {
    text?: string;
    keywords?: string;
    durationSec?: number;
    clipReady: boolean;
  } = { clipReady: false };

  if (parsed.data.text !== undefined) data.text = parsed.data.text.trim();
  if (parsed.data.keywords !== undefined) {
    data.keywords = normalizeKeywords(parsed.data.keywords);
  }
  if (parsed.data.durationSec !== undefined) {
    data.durationSec = clampSceneDuration(
      parsed.data.durationSec,
      scene.project.targetDurationMin,
    );
  }

  const updated = await db.scene.update({
    where: { id: sceneId },
    data,
  });

  return NextResponse.json({ scene: updated });
}
