import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { executePublish } from "@/lib/publish/scheduler";
import { metadataFromProject } from "@/lib/ai/generate-metadata";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  youtubeTitle: z.string().optional(),
  youtubeDescription: z.string().optional(),
  youtubeTags: z.string().optional(),
  instagramCaption: z.string().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: z.infer<typeof bodySchema> = {};
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) body = parsed.data;
  } catch {
    // empty body ok
  }

  const project = await db.project.findUnique({
    where: { id },
    include: { renders: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const landscape = project.renders.find(
    (r) => r.format === "LANDSCAPE_16_9" && r.status === "COMPLETED",
  );
  const portrait = project.renders.find(
    (r) => r.format === "PORTRAIT_9_16" && r.status === "COMPLETED",
  );

  if (!landscape?.filePath || !portrait?.filePath) {
    return NextResponse.json(
      { error: "Render videos before publishing." },
      { status: 400 },
    );
  }

  if (body.youtubeTitle || body.instagramCaption) {
    await db.project.update({
      where: { id },
      data: {
        youtubeTitle: body.youtubeTitle ?? project.youtubeTitle,
        youtubeDescription:
          body.youtubeDescription ?? project.youtubeDescription,
        youtubeTags: body.youtubeTags ?? project.youtubeTags,
        instagramCaption: body.instagramCaption ?? project.instagramCaption,
      },
    });
  }

  const updatedProject = await db.project.findUnique({ where: { id } });
  const meta = metadataFromProject(updatedProject ?? project);

  if (body.scheduledAt) {
    const scheduledAt = new Date(body.scheduledAt);
    await db.project.update({
      where: { id },
      data: { scheduledPublishAt: scheduledAt },
    });

    await db.publishJob.createMany({
      data: [
        {
          projectId: id,
          platform: "YOUTUBE",
          status: "SCHEDULED",
          scheduledAt,
        },
        {
          projectId: id,
          platform: "INSTAGRAM",
          status: "SCHEDULED",
          scheduledAt,
        },
      ],
    });

    return NextResponse.json({
      scheduled: true,
      scheduledAt: scheduledAt.toISOString(),
      message: `Publish scheduled for ${scheduledAt.toLocaleString()}. Run the worker or call POST /api/publish/run-due to process.`,
    });
  }

  const { youtube, instagram } = await executePublish(
    id,
    landscape.filePath,
    portrait.filePath,
    meta,
  );

  return NextResponse.json({ youtube, instagram });
}
