import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadToYouTube } from "@/lib/publish/youtube";
import { uploadToInstagramReel } from "@/lib/publish/instagram";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

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

  const youtube = await uploadToYouTube({
    filePath: landscape.filePath,
    title: project.title,
    description: project.script ?? project.topic,
  });

  const instagram = await uploadToInstagramReel(
    portrait.filePath,
    `${project.title}\n\n${project.topic}`,
  );

  await db.publishJob.createMany({
    data: [
      {
        projectId: id,
        platform: "YOUTUBE",
        status: "PENDING",
      },
      {
        projectId: id,
        platform: "INSTAGRAM",
        status: "PENDING",
      },
    ],
  });

  return NextResponse.json({
    youtube,
    instagram,
    note: "Publish stubs — OAuth integration coming in Phase 2.",
  });
}
