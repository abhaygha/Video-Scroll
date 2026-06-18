import path from "node:path";
import { mkdir } from "node:fs/promises";
import { db } from "@/lib/db";
import { generateSceneVoice, hasVoiceApiKey } from "@/lib/ai/generate-voice";
import { downloadToFile } from "@/lib/media/download";
import {
  checkFfmpeg,
  cropToPortrait,
  getOutputDir,
  getMediaDuration,
  prepareSceneClip,
  concatVideos,
  normalizeVideoAudio,
  mixBackgroundMusic,
  overlayCreatorMedia,
} from "@/lib/media/ffmpeg";
import {
  hasStockApiKeys,
  searchStockVideoWithFallback,
} from "@/lib/media/stock";
import type { RenderResult } from "@/lib/types";

async function setRenderProgress(
  projectId: string,
  progress: number,
  step: string,
): Promise<void> {
  await db.project.update({
    where: { id: projectId },
    data: {
      renderProgress: Math.min(100, Math.max(0, Math.round(progress))),
      renderStep: step,
      lastRenderError: null,
    },
  });
}

export async function renderProject(projectId: string): Promise<RenderResult> {
  const ffmpegOk = await checkFfmpeg();
  if (!ffmpegOk) {
    throw new Error(
      "FFmpeg not found. Install FFmpeg and restart your terminal.",
    );
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { order: "asc" } },
      assets: { orderBy: { order: "asc" } },
    },
  });

  if (!project || project.scenes.length === 0) {
    throw new Error("Project has no scenes to render.");
  }

  const outputDir = path.join(getOutputDir(), projectId);
  const workDir = path.join(outputDir, "work");
  await mkdir(workDir, { recursive: true });

  const landscapePath = path.join(outputDir, "youtube_16x9.mp4");
  const portraitPath = path.join(outputDir, "instagram_9x16.mp4");
  const mergedPath = path.join(workDir, "merged.mp4");
  const finalPath = path.join(workDir, "final.mp4");
  const finalWithMusicPath = path.join(workDir, "final_music.mp4");

  await db.project.update({
    where: { id: projectId },
    data: {
      status: "RENDERING",
      renderProgress: 0,
      renderStep: "Starting…",
      lastRenderError: null,
    },
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
    const usedStockUrls = new Set<string>();

    if (hasStockApiKeys()) {
      if (!hasVoiceApiKey()) {
        throw new Error(
          "AI voiceover requires OPENAI_API_KEY in .env (same key used for scripts). Add it and restart the dev server.",
        );
      }

      const total = project.scenes.length;
      const creatorAssets = project.assets;

      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        const sceneNum = i + 1;
        const baseProgress = 5 + (i / total) * 70;
        const creatorAsset =
          creatorAssets.length > 0 && !scene.isHook
            ? creatorAssets[(sceneNum - 1) % creatorAssets.length]
            : null;

        await setRenderProgress(
          projectId,
          baseProgress,
          `Scene ${sceneNum}/${total}: finding stock footage…`,
        );

        console.log(
          `[render] Scene ${sceneNum}/${total}: searching "${scene.keywords}"`,
        );

        let stock;
        try {
          stock = await searchStockVideoWithFallback(
            scene.keywords || project.topic,
            project.topic,
            usedStockUrls,
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Stock search failed";
          await db.scene.update({
            where: { id: scene.id },
            data: { error: message },
          });
          throw err;
        }

        usedStockUrls.add(stock.url);

        const rawPath = path.join(workDir, `raw_${scene.order}.mp4`);
        const voicePath = path.join(workDir, `voice_${scene.order}.mp3`);
        const clipPath = path.join(workDir, `scene_${scene.order}.mp4`);
        const baseClipPath = path.join(workDir, `base_${scene.order}.mp4`);

        await setRenderProgress(
          projectId,
          baseProgress + 3,
          `Scene ${sceneNum}/${total}: downloading clip…`,
        );
        console.log(`[render] Scene ${sceneNum}/${total}: downloading…`);
        await downloadToFile(stock.url, rawPath);

        await setRenderProgress(
          projectId,
          baseProgress + 8,
          `Scene ${sceneNum}/${total}: generating voiceover…`,
        );
        console.log(`[render] Scene ${sceneNum}/${total}: generating voiceover…`);
        await generateSceneVoice(scene.text, voicePath);
        const voiceDuration = await getMediaDuration(voicePath);
        const clipDuration = Math.max(scene.durationSec, voiceDuration + 0.25);

        await setRenderProgress(
          projectId,
          baseProgress + 12,
          creatorAsset
            ? `Scene ${sceneNum}/${total}: adding you to the scene…`
            : `Scene ${sceneNum}/${total}: adding captions…`,
        );
        console.log(`[render] Scene ${sceneNum}/${total}: processing clip…`);
        await prepareSceneClip(
          rawPath,
          baseClipPath,
          clipDuration,
          scene.text,
          voicePath,
          { isHook: scene.isHook },
        );

        if (creatorAsset) {
          await overlayCreatorMedia(
            baseClipPath,
            creatorAsset.filePath,
            creatorAsset.type,
            clipPath,
            clipDuration,
          );
        } else {
          await copyFinal(baseClipPath, clipPath);
        }

        await db.scene.update({
          where: { id: scene.id },
          data: { clipUrl: stock.url, voiceUrl: voicePath, error: null },
        });

        sceneOutputPaths.push(clipPath);
      }

      await setRenderProgress(projectId, 78, "Merging scenes…");
      const concatListPath = path.join(workDir, "concat.txt");
      console.log("[render] Merging scenes…");
      await concatVideos(sceneOutputPaths, mergedPath, concatListPath);

      await setRenderProgress(projectId, 86, "Normalizing audio…");
      console.log("[render] Normalizing audio…");
      await normalizeVideoAudio(mergedPath, finalPath);

      const musicUrl = process.env.BACKGROUND_MUSIC_URL?.trim();
      if (musicUrl) {
        const musicPath = path.join(workDir, "background_music.mp3");
        await setRenderProgress(projectId, 92, "Adding background music…");
        console.log("[render] Adding background music…");
        try {
          await downloadToFile(musicUrl, musicPath);
          await mixBackgroundMusic(finalPath, musicPath, finalWithMusicPath);
          await copyFinal(finalWithMusicPath, landscapePath);
        } catch (err) {
          console.warn("[render] Background music skipped:", err);
          await copyFinal(finalPath, landscapePath);
        }
      } else {
        await copyFinal(finalPath, landscapePath);
      }
    } else {
      throw new Error(
        "Stock footage requires a free API key. Add PEXELS_API_KEY (https://www.pexels.com/api/) and/or PIXABAY_API_KEY (https://pixabay.com/api/docs/) to your .env file, then restart the dev server.",
      );
    }

    await setRenderProgress(projectId, 95, "Creating Instagram version…");

    await db.render.update({
      where: { id: landscapeJob.id },
      data: { status: "COMPLETED", filePath: landscapePath, error: null },
    });

    await db.render.update({
      where: { id: portraitJob.id },
      data: { status: "PROCESSING" },
    });

    await cropToPortrait(landscapePath, portraitPath);

    await db.render.update({
      where: { id: portraitJob.id },
      data: { status: "COMPLETED", filePath: portraitPath, error: null },
    });

    await db.project.update({
      where: { id: projectId },
      data: {
        status: "RENDERED",
        renderProgress: 100,
        renderStep: "Complete",
        lastRenderError: null,
      },
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
      data: {
        status: "FAILED",
        lastRenderError: message,
        renderStep: "Failed",
      },
    });

    throw error;
  }
}

async function copyFinal(src: string, dest: string): Promise<void> {
  const { copyFile } = await import("node:fs/promises");
  await copyFile(src, dest);
}
