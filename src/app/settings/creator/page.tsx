"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LayoutPicker } from "@/components/LayoutPicker";
import { LAYOUT_LABELS } from "@/lib/media/compositing";

type Profile = {
  displayName: string | null;
  voiceId: string;
  layout: keyof typeof LAYOUT_LABELS;
  brandColor: string | null;
  assets: { id: string; fileName: string; order: number }[];
};

const VOICES = ["onyx", "nova", "shimmer", "echo", "fable", "alloy"];

export default function CreatorSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/creator")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/settings/creator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: profile.displayName,
        voiceId: profile.voiceId,
        layout: profile.layout,
        brandColor: profile.brandColor,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("Saved.");
    } else {
      setMessage("Save failed.");
    }
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    const res = await fetch("/api/settings/creator/assets", {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      const refreshed = await fetch("/api/settings/creator").then((r) =>
        r.json(),
      );
      setProfile(refreshed.profile);
    }
  }

  if (loading || !profile) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-10">Loading…</main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <Link href="/dashboard" className="text-sm text-zinc-600 underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Creator profile</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Default settings applied to new videos. Upload photos once, reuse on
          every project.
        </p>

        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            value={profile.displayName ?? ""}
            onChange={(e) =>
              setProfile({ ...profile, displayName: e.target.value })
            }
            className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="text-sm font-medium">AI voice</label>
          <select
            value={profile.voiceId}
            onChange={(e) =>
              setProfile({ ...profile, voiceId: e.target.value })
            }
            className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {VOICES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <LayoutPicker
          value={profile.layout}
          onChange={(layout) => setProfile({ ...profile, layout })}
        />

        <div>
          <label className="text-sm font-medium">Saved photos</label>
          <input
            type="file"
            accept="image/*,video/mp4"
            multiple
            onChange={(e) => uploadPhotos(e.target.files)}
            className="mt-2 block w-full text-sm"
          />
          {profile.assets.length > 0 && (
            <ul className="mt-2 text-xs text-zinc-500">
              {profile.assets.map((a) => (
                <li key={a.id}>
                  {a.order + 1}. {a.fileName}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>

        {message && <p className="text-sm text-zinc-600">{message}</p>}
      </main>
    </>
  );
}
