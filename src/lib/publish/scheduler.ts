import { db } from "@/lib/db";
import { uploadToYouTube } from "@/lib/publish/youtube";
import { uploadToInstagramReel } from "@/lib/publish/instagram";
import { metadataFromProject } from "@/lib/ai/generate-metadata";

export async function runScheduledPublish(projectId: string): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { renders: true },
  });
  if (!project) return;

  const landscape = project.renders.find(
    (r) => r.format === "LANDSCAPE_16_9" && r.status === "COMPLETED",
  );
  const portrait = project.renders.find(
    (r) => r.format === "PORTRAIT_9_16" && r.status === "COMPLETED",
  );

  if (!landscape?.filePath || !portrait?.filePath) return;

  const meta = metadataFromProject(project);
  await executePublish(projectId, landscape.filePath, portrait.filePath, meta);
}

export async function executePublish(
  projectId: string,
  landscapePath: string,
  portraitPath: string,
  meta: {
    youtubeTitle: string;
    youtubeDescription: string;
    youtubeTags: string;
    instagramCaption: string;
  },
) {
  const youtube = await uploadToYouTube({
    filePath: landscapePath,
    title: meta.youtubeTitle,
    description: meta.youtubeDescription,
    tags: meta.youtubeTags,
  });

  const instagram = await uploadToInstagramReel(
    portraitPath,
    meta.instagramCaption,
  );

  await db.publishJob.create({
    data: {
      projectId,
      platform: "YOUTUBE",
      status:
        youtube.status === "completed"
          ? "COMPLETED"
          : youtube.status === "failed"
            ? "FAILED"
            : "PENDING",
      remoteId: youtube.remoteId ?? null,
      error: youtube.status === "failed" ? youtube.message : null,
    },
  });

  await db.publishJob.create({
    data: {
      projectId,
      platform: "INSTAGRAM",
      status:
        instagram.status === "completed"
          ? "COMPLETED"
          : instagram.status === "failed"
            ? "FAILED"
            : "PENDING",
      remoteId: instagram.remoteId ?? null,
      error: instagram.status === "failed" ? instagram.message : null,
    },
  });

  if (youtube.status === "completed" || instagram.status === "completed") {
    await db.project.update({
      where: { id: projectId },
      data: { status: "PUBLISHED" },
    });
  }

  return { youtube, instagram };
}
