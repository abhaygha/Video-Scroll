"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";

type OAuthStatus = {
  youtube: { configured: boolean; connected: boolean; channelName: string | null };
  instagram: { configured: boolean; connected: boolean; accountName: string | null };
};

export function ConnectionsClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/oauth/status")
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  async function disconnect(platform: "YOUTUBE" | "INSTAGRAM") {
    await fetch(`/api/oauth/status?platform=${platform}`, { method: "DELETE" });
    const next = await fetch("/api/oauth/status").then((r) => r.json());
    setStatus(next);
  }

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/dashboard" className="text-sm text-zinc-600 underline">
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Connected accounts</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Link YouTube and Instagram to publish directly from Video-Scroll.
        </p>

        {connected && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            Connected {connected} successfully.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-zinc-500">Loading…</p>
        ) : (
          <ul className="mt-8 space-y-4">
            <li className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">YouTube</p>
                  <p className="text-sm text-zinc-500">
                    {status?.youtube.connected
                      ? `Connected: ${status.youtube.channelName ?? "channel"}`
                      : status?.youtube.configured
                        ? "Not connected"
                        : "Add GOOGLE_CLIENT_ID/SECRET to .env"}
                  </p>
                </div>
                {status?.youtube.connected ? (
                  <button
                    type="button"
                    onClick={() => disconnect("YOUTUBE")}
                    className="text-sm text-red-600 underline"
                  >
                    Disconnect
                  </button>
                ) : (
                  <a
                    href="/api/oauth/google"
                    className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Connect Google
                  </a>
                )}
              </div>
            </li>

            <li className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Instagram Reels</p>
                  <p className="text-sm text-zinc-500">
                    {status?.instagram.connected
                      ? `@${status.instagram.accountName ?? "account"}`
                      : status?.instagram.configured
                        ? "Not connected"
                        : "Add META_APP_ID/SECRET to .env"}
                  </p>
                </div>
                {status?.instagram.connected ? (
                  <button
                    type="button"
                    onClick={() => disconnect("INSTAGRAM")}
                    className="text-sm text-red-600 underline"
                  >
                    Disconnect
                  </button>
                ) : (
                  <a
                    href="/api/oauth/meta"
                    className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Connect Meta
                  </a>
                )}
              </div>
            </li>
          </ul>
        )}
      </main>
    </>
  );
}
