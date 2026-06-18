import path from "node:path";
import { mkdir } from "node:fs/promises";
import { db } from "@/lib/db";
import { generateSceneVoice, hasVoiceApiKey } from "@/lib/ai/generate-voice";
import { generateProjectMetadata } from "@/lib/ai/generate-metadata";
import { computeScrollScore } from "@/lib/ai/scroll-score";
import { mapWithConcurrency } from "@/lib/concurrency";
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
  fileExists,
} from "@/lib/media/ffmpeg";
import { generateThumbnail } from "@/lib/media/thumbnail";
import { generateShortClips } from "@/lib/media/shorts";
import {
  hasStockApiKeys,
  searchStockVideoWithFallback,
} from "@/lib/media/stock";
import type { CompositingLayout } from "@/generated/prisma/client";
import type { RenderResult } from "@/lib/types";

const TTS_CONCURRENCY = 5;
const SCENE_CONCURRENCY = 3;

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

function pickCreatorAsset(
  creatorAssets: { order: number; filePath: string; type: "IMAGE" | "VIDEO" }[],
  scene: { assetOrder: number | null; order: number; isHook: boolean },
) {
  if (creatorAssets.length === 0 || scene.isHook) return null;
  if (scene.assetOrder != null) {
    const match = creatorAssets.find((a) => a.order === scene.assetOrder);
    if (match) return match;
  }
  return creatorAssets[scene.order % creatorAssets.length] ?? null;
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

  const resumeRender =
    project.status === "FAILED" && project.scenes.some((s) => s.clipReady);

  if (!resumeRender) {
    await db.scene.updateMany({
      where: { projectId },
      data: { clipReady: false },
    });
    for (const scene of project.scenes) {
      scene.clipReady = false;
    }
  }

  const layout = project.compositingLayout as CompositingLayout;
  const outputDir = path.join(getOutputDir(), projectId);
  const workDir = path.join(outputDir, "work");
  await mkdir(workDir, { recursive: true });

  const landscapePath = path.join(outputDir, "youtube_16x9.mp4");
  const portraitPath = path.join(outputDir, "instagram_9x16.mp4");
  const thumbnailPath = path.join(outputDir, "thumbnail.jpg");
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
    const usedStockUrls = new Set<string>();

    if (hasStockApiKeys()) {
      if (!hasVoiceApiKey()) {
        throw new Error(
          "AI voiceover requires OPENAI_API_KEY in .env (same key used for scripts). Add it and restart the dev server.",
        );
      }

      const total = project.scenes.length;
      const creatorAssets = project.assets;

      const scenesNeedingWork = [];
      for (const scene of project.scenes) {
        const clipPath = path.join(workDir, `scene_${scene.order}.mp4`);
        if (scene.clipReady && (await fileExists(clipPath))) {
          continue;
        }
        scenesNeedingWork.push(scene);
      }

      if (scenesNeedingWork.length > 0) {
        await setRenderProgress(
          projectId,
          3,
          scenesNeedingWork.length < total
            ? `Resuming — ${scenesNeedingWork.length} scenes left…`
            : `Finding stock footage for ${total} scenes…`,
        );
      }

      const stockByScene = new Map<string, string>();
      for (const scene of scenesNeedingWork) {
        try {
          const stock = await searchStockVideoWithFallback(
            scene.keywords || project.topic,
            project.topic,
            usedStockUrls,
            scene.text,
          );
          usedStockUrls.add(stock.url);
          stockByScene.set(scene.id, stock.url);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Stock search failed";
          await db.scene.update({
            where: { id: scene.id },
            data: { error: message },
          });
          throw err;
        }
      }

      const scenesNeedingVoice: typeof scenesNeedingWork = [];
      for (const scene of scenesNeedingWork) {
        const voicePath = path.join(workDir, `voice_${scene.order}.mp3`);
        if (!scene.voiceUrl || !(await fileExists(voicePath))) {
          scenesNeedingVoice.push(scene);
        }
      }

      if (scenesNeedingVoice.length > 0) {
        await setRenderProgress(
          projectId,
          8,
          `Generating voiceovers (${scenesNeedingVoice.length} scenes)…`,
        );

        let ttsDone = 0;
        await mapWithConcurrency(
          scenesNeedingVoice,
          TTS_CONCURRENCY,
          async (scene) => {
            const voicePath = path.join(workDir, `voice_${scene.order}.mp3`);
            await generateSceneVoice(scene.text, voicePath);
            ttsDone += 1;
            const pct = 8 + Math.round((ttsDone / total) * 22);
            await setRenderProgress(
              projectId,
              pct,
              `Voiceover ${ttsDone}/${scenesNeedingVoice.length} ready…`,
            );
            return voicePath;
          },
        );
      }

      let scenesDone = project.scenes.length - scenesNeedingWork.length;
      await mapWithConcurrency(
        scenesNeedingWork,
        SCENE_CONCURRENCY,
        async (scene) => {
          const sceneNum = scene.order + 1;
          const stockUrl = stockByScene.get(scene.id)!;
          const creatorAsset = pickCreatorAsset(creatorAssets, scene);

          const rawPath = path.join(workDir, `raw_${scene.order}.mp4`);
          const voicePath = path.join(workDir, `voice_${scene.order}.mp3`);
          const clipPath = path.join(workDir, `scene_${scene.order}.mp4`);
          const baseClipPath = path.join(workDir, `base_${scene.order}.mp4`);

          console.log(`[render] Scene ${sceneNum}/${total}: downloading…`);
          await downloadToFile(stockUrl, rawPath);

          const voiceDuration = await getMediaDuration(voicePath);
          const clipDuration = Math.max(scene.durationSec, voiceDuration + 0.25);

          console.log(`[render] Scene ${sceneNum}/${total}: processing clip…`);
          await prepareSceneClip(
            rawPath,
            baseClipPath,
            clipDuration,
            scene.text,
            voicePath,
            {
              isHook: scene.isHook,
              captionDurationSec: voiceDuration,
            },
          );

          if (creatorAsset) {
            await overlayCreatorMedia(
              baseClipPath,
              creatorAsset.filePath,
              creatorAsset.type,
              clipPath,
              clipDuration,
              layout,
            );
          } else {
            await copyFinal(baseClipPath, clipPath);
          }

          await db.scene.update({
            where: { id: scene.id },
            data: {
              clipUrl: stockUrl,
              voiceUrl: voicePath,
              error: null,
              clipReady: true,
            },
          });

          scenesDone += 1;
          const pct = 30 + Math.round((scenesDone / total) * 48);
          await setRenderProgress(
            projectId,
            pct,
            `Building scene ${scenesDone}/${total}…`,
          );
        },
      );

      const sceneOutputPaths = project.scenes.map((scene) =>
        path.join(workDir, `scene_${scene.order}.mp4`),
      );

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

    const durationSec = await getMediaDuration(landscapePath);

    await setRenderProgress(projectId, 93, "Creating thumbnail…");
    try {
      await generateThumbnail(landscapePath, thumbnailPath, project.title);
    } catch (err) {
      console.warn("[render] Thumbnail skipped:", err);
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

    await setRenderProgress(projectId, 97, "Generating Shorts clips…");
    try {
      await db.shortClip.deleteMany({ where: { projectId } });
      const shorts = await generateShortClips(
        landscapePath,
        path.join(workDir, "shorts"),
        project.scenes,
      );
      if (shorts.length > 0) {
        await db.shortClip.createMany({
          data: shorts.map((s) => ({
            projectId,
            order: s.order,
            title: s.title,
            filePath: s.filePath,
            startSec: s.startSec,
            endSec: s.endSec,
          })),
        });
      }
    } catch (err) {
      console.warn("[render] Shorts generation skipped:", err);
    }

    const scrollScore = computeScrollScore({
      hook: project.hook,
      scenes: project.scenes,
      targetDurationMin: project.targetDurationMin,
    });

    let metadata = {
      youtubeTitle: project.youtubeTitle,
      youtubeDescription: project.youtubeDescription,
      youtubeTags: project.youtubeTags,
      instagramCaption: project.instagramCaption,
    };

    try {
      const generated = await generateProjectMetadata({
        title: project.title,
        topic: project.topic,
        hook: project.hook,
        script: project.script,
      });
      metadata = generated;
    } catch (err) {
      console.warn("[render] Metadata generation skipped:", err);
    }

    await db.project.update({
      where: { id: projectId },
      data: {
        status: "RENDERED",
        renderProgress: 100,
        renderStep: "Complete",
        lastRenderError: null,
        thumbnailPath,
        durationSec,
        scrollScoreJson: JSON.stringify(scrollScore),
        youtubeTitle: metadata.youtubeTitle,
        youtubeDescription: metadata.youtubeDescription,
        youtubeTags: metadata.youtubeTags,
        instagramCaption: metadata.instagramCaption,
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
