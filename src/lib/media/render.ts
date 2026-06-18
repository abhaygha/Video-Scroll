import path from "node:path";
import { mkdir } from "node:fs/promises";
import { db } from "@/lib/db";
import { downloadToFile } from "@/lib/media/download";
import {
  checkFfmpeg,
  cropToPortrait,
  getOutputDir,
  prepareSceneClip,
  concatVideos,
  normalizeVideoAudio,
} from "@/lib/media/ffmpeg";
import {
  hasStockApiKeys,
  searchStockVideoUrl,
} from "@/lib/media/stock";
import type { RenderResult } from "@/lib/types";

export async function renderProject(projectId: string): Promise<RenderResult> {
  const ffmpegOk = await checkFfmpeg();
  if (!ffmpegOk) {
    throw new Error(
      "FFmpeg not found. Install FFmpeg and restart your terminal.",
    );
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { scenes: { orderBy: { order: "asc" } } },
  });

  if (!project || project.scenes.length === 0) {
    throw new Error("Project has no scenes to render.");
  }

  const outputDir = path.join(getOutputDir(), projectId);
  const workDir = path.join(outputDir, "work");
  await mkdir(workDir, { recursive: true });

  const totalDuration = project.scenes.reduce(
    (sum, s) => sum + s.durationSec,
    0,
  );

  const landscapePath = path.join(outputDir, "youtube_16x9.mp4");
  const portraitPath = path.join(outputDir, "instagram_9x16.mp4");
  const mergedPath = path.join(workDir, "merged.mp4");
  const finalPath = path.join(workDir, "final.mp4");

  await db.project.update({
    where: { id: projectId },
    data: { status: "RENDERING" },
  });

  const landscapeJob = await db.render.create({
    data: {
      projectId,
      format: "LANDSCAPE_16_9",
      status: "PROCESSING",
    },
  });

  const portraitJob = await db.render.create({
    data: {
      projectId,
      format: "PORTRAIT_9_16",
      status: "PENDING",
    },
  });

  try {
    const sceneOutputPaths: string[] = [];

    if (hasStockApiKeys()) {
      const total = project.scenes.length;
      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        console.log(
          `[render] Scene ${i + 1}/${total}: searching "${scene.keywords}"`,
        );

        const stock = await searchStockVideoUrl(scene.keywords || project.topic);
        if (!stock) {
          throw new Error(
            `No stock video found for scene ${scene.order + 1} ("${scene.keywords}"). Try different keywords or check API keys.`,
          );
        }

        const rawPath = path.join(workDir, `raw_${scene.order}.mp4`);
        const clipPath = path.join(workDir, `scene_${scene.order}.mp4`);

        console.log(`[render] Scene ${i + 1}/${total}: downloading…`);
        await downloadToFile(stock.url, rawPath);
        console.log(`[render] Scene ${i + 1}/${total}: processing clip…`);
        await prepareSceneClip(
          rawPath,
          clipPath,
          scene.durationSec,
          scene.text,
        );

        await db.scene.update({
          where: { id: scene.id },
          data: { clipUrl: stock.url },
        });

        sceneOutputPaths.push(clipPath);
      }

      const concatListPath = path.join(workDir, "concat.txt");
      console.log("[render] Merging scenes…");
      await concatVideos(sceneOutputPaths, mergedPath, concatListPath);
      console.log("[render] Normalizing audio…");
      await normalizeVideoAudio(mergedPath, finalPath);
      await copyFinal(finalPath, landscapePath);
    } else {
      throw new Error(
        "Stock footage requires a free API key. Add PEXELS_API_KEY (https://www.pexels.com/api/) and/or PIXABAY_API_KEY (https://pixabay.com/api/docs/) to your .env file, then restart the dev server.",
      );
    }

    await db.render.update({
      where: { id: landscapeJob.id },
      data: { status: "COMPLETED", filePath: landscapePath },
    });

    await db.render.update({
      where: { id: portraitJob.id },
      data: { status: "PROCESSING" },
    });

    await cropToPortrait(landscapePath, portraitPath);

    await db.render.update({
      where: { id: portraitJob.id },
      data: { status: "COMPLETED", filePath: portraitPath },
    });

    await db.project.update({
      where: { id: projectId },
      data: { status: "RENDERED" },
    });

    return { landscapePath, portraitPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";

    await db.render.updateMany({
      where: { projectId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", error: message },
    });

    await db.project.update({
      where: { id: projectId },
      data: { status: "FAILED" },
    });

    throw error;
  }
}

async function copyFinal(src: string, dest: string): Promise<void> {
  const { copyFile } = await import("node:fs/promises");
  await copyFile(src, dest);
}
