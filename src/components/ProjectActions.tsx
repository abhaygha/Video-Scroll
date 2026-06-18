"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProjectActionsProps = {
  projectId: string;
  initialStatus: string;
  initialProgress: number;
  initialStep: string | null;
  initialError: string | null;
  hasScenes: boolean;
  hook: string | null;
  sceneErrors: { order: number; error: string | null }[];
};

export function ProjectActions({
  projectId,
  initialStatus,
  initialProgress,
  initialStep,
  initialError,
  hasScenes,
  hook,
  sceneErrors,
}: ProjectActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(initialStatus === "RENDERING");

  const pollStatus = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/render`);
    if (!res.ok) return null;
    return res.json() as Promise<{
      status: string;
      progress: number;
      step: string | null;
      error: string | null;
    }>;
  }, [projectId]);

  useEffect(() => {
    if (status !== "RENDERING") return;

    const interval = setInterval(async () => {
      const data = await pollStatus();
      if (!data) return;

      setProgress(data.progress);
      setStep(data.step);
      setError(data.error);
      setStatus(data.status);

      if (data.status === "RENDERED" || data.status === "FAILED") {
        setLoading(false);
        router.refresh();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, pollStatus, router]);

  async function handleRender() {
    setLoading(true);
    setError(null);
    setProgress(0);
    setStep("Starting…");
    setStatus("RENDERING");

    try {
      const res = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setStatus("RENDERING");
          return;
        }
        throw new Error(data.error ?? "Render failed");
      }

      if (res.status === 202 || data.queued) {
        setStatus("RENDERING");
        setStep("Queued — processing in background…");
        return;
      }

      setStatus(data.project?.status ?? "RENDERED");
      setProgress(100);
      setStep("Complete");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
      setStatus("FAILED");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {hook && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Scroll hook
          </p>
          <p className="mt-1 text-sm font-medium text-amber-950 dark:text-amber-100">
            {hook}
          </p>
        </div>
      )}

      {hasScenes && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || status === "RENDERING"}
            onClick={handleRender}
            className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading || status === "RENDERING"
              ? "Rendering…"
              : status === "RENDERED"
                ? "Re-render video"
                : "Render video"}
          </button>
          {status === "FAILED" && !loading && (
            <span className="self-center text-xs text-red-600 dark:text-red-400">
              Last render failed — fix keys or retry
            </span>
          )}
        </div>
      )}

      {(loading || status === "RENDERING") && (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all duration-500 dark:bg-zinc-100"
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>
          <p className="text-sm text-zinc-500">
            {step ?? "Working…"} ({progress}%)
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {sceneErrors.length > 0 && (
        <ul className="space-y-1 text-xs text-red-600 dark:text-red-400">
          {sceneErrors.map((s) => (
            <li key={s.order}>
              Scene {s.order + 1}: {s.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
