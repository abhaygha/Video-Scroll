export const VIDEO_LENGTH_OPTIONS = [
  {
    minutes: 1,
    label: "Short (~1 min)",
    hint: "Reels & YouTube Shorts",
    sceneMin: 5,
    sceneMax: 7,
    sceneDurationMin: 3,
    sceneDurationMax: 12,
  },
  {
    minutes: 3,
    label: "Medium (~3 min)",
    hint: "Standard YouTube video",
    sceneMin: 10,
    sceneMax: 14,
    sceneDurationMin: 5,
    sceneDurationMax: 18,
  },
  {
    minutes: 5,
    label: "Long (~5 min)",
    hint: "Deep-dive explainer",
    sceneMin: 14,
    sceneMax: 20,
    sceneDurationMin: 8,
    sceneDurationMax: 22,
  },
  {
    minutes: 10,
    label: "Extended (~10 min)",
    hint: "Full guide / documentary",
    sceneMin: 20,
    sceneMax: 30,
    sceneDurationMin: 10,
    sceneDurationMax: 30,
  },
] as const;

export type TargetDurationMin = (typeof VIDEO_LENGTH_OPTIONS)[number]["minutes"];

export function normalizeTargetDurationMin(value: unknown): TargetDurationMin {
  const n = typeof value === "number" ? value : Number(value);
  const allowed = VIDEO_LENGTH_OPTIONS.map((o) => o.minutes);
  if (allowed.includes(n as TargetDurationMin)) {
    return n as TargetDurationMin;
  }
  return 1;
}

export function getVideoLengthConfig(minutes: number) {
  return (
    VIDEO_LENGTH_OPTIONS.find((o) => o.minutes === minutes) ??
    VIDEO_LENGTH_OPTIONS[0]
  );
}

export function buildScriptPromptRules(minutes: number): string {
  const c = getVideoLengthConfig(minutes);
  const targetSec = minutes * 60;
  return `- ${c.sceneMin}-${c.sceneMax} scenes, target ~${minutes} minute(s) (${targetSec - 30}-${targetSec + 45} seconds total)
- Each scene durationSec: ${c.sceneDurationMin}-${c.sceneDurationMax} seconds
- For longer videos: write richer narration per scene (2-4 sentences where needed), not just more one-line scenes
- Total durationSec across all scenes should add up to roughly ${targetSec} seconds`;
}

export function clampSceneDuration(
  durationSec: number,
  minutes: number,
): number {
  const c = getVideoLengthConfig(minutes);
  return Math.min(Math.max(durationSec, c.sceneDurationMin), c.sceneDurationMax);
}

export function estimateRenderMinutes(sceneCount: number): string {
  const low = Math.max(2, Math.round(sceneCount * 0.8));
  const high = Math.max(5, Math.round(sceneCount * 1.5));
  return `${low}–${high} minutes`;
}
