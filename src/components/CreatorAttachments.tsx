"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseJsonResponse } from "@/lib/api-client";

export type AssetItem = {
  id: string;
  type: "IMAGE" | "VIDEO";
  fileName: string;
  order: number;
};

type PendingPreview = {
  key: string;
  file: File;
  url: string;
};

type CreatorAttachmentsProps = {
  projectId?: string | null;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  assets: AssetItem[];
  onAssetsChange: (assets: AssetItem[]) => void;
  disabled?: boolean;
};

const MAX_FILES = 8;

export function CreatorAttachments({
  projectId,
  pendingFiles,
  onPendingFilesChange,
  assets,
  onAssetsChange,
  disabled,
}: CreatorAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPreviews, setPendingPreviews] = useState<PendingPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCount = pendingFiles.length + assets.length;

  useEffect(() => {
    const previews = pendingFiles.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setPendingPreviews(previews);
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [pendingFiles]);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming?.length) return;
      setError(null);
      const next = [...pendingFiles];
      for (const file of Array.from(incoming)) {
        if (totalCount + next.length - pendingFiles.length >= MAX_FILES) {
          setError(`Maximum ${MAX_FILES} photos/videos.`);
          break;
        }
        next.push(file);
      }
      onPendingFilesChange(next);
    },
    [pendingFiles, onPendingFilesChange, totalCount],
  );

  async function uploadToProject(files: File[]) {
    if (!projectId || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: AssetItem[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/projects/${projectId}/assets`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        uploaded.push(data.asset);
      }
      onAssetsChange([...assets, ...uploaded]);
      onPendingFilesChange([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeAsset(assetId: string) {
    if (!projectId) return;
    await fetch(`/api/projects/${projectId}/assets?assetId=${assetId}`, {
      method: "DELETE",
    });
    onAssetsChange(assets.filter((a) => a.id !== assetId));
  }

  function removePending(index: number) {
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Your photos & videos
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Add pictures of yourself enjoying the trip — they appear on stock
          scenery so it looks like you&apos;re there. JPG, PNG, or MP4 (max 8
          files, 20 MB each).
        </p>
      </div>

      <div
        className={`rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700 ${
          disabled ? "opacity-50" : "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500"
        }`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !disabled) inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          multiple
          className="hidden"
          disabled={disabled || totalCount >= MAX_FILES}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Click to add photos or clips
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {totalCount}/{MAX_FILES} attached
        </p>
      </div>

      {(pendingPreviews.length > 0 || assets.length > 0) && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {pendingPreviews.map((preview, index) => (
            <li key={preview.key} className="relative">
              {preview.file.type.startsWith("video/") ? (
                <video
                  src={preview.url}
                  className="aspect-[3/4] w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={preview.url}
                  alt={preview.file.name}
                  className="aspect-[3/4] w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                />
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  removePending(index);
                }}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white"
              >
                ×
              </button>
              <p className="mt-1 truncate text-xs text-zinc-500">Pending</p>
            </li>
          ))}
          {assets.map((asset) => (
            <li key={asset.id} className="relative">
              {asset.type === "VIDEO" ? (
                <video
                  src={`/api/projects/${projectId}/assets/${asset.id}`}
                  className="aspect-[3/4] w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={`/api/projects/${projectId}/assets/${asset.id}`}
                  alt={asset.fileName}
                  className="aspect-[3/4] w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                />
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  removeAsset(asset.id);
                }}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {projectId && pendingFiles.length > 0 && (
        <button
          type="button"
          disabled={uploading || disabled}
          onClick={() => uploadToProject(pendingFiles)}
          className="text-sm font-medium text-blue-600 underline dark:text-blue-400"
        >
          {uploading ? "Uploading…" : "Upload selected files now"}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export async function uploadPendingAssets(
  projectId: string,
  files: File[],
): Promise<AssetItem[]> {
  const uploaded: AssetItem[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/assets`, {
      method: "POST",
      body: form,
    });
    const data = await parseJsonResponse<{ asset: AssetItem; error?: string }>(
      res,
    );
    if (!res.ok) {
      throw new Error(data.error ?? `Failed to upload ${file.name}`);
    }
    uploaded.push(data.asset);
  }
  return uploaded;
}
