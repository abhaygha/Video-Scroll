import Link from "next/link";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-5xl flex-col items-start gap-8 px-4 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Phase 1 MVP
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Create once. Publish everywhere.
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Video-Scroll turns a topic into a captioned video, then exports for
            YouTube (16:9) and Instagram Reels (9:16).
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/create"
            className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create a video
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium dark:border-zinc-700"
          >
            Dashboard
          </Link>
        </div>

        <ul className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "AI script", desc: "Topic → scenes + voiceover plan" },
            { title: "FFmpeg render", desc: "16:9 + auto-crop to 9:16" },
            { title: "Dual publish", desc: "YouTube + Instagram (stubs)" },
          ].map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {item.desc}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
