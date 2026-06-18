export type ScrollScore = {
  overall: number;
  hook: number;
  captions: number;
  pacing: number;
  tips: string[];
};

export function computeScrollScore(input: {
  hook: string | null;
  scenes: { text: string; durationSec: number; isHook: boolean }[];
  targetDurationMin: number;
}): ScrollScore {
  const hookText = input.hook ?? input.scenes[0]?.text ?? "";
  const hookWords = hookText.trim().split(/\s+/).filter(Boolean).length;

  let hook = 5;
  if (hookWords >= 6 && hookWords <= 15) hook += 2;
  if (/you|secret|wait|never|why|how/i.test(hookText)) hook += 2;
  if (hookWords < 4) hook -= 2;
  hook = Math.min(10, Math.max(1, hook));

  const avgWords =
    input.scenes.reduce(
      (sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length,
      0,
    ) / Math.max(1, input.scenes.length);
  let captions = avgWords <= 20 ? 8 : avgWords <= 35 ? 6 : 4;

  const totalSec = input.scenes.reduce((sum, s) => sum + s.durationSec, 0);
  const targetSec = input.targetDurationMin * 60;
  const pacingDiff = Math.abs(totalSec - targetSec) / targetSec;
  let pacing = pacingDiff < 0.15 ? 9 : pacingDiff < 0.35 ? 7 : 5;

  const overall = Math.round((hook + captions + pacing) / 3);
  const tips: string[] = [];
  if (hook < 7) tips.push("Strengthen the hook — use a curiosity gap or bold claim.");
  if (captions < 7) tips.push("Shorten on-screen captions to 2–3 words per pop.");
  if (pacing < 7) tips.push("Adjust scene lengths to match your target video duration.");

  return { overall, hook, captions, pacing, tips };
}
