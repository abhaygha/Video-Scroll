import {
  isPlaceTopic,
  extractPlaceName,
  minDurationForPlaceTopic,
  placeScriptSceneCount,
  MIN_CITY_PLACES,
} from "@/lib/topic-intent";

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
    hint: "Deep-dive explainer · city guides",
    sceneMin: 14,
    sceneMax: 20,
    sceneDurationMin: 8,
    sceneDurationMax: 22,
  },
  {
    minutes: 10,
    label: "Extended (~10 min)",
    hint: "Full guide / 20+ places",
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

/** City/place topics auto-use at least 5 min so 20 places fit. */
export function getEffectiveDurationMin(
  topic: string,
  requestedMin: number,
): TargetDurationMin {
  const normalized = normalizeTargetDurationMin(requestedMin);
  if (isPlaceTopic(topic)) {
    return Math.max(normalized, minDurationForPlaceTopic()) as TargetDurationMin;
  }
  return normalized;
}

export function getEffectiveSceneBounds(
  topic: string,
  minutes: number,
): { sceneMin: number; sceneMax: number } {
  if (isPlaceTopic(topic)) {
    return placeScriptSceneCount();
  }
  const c = getVideoLengthConfig(minutes);
  return { sceneMin: c.sceneMin, sceneMax: c.sceneMax };
}

export function buildScriptPromptRules(topic: string, minutes: number): string {
  const c = getVideoLengthConfig(minutes);
  const bounds = getEffectiveSceneBounds(topic, minutes);
  const targetSec = minutes * 60;
  return `- ${bounds.sceneMin}-${bounds.sceneMax} scenes, target ~${minutes} minute(s) (${targetSec - 30}-${targetSec + 90} seconds total)
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
  const low = Math.max(2, Math.ceil(sceneCount / 4) + 1);
  const high = Math.max(3, Math.ceil(sceneCount / 2) + 2);
  return `${low}–${high} minutes`;
}

export { MIN_CITY_PLACES, isPlaceTopic, extractPlaceName };
