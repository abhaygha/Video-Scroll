/** Topics that should NOT get the "20 places" travel treatment. */
const NON_PLACE_PATTERN =
  /\b(tutorial|how to|review|recipe|workout|coding|finance|podcast|interview|news about|explained)\b/i;

const PLACE_HINT_PATTERN =
  /\b(city|town|state|country|park|beach|island|national|explore|visit|travel|trip|guide|places|attractions|things to do|top \d+|best \d+)\b/i;

const VIDEO_ON_PATTERN =
  /^(make\s+(a\s+)?video\s+(on|about)\s+|video\s+(on|about)\s+|travel\s+(to|in)\s+)/i;

export const MIN_CITY_PLACES = 20;

/** Strip common wizard phrasing so "make video on Texas" → "Texas". */
export function extractPlaceName(topic: string): string {
  return topic
    .replace(VIDEO_ON_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True for cities, states, countries, parks, and most travel destinations. */
export function isPlaceTopic(topic: string): boolean {
  const cleaned = extractPlaceName(topic);
  if (!cleaned || cleaned.length < 2) return false;
  if (NON_PLACE_PATTERN.test(topic)) return false;

  if (PLACE_HINT_PATTERN.test(topic)) return true;

  // Short topics like "Texas", "Paris", "Yosemite" are almost always places.
  const wordCount = cleaned.split(/\s+/).length;
  if (wordCount <= 5) return true;

  return false;
}

export function placeScriptSceneCount(): { sceneMin: number; sceneMax: number } {
  // hook + 20 named places + outro
  return { sceneMin: MIN_CITY_PLACES + 2, sceneMax: MIN_CITY_PLACES + 4 };
}

/** Place guides need enough runtime for 20+ scenes (~5 min). */
export function minDurationForPlaceTopic(): number {
  return 5;
}

export function buildPlaceScriptRules(placeName: string): string {
  const { sceneMin, sceneMax } = placeScriptSceneCount();
  return `
PLACE / CITY GUIDE MODE for "${placeName}":
- You MUST include at least ${MIN_CITY_PLACES} distinct, REAL, named places (landmarks, neighborhoods, museums, parks, markets, viewpoints, restaurants, streets, etc.)
- Use ${sceneMin}-${sceneMax} total scenes: 1 hook scene + at least ${MIN_CITY_PLACES} place scenes + 1 outro scene
- Each place scene (not hook/outro) MUST:
  - Name exactly ONE specific real place in ${placeName} in the first sentence
  - Give 1-2 sentences of useful, specific info (history, what to do, best time to visit, local tip)
  - Use keywords that match THAT place for stock footage (e.g. "Austin Texas Congress Avenue bridge bats" not just "${placeName} city")
- Do NOT repeat the same place twice
- Do NOT use vague scenes like "the food scene" without naming a specific restaurant, market, or dish spot
- Cover variety: icons, hidden gems, food, nature, culture, nightlife, day trips if relevant
- End with a strong outro CTA (save/follow/plan your trip)`;
}
