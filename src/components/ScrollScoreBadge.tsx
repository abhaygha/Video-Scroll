"use client";

import type { ScrollScore } from "@/lib/ai/scroll-score";

export function ScrollScoreBadge({ score }: { score: ScrollScore }) {
  const color =
    score.overall >= 8
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : score.overall >= 6
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100";

  return (
    <div className={`rounded-xl border px-4 py-3 ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">
        Scroll score · {score.overall}/10
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <span>Hook {score.hook}/10</span>
        <span>Captions {score.captions}/10</span>
        <span>Pacing {score.pacing}/10</span>
      </div>
      {score.tips.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs opacity-90">
          {score.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
