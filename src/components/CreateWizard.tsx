"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "topic" | "script" | "render" | "publish";

type Scene = {
  id: string;
  order: number;
  text: string;
  keywords: string;
  durationSec: number;
};

type Project = {
  id: string;
  title: string;
  topic: string;
  status: string;
  script: string | null;
  scenes: Scene[];
  renders: { format: string; status: string; filePath: string | null }[];
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
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishNote, setPublishNote] = useState<string | null>(null);

  async function createProject() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : (data.error?.topic?.[0] ?? "Failed to create");
        throw new Error(msg);
      }
      setProject({
        ...data.project,
        scenes: data.project.scenes ?? [],
        renders: data.project.renders ?? [],
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
      const res = await fetch(`/api/projects/${project.id}/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setProject({
        ...data.project,
        scenes: data.project.scenes ?? [],
        renders: data.project.renders ?? [],
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
    try {
      const res = await fetch(`/api/projects/${project.id}/render`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Render failed");
      setProject({
        ...data.project,
        scenes: data.project.scenes ?? [],
        renders: data.project.renders ?? [],
      });
      setStep("publish");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("render");
    } finally {
      setLoading(false);
    }
  }

  async function publishVideos() {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setPublishNote(
        `${data.youtube.message}\n\n${data.instagram.message}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const stepIndex = steps.findIndex((s) => s.id === step);

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
              Enter a topic. We fetch stock clips + music per scene (requires
              free Pexels/Pixabay API keys in <code className="text-xs">.env</code>
              ).
            </p>
          </div>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={4}
            placeholder="e.g. 5 tips for better sleep"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
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

          {(project.scenes ?? []).length === 0 ? (
            <button
              type="button"
              disabled={loading}
              onClick={generateScript}
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "Generating…" : "Generate script & scenes"}
            </button>
          ) : (
            <>
              <ul className="space-y-3">
                {(project.scenes ?? []).map((scene) => (
                  <li
                    key={scene.id}
                    className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <p className="text-xs font-medium uppercase text-zinc-500">
                      Scene {scene.order + 1} · {scene.durationSec}s ·{" "}
                      {scene.keywords}
                    </p>
                    <p className="mt-2 text-sm">{scene.text}</p>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
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
            Downloading {project.scenes?.length ?? 0} stock clips from Pexels,
            then merging with FFmpeg. This usually takes{" "}
            <strong>2–5 minutes</strong> — please keep this tab open.
          </p>
          {loading && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="render-progress h-full w-1/3 rounded-full bg-zinc-900 dark:bg-zinc-100" />
              </div>
              <p className="text-sm text-zinc-500">
                Working… Check the terminal running{" "}
                <code className="text-xs">npm run dev</code> for scene-by-scene
                logs.
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
              Videos rendered to <code className="text-xs">output/</code>. Publish
              stubs are wired for YouTube + Instagram.
            </p>
          </div>

          <ul className="space-y-2 text-sm">
            {(project.renders ?? []).map((r) => (
              <li
                key={r.format}
                className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <span className="font-medium">{r.format}</span> — {r.status}
                {r.filePath && (
                  <span className="mt-1 block truncate text-xs text-zinc-500">
                    {r.filePath}
                  </span>
                )}
              </li>
            ))}
          </ul>

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
              {loading ? "Publishing…" : "Publish to YouTube + Instagram"}
            </button>
          )}

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
