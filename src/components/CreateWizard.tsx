"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  VIDEO_LENGTH_OPTIONS,
  estimateRenderMinutes,
  isPlaceTopic,
  MIN_CITY_PLACES,
  type TargetDurationMin,
} from "@/lib/video-length";
import {
  CreatorAttachments,
  uploadPendingAssets,
  type AssetItem,
} from "@/components/CreatorAttachments";
import { LayoutPicker } from "@/components/LayoutPicker";
import { ScrollScoreBadge } from "@/components/ScrollScoreBadge";
import type { ScrollScore } from "@/lib/ai/scroll-score";
import { parseJsonResponse } from "@/lib/api-client";

type Step = "topic" | "script" | "render" | "publish";

type Scene = {
  id: string;
  order: number;
  text: string;
  keywords: string;
  durationSec: number;
  isHook?: boolean;
};

type Project = {
  id: string;
  title: string;
  topic: string;
  status: string;
  script: string | null;
  hook?: string | null;
  targetDurationMin?: number;
  compositingLayout?: "PIP_CORNER" | "PIP_LARGE" | "SPLIT_BOTTOM";
  youtubeTitle?: string | null;
  youtubeDescription?: string | null;
  youtubeTags?: string | null;
  instagramCaption?: string | null;
  durationSec?: number | null;
  scenes: Scene[];
  assets?: AssetItem[];
  renders: { format: string; status: string; filePath: string | null }[];
};

type ShortClip = {
  id: string;
  order: number;
  title: string | null;
  startSec: number;
  endSec: number;
};

const steps: { id: Step; label: string }[] = [
  { id: "topic", label: "Topic" },
  { id: "script", label: "Script" },
  { id: "render", label: "Render" },
  { id: "publish", label: "Publish" },
];

export function CreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState("");
  const [targetDurationMin, setTargetDurationMin] = useState<TargetDurationMin>(3);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishNote, setPublishNote] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStep, setRenderStep] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [layout, setLayout] = useState<"PIP_CORNER" | "PIP_LARGE" | "SPLIT_BOTTOM">("PIP_LARGE");
  const [scrollScore, setScrollScore] = useState<ScrollScore | null>(null);
  const [shortClips, setShortClips] = useState<ShortClip[]>([]);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [youtubeTags, setYoutubeTags] = useState("");
  const [instagramCaption, setInstagramCaption] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");

  async function createProject() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, targetDurationMin }),
      });
      const data = await parseJsonResponse<{
        project: Project;
        error?: string | { topic?: string[] };
      }>(res);
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : (data.error?.topic?.[0] ?? "Failed to create");
        throw new Error(msg);
      }

      let uploadedAssets: AssetItem[] = [];
      if (pendingFiles.length > 0) {
        uploadedAssets = await uploadPendingAssets(
          data.project.id,
          pendingFiles,
        );
        setPendingFiles([]);
      }

      setAssets(uploadedAssets);
      setProject({
        ...data.project,
        scenes: data.project.scenes ?? [],
        renders: data.project.renders ?? [],
        assets: uploadedAssets,
      });
      setStep("script");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function generateScript() {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      if (pendingFiles.length > 0) {
        const uploaded = await uploadPendingAssets(project.id, pendingFiles);
        setPendingFiles([]);
        setAssets((prev) => [...prev, ...uploaded]);
      }

      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDurationMin }),
      });

      const res = await fetch(`/api/projects/${project.id}/generate`, {
        method: "POST",
      });
      const data = await parseJsonResponse<{ project: Project; error?: string; scrollScore?: ScrollScore }>(res);
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      if (data.scrollScore) setScrollScore(data.scrollScore);
      setProject({
        ...data.project,
        scenes: data.project.scenes ?? [],
        renders: data.project.renders ?? [],
        assets,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function renderVideo() {
    if (!project) return;
    setLoading(true);
    setError(null);
    setStep("render");
    setRenderProgress(0);
    setRenderStep("Starting…");

    try {
      if (pendingFiles.length > 0) {
        const uploaded = await uploadPendingAssets(project.id, pendingFiles);
        setPendingFiles([]);
        setAssets((prev) => [...prev, ...uploaded]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setLoading(false);
      setStep("script");
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/projects/${project.id}/render`);
        if (!statusRes.ok) return;
        const statusData = await statusRes.json();
        setRenderProgress(statusData.progress ?? 0);
        setRenderStep(statusData.step ?? null);
      } catch {
        // ignore poll errors
      }
    }, 2000);

    try {
      const res = await fetch(`/api/projects/${project.id}/render`, {
        method: "POST",
      });
      const data = await parseJsonResponse<{
        project?: Project;
        error?: string;
        queued?: boolean;
        shortClips?: ShortClip[];
      }>(res);

      if (res.status === 202 || data.queued) {
        setRenderStep("Queued — worker processing (you can keep this tab open)…");
        await waitForRenderComplete(project.id);
        return;
      }

      if (!res.ok) throw new Error(data.error ?? "Render failed");
      setProject({
        ...data.project!,
        scenes: data.project!.scenes ?? [],
        renders: data.project!.renders ?? [],
      });
      await loadPublishMeta(project.id);
      setRenderProgress(100);
      setRenderStep("Complete");
      setStep("publish");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("render");
    } finally {
      clearInterval(pollInterval);
      setLoading(false);
    }
  }

  async function loadPublishMeta(projectId: string) {
    const statusRes = await fetch(`/api/projects/${projectId}/render`);
    if (!statusRes.ok) return;
    const statusData = await statusRes.json();
    if (statusData.scrollScore) setScrollScore(statusData.scrollScore);
    if (statusData.shortClips) setShortClips(statusData.shortClips);
    if (statusData.metadata) {
      setYoutubeTitle(statusData.metadata.youtubeTitle ?? "");
      setYoutubeDescription(statusData.metadata.youtubeDescription ?? "");
      setYoutubeTags(statusData.metadata.youtubeTags ?? "");
      setInstagramCaption(statusData.metadata.instagramCaption ?? "");
    }
  }

  async function waitForRenderComplete(projectId: string) {
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`/api/projects/${projectId}/render`);
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      setRenderProgress(statusData.progress ?? 0);
      setRenderStep(statusData.step ?? null);
      if (statusData.status === "RENDERED") {
        const projRes = await fetch(`/api/projects/${projectId}`);
        const projData = await projRes.json();
        if (projData.project) {
          setProject({
            ...projData.project,
            scenes: projData.project.scenes ?? [],
            renders: projData.project.renders ?? [],
          });
        }
        await loadPublishMeta(projectId);
        setRenderProgress(100);
        setRenderStep("Complete");
        setStep("publish");
        return;
      }
      if (statusData.status === "FAILED") {
        throw new Error(statusData.error ?? "Render failed");
      }
    }
    throw new Error("Render timed out. Check dashboard or worker logs.");
  }

  async function saveLayout(nextLayout: typeof layout) {
    setLayout(nextLayout);
    if (!project) return;
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compositingLayout: nextLayout }),
    });
    setProject((p) => (p ? { ...p, compositingLayout: nextLayout } : p));
  }

  async function publishVideos() {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        youtubeTitle,
        youtubeDescription,
        youtubeTags,
        instagramCaption,
      };
      if (scheduleAt) {
        body.scheduledAt = new Date(scheduleAt).toISOString();
      }

      const res = await fetch(`/api/projects/${project.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJsonResponse<{
        error?: string;
        scheduled?: boolean;
        message?: string;
        youtube?: { message: string };
        instagram?: { message: string };
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      if (data.scheduled) {
        setPublishNote(data.message ?? "Publish scheduled.");
      } else {
        setPublishNote(
          `${data.youtube?.message ?? ""}\n\n${data.instagram?.message ?? ""}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const stepIndex = steps.findIndex((s) => s.id === step);

  const latestRenders = (() => {
    const formats = ["LANDSCAPE_16_9", "PORTRAIT_9_16"] as const;
    return formats
      .map((format) => {
        const completed = (project?.renders ?? []).find(
          (r) => r.format === format && r.status === "COMPLETED" && r.filePath,
        );
        if (completed) return completed;
        return (project?.renders ?? []).find((r) => r.format === format);
      })
      .filter(Boolean) as Project["renders"];
  })();

  const totalSceneSec = (project?.scenes ?? []).reduce(
    (sum, s) => sum + s.durationSec,
    0,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <ol className="mb-10 flex gap-2">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-medium ${
              i <= stepIndex
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 text-zinc-400 dark:border-zinc-800"
            }`}
          >
            {s.label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {step === "topic" && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">What is your video about?</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Enter a topic, add your photos, and we&apos;ll place you in the
              scenery with AI voiceover + stock clips.
            </p>
          </div>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={4}
            placeholder="e.g. Exploring Yosemite National Park"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <CreatorAttachments
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
            assets={assets}
            onAssetsChange={setAssets}
            disabled={loading}
          />
          <div>
            <label
              htmlFor="video-length"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Video length
            </label>
            <select
              id="video-length"
              value={targetDurationMin}
              onChange={(e) =>
                setTargetDurationMin(Number(e.target.value) as TargetDurationMin)
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {VIDEO_LENGTH_OPTIONS.map((opt) => (
                <option key={opt.minutes} value={opt.minutes}>
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              Longer videos use more scenes and take longer to render.
            </p>
            {isPlaceTopic(topic) && (
              <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
                City &amp; travel topics automatically generate at least{" "}
                <strong>{MIN_CITY_PLACES} named places</strong> (uses Long ~5
                min minimum for enough scenes).
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={loading || topic.trim().length < 3}
            onClick={createProject}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Creating…" : "Continue"}
          </button>
        </section>
      )}

      {step === "script" && project && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">{project.title}</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Generate scenes, then review before rendering.
            </p>
          </div>

          <CreatorAttachments
            projectId={project.id}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
            assets={assets}
            onAssetsChange={(next) => {
              setAssets(next);
              setProject((p) => (p ? { ...p, assets: next } : p));
            }}
            disabled={loading}
          />

          <LayoutPicker
            value={project.compositingLayout ?? layout}
            onChange={saveLayout}
            disabled={loading}
          />

          {(project.scenes ?? []).length === 0 ? (
            <>
              <div>
                <label
                  htmlFor="script-length"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Video length
                </label>
                <select
                  id="script-length"
                  value={targetDurationMin}
                  onChange={(e) =>
                    setTargetDurationMin(
                      Number(e.target.value) as TargetDurationMin,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {VIDEO_LENGTH_OPTIONS.map((opt) => (
                    <option key={opt.minutes} value={opt.minutes}>
                      {opt.label} — {opt.hint}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={generateScript}
                className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {loading ? "Generating…" : "Generate script & scenes"}
              </button>
            </>
          ) : (
            <>
              {project.hook && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    Scroll hook (first 3 seconds)
                  </p>
                  <p className="mt-1 text-sm font-medium">{project.hook}</p>
                </div>
              )}
              {scrollScore && <ScrollScoreBadge score={scrollScore} />}
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {project.scenes.length} scenes · ~{Math.round(totalSceneSec)}s
                planned
                {isPlaceTopic(project.topic) &&
                  ` · ${Math.max(0, project.scenes.length - 2)} places`}
                {" "}· voiceover may extend each scene
              </p>
              <ul className="space-y-3">
                {(project.scenes ?? []).map((scene) => (
                  <li
                    key={scene.id}
                    className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <p className="text-xs font-medium uppercase text-zinc-500">
                      {scene.isHook ? (
                        <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                          Hook
                        </span>
                      ) : null}
                      Scene {scene.order + 1} · {scene.durationSec}s ·{" "}
                      {scene.keywords}
                    </p>
                    <p className="mt-2 text-sm">{scene.text}</p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <label
                    htmlFor="regen-length"
                    className="text-xs font-medium text-zinc-500"
                  >
                    Length for regenerate
                  </label>
                  <select
                    id="regen-length"
                    value={targetDurationMin}
                    onChange={(e) =>
                      setTargetDurationMin(
                        Number(e.target.value) as TargetDurationMin,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {VIDEO_LENGTH_OPTIONS.map((opt) => (
                      <option key={opt.minutes} value={opt.minutes}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={generateScript}
                  className="rounded-full border border-zinc-300 px-5 py-2 text-sm dark:border-zinc-700"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep("render");
                    renderVideo();
                  }}
                  className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {loading ? "Rendering…" : "Render video"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === "render" && project && (
        <section className="space-y-6">
          <h1 className="text-2xl font-semibold">Rendering…</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Generating AI voiceover, downloading {project.scenes?.length ?? 0}{" "}
            stock clips, then merging with FFmpeg. Estimated render time:{" "}
            <strong>
              {estimateRenderMinutes(project.scenes?.length ?? 0)}
            </strong>
            {process.env.NEXT_PUBLIC_REDIS_ENABLED !== "false" && (
              <> — with Redis + worker running, you can close this tab.</>
            )}
          </p>
          {loading && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all duration-500 dark:bg-zinc-100"
                  style={{ width: `${Math.max(renderProgress, 5)}%` }}
                />
              </div>
              <p className="text-sm text-zinc-500">
                {renderStep ?? "Working…"} ({renderProgress}%)
              </p>
            </>
          )}
          {!loading && error && (
            <button
              type="button"
              onClick={renderVideo}
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Retry render
            </button>
          )}
        </section>
      )}

      {step === "publish" && project && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Ready to publish</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Preview videos, edit metadata, and publish to YouTube + Instagram.
              Connect accounts in{" "}
              <Link href="/settings/connections" className="underline">
                Settings → Connections
              </Link>
              .
            </p>
          </div>

          {scrollScore && <ScrollScoreBadge score={scrollScore} />}

          {project.durationSec && (
            <p className="text-sm text-zinc-500">
              Duration: {Math.round(project.durationSec)}s
            </p>
          )}

          <img
            src={`/api/projects/${project.id}/thumbnail`}
            alt="Video thumbnail"
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />

          <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium">Publish metadata</p>
            <input
              value={youtubeTitle}
              onChange={(e) => setYoutubeTitle(e.target.value)}
              placeholder="YouTube title"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <textarea
              value={youtubeDescription}
              onChange={(e) => setYoutubeDescription(e.target.value)}
              rows={3}
              placeholder="YouTube description"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={youtubeTags}
              onChange={(e) => setYoutubeTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <textarea
              value={instagramCaption}
              onChange={(e) => setInstagramCaption(e.target.value)}
              rows={3}
              placeholder="Instagram caption + hashtags"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <div>
              <label className="text-xs text-zinc-500">Schedule publish (optional)</label>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <ul className="space-y-4 text-sm">
            {latestRenders.map((r) => {
              const formatKey =
                r.format === "LANDSCAPE_16_9" ? "landscape" : "portrait";
              const previewUrl = `/api/projects/${project.id}/video?format=${formatKey}`;
              const downloadUrl = `${previewUrl}&download=1`;
              const label =
                r.format === "LANDSCAPE_16_9" ? "YouTube (16:9)" : "Instagram Reel (9:16)";
              const ready = Boolean(r.filePath);

              return (
                <li
                  key={r.format}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-zinc-500">{r.status}</span>
                  </div>

                  {ready ? (
                    <>
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        className="mt-3 w-full rounded-lg bg-black"
                        src={previewUrl}
                      >
                        Your browser does not support video playback.
                      </video>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          Open in new tab
                        </a>
                        <a
                          href={downloadUrl}
                          className="cursor-pointer rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                        >
                          Download MP4
                        </a>
                      </div>
                      <a
                        href={downloadUrl}
                        className="mt-2 block cursor-pointer truncate text-xs text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {r.filePath}
                      </a>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">
                      Render not finished yet.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {shortClips.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Shorts clip pack
              </h2>
              <ul className="mt-3 space-y-3">
                {shortClips.map((clip) => (
                  <li
                    key={clip.id}
                    className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <p className="text-xs text-zinc-500">
                      Clip {clip.order + 1} · {Math.round(clip.endSec - clip.startSec)}s
                    </p>
                    <p className="text-sm">{clip.title}</p>
                    <video
                      controls
                      playsInline
                      className="mt-2 w-full max-w-xs rounded-lg bg-black"
                      src={`/api/projects/${project.id}/shorts/${clip.id}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {publishNote ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm whitespace-pre-wrap dark:border-emerald-900 dark:bg-emerald-950">
              {publishNote}
            </div>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={publishVideos}
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "Publishing…" : scheduleAt ? "Schedule publish" : "Publish to YouTube + Instagram"}
            </button>
          )}

          <Link
            href={`/projects/${project.id}`}
            className="inline-block text-sm font-medium text-blue-600 underline dark:text-blue-400"
          >
            Open project page (watch & download anytime)
          </Link>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Go to dashboard
          </button>
        </section>
      )}
    </div>
  );
}
