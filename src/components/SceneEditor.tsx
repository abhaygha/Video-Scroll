"use client";

import { useCallback, useState } from "react";

export type EditableScene = {
  id: string;
  order: number;
  text: string;
  keywords: string;
  durationSec: number;
  isHook?: boolean;
};

type StockPreview = {
  url: string;
  source: string;
  query?: string;
};

type SceneEditorProps = {
  projectId: string;
  topic: string;
  scenes: EditableScene[];
  onScenesChange: (scenes: EditableScene[]) => void;
  disabled?: boolean;
};

export function SceneEditor({
  projectId,
  topic,
  scenes,
  onScenesChange,
  disabled,
}: SceneEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    scenes[0]?.id ?? null,
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, StockPreview[]>>({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateLocal = useCallback(
    (sceneId: string, patch: Partial<EditableScene>) => {
      onScenesChange(
        scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
      );
    },
    [scenes, onScenesChange],
  );

  async function saveScene(scene: EditableScene) {
    setSavingId(scene.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${scene.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: scene.text,
            keywords: scene.keywords,
            durationSec: scene.durationSec,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to save scene",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function loadStockPreview(scene: EditableScene) {
    setPreviewLoading(scene.id);
    setPreviewId(scene.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${scene.id}/stock-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: scene.text,
            keywords: scene.keywords,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreviews((prev) => ({ ...prev, [scene.id]: data.previews ?? [] }));
      if (data.suggestedKeywords && !scene.keywords.trim()) {
        updateLocal(scene.id, { keywords: data.suggestedKeywords });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <p className="text-xs text-zinc-500">
        Tap a scene to edit narration, stock keywords, or preview footage before
        rendering. Click Save scene after edits.
      </p>

      <ul className="space-y-2">
        {scenes.map((scene) => {
          const expanded = expandedId === scene.id;
          const scenePreviews = previews[scene.id] ?? [];

          return (
            <li
              key={scene.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => setExpandedId(expanded ? null : scene.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <span className="mt-0.5 shrink-0 text-xs font-bold text-zinc-400">
                  {scene.order + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {scene.isHook && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                        Hook
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {scene.durationSec}s
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{scene.text}</p>
                  {!expanded && (
                    <p className="mt-1 truncate text-xs text-zinc-400">
                      Stock: {scene.keywords}
                    </p>
                  )}
                </div>
                <span className="text-xs text-zinc-400">
                  {expanded ? "▲" : "▼"}
                </span>
              </button>

              {expanded && (
                <div className="space-y-3 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
                  <div>
                    <label className="text-xs font-medium text-zinc-500">
                      Narration
                    </label>
                    <textarea
                      value={scene.text}
                      disabled={disabled}
                      rows={3}
                      onChange={(e) =>
                        updateLocal(scene.id, { text: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-500">
                      Stock search keywords
                    </label>
                    <input
                      value={scene.keywords}
                      disabled={disabled}
                      onChange={(e) =>
                        updateLocal(scene.id, { keywords: e.target.value })
                      }
                      placeholder={`e.g. Alamo San Antonio ${topic}`}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <p className="mt-1 text-xs text-zinc-400">
                      Use the specific place name + city/state for best footage.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-zinc-500">
                      Duration (sec)
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={60}
                      value={scene.durationSec}
                      disabled={disabled}
                      onChange={(e) =>
                        updateLocal(scene.id, {
                          durationSec: Number(e.target.value) || 5,
                        })
                      }
                      className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled || savingId === scene.id}
                      onClick={() => saveScene(scene)}
                      className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {savingId === scene.id ? "Saving…" : "Save scene"}
                    </button>
                    <button
                      type="button"
                      disabled={disabled || previewLoading === scene.id}
                      onClick={() => loadStockPreview(scene)}
                      className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs dark:border-zinc-700"
                    >
                      {previewLoading === scene.id
                        ? "Loading…"
                        : "Preview stock"}
                    </button>
                  </div>

                  {previewId === scene.id && scenePreviews.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500">
                        Stock matches
                      </p>
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {scenePreviews.map((hit) => (
                          <li
                            key={hit.url}
                            className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                          >
                            <video
                              src={hit.url}
                              muted
                              playsInline
                              loop
                              autoPlay
                              className="aspect-video w-full bg-black object-cover"
                            />
                            <p className="truncate px-2 py-1 text-xs text-zinc-500">
                              {hit.source}
                              {hit.query ? ` · "${hit.query}"` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
