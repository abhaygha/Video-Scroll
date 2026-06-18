import { extractPlaceName } from "@/lib/topic-intent";

type PexelsVideoFile = {
  link: string;
  width: number;
  height: number;
  quality?: string;
};

type PexelsSearchResponse = {
  videos: {
    video_files: PexelsVideoFile[];
  }[];
};

type PixabayVideoHit = {
  videos: {
    large?: { url: string; width: number; height: number };
    medium?: { url: string; width: number; height: number };
    small?: { url: string; width: number; height: number };
  };
};

type PixabayVideoResponse = {
  hits: PixabayVideoHit[];
};

export type StockResult = {
  url: string;
  source: "pexels" | "pixabay";
  query?: string;
};

const GENERIC_TERMS = new Set([
  "cinematic",
  "b-roll",
  "broll",
  "travel",
  "landmark",
  "aerial",
  "city",
  "nature",
  "sunset",
  "skyline",
  "street",
  "culture",
  "historic",
  "architecture",
  "scenic",
  "tourism",
  "tourist",
  "attractions",
  "golden",
  "hour",
  "daily",
  "life",
  "local",
  "authentic",
  "hidden",
  "gems",
  "food",
  "market",
  "outro",
  "video",
  "guide",
  "places",
  "best",
  "top",
]);

function pickBestPexelsFile(files: PexelsVideoFile[]): string | null {
  const mp4s = files.filter(
    (f) => f.link?.includes(".mp4") && f.width >= 640 && f.width <= 1920,
  );
  const pool = mp4s.length > 0 ? mp4s : files.filter((f) => f.link?.includes(".mp4"));
  const sorted = [...pool].sort(
    (a, b) => Math.abs(a.width - 1280) - Math.abs(b.width - 1280),
  );
  return sorted[0]?.link ?? null;
}

function pickBestPixabayUrl(videos: PixabayVideoHit["videos"]): string | null {
  return (
    videos.large?.url ?? videos.medium?.url ?? videos.small?.url ?? null
  );
}

function uniqueQueries(...parts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const q = part?.trim();
    if (!q || q.length < 2 || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    out.push(q);
  }
  return out;
}

/** Pull a named landmark from narration, e.g. "The Alamo — historic..." → "The Alamo". */
export function extractNamedPlaceFromScene(sceneText: string): string | null {
  const trimmed = sceneText.trim();
  if (!trimmed) return null;

  const beforeDash = trimmed.split(/\s*[—–-]\s+/)[0]?.trim();
  if (beforeDash && beforeDash.length >= 3 && beforeDash.length <= 90) {
    return beforeDash;
  }

  const beforeComma = trimmed.split(",")[0]?.trim();
  if (
    beforeComma &&
    beforeComma.length >= 3 &&
    beforeComma.length <= 90 &&
    beforeComma.split(/\s+/).length <= 12
  ) {
    return beforeComma;
  }

  const words = trimmed.split(/\s+/).slice(0, 8).join(" ");
  return words.length >= 3 ? words : null;
}

function specificKeywordTokens(keywords: string): string[] {
  return keywords
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC_TERMS.has(w));
}

/** Score how well a query matches scene context (higher = more specific). */
function scoreQuery(query: string, sceneText: string, topic: string): number {
  const q = query.toLowerCase();
  let score = 0;
  const named = extractNamedPlaceFromScene(sceneText);
  if (named && q.includes(named.toLowerCase().slice(0, 12))) score += 10;

  for (const token of specificKeywordTokens(topic)) {
    if (q.includes(token)) score += 3;
  }
  for (const token of specificKeywordTokens(sceneText)) {
    if (q.includes(token)) score += 2;
  }

  const genericCount = [...GENERIC_TERMS].filter((t) => q.includes(t)).length;
  score -= genericCount;

  return score;
}

/** Build prioritized search queries — specific place names first, generic last. */
export function buildStockQueries(
  sceneKeywords: string,
  topic: string,
  sceneText?: string,
): string[] {
  const keywords = sceneKeywords.trim();
  const topicPlace = extractPlaceName(topic);
  const namedPlace = sceneText ? extractNamedPlaceFromScene(sceneText) : null;

  const keywordTokens = specificKeywordTokens(keywords);
  const specificKw = keywordTokens.slice(0, 5).join(" ");
  const shortKeywords = keywords.split(/\s+/).slice(0, 6).join(" ");

  const queries = uniqueQueries(
    namedPlace && topicPlace ? `${namedPlace} ${topicPlace}` : undefined,
    namedPlace && specificKw ? `${namedPlace} ${specificKw}` : undefined,
    namedPlace ?? undefined,
    keywords,
    specificKw || undefined,
    shortKeywords,
    topicPlace && specificKw ? `${specificKw} ${topicPlace}` : undefined,
    topicPlace && keywords ? `${keywords} ${topicPlace}` : undefined,
    topicPlace || undefined,
    topic.trim(),
    topicPlace ? `${topicPlace} landmark travel` : undefined,
    "cinematic travel b-roll",
  );

  return queries.sort(
    (a, b) =>
      scoreQuery(b, sceneText ?? "", topic) - scoreQuery(a, sceneText ?? "", topic),
  );
}

async function searchPexelsCandidates(query: string): Promise<StockResult[]> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return [];

  const results: StockResult[] = [];
  const seen = new Set<string>();

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`,
      { headers: { Authorization: pexelsKey } },
    );
    if (!res.ok) return results;

    const data = (await res.json()) as PexelsSearchResponse;
    for (const video of data.videos ?? []) {
      const link = pickBestPexelsFile(video.video_files ?? []);
      if (link && !seen.has(link)) {
        seen.add(link);
        results.push({ url: link, source: "pexels", query });
      }
    }
  } catch {
    return results;
  }

  return results;
}

async function searchPixabayCandidates(query: string): Promise<StockResult[]> {
  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (!pixabayKey) return [];

  const results: StockResult[] = [];
  const seen = new Set<string>();

  try {
    const res = await fetch(
      `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(query)}&per_page=12`,
    );
    if (!res.ok) return results;

    const data = (await res.json()) as PixabayVideoResponse;
    for (const hit of data.hits ?? []) {
      const link = pickBestPixabayUrl(hit.videos);
      if (link && !seen.has(link)) {
        seen.add(link);
        results.push({ url: link, source: "pixabay", query });
      }
    }
  } catch {
    return results;
  }

  return results;
}

async function collectCandidates(
  query: string,
  limit = 12,
): Promise<StockResult[]> {
  const pexels = await searchPexelsCandidates(query);
  const pixabay = await searchPixabayCandidates(query);
  return [...pexels, ...pixabay].slice(0, limit);
}

/** Preview top stock matches for a scene (editor UI). */
export async function previewStockForScene(input: {
  sceneKeywords: string;
  topic: string;
  sceneText?: string;
  limit?: number;
}): Promise<{ query: string; results: StockResult[] }[]> {
  const queries = buildStockQueries(
    input.sceneKeywords,
    input.topic,
    input.sceneText,
  ).slice(0, 4);

  const previews: { query: string; results: StockResult[] }[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const hits = await collectCandidates(query, 3);
    const unique = hits.filter((h) => {
      if (seen.has(h.url)) return false;
      seen.add(h.url);
      return true;
    });
    if (unique.length > 0) {
      previews.push({ query, results: unique });
    }
    if (seen.size >= (input.limit ?? 6)) break;
  }

  return previews;
}

/** Try multiple queries and skip clips already used in this render. */
export async function searchStockVideoWithFallback(
  sceneKeywords: string,
  topic: string,
  usedUrls: Set<string>,
  sceneText?: string,
): Promise<StockResult> {
  const queries = buildStockQueries(sceneKeywords, topic, sceneText);

  for (const query of queries) {
    const pexels = await searchPexelsCandidates(query);
    for (const hit of pexels) {
      if (!usedUrls.has(hit.url)) return hit;
    }

    const pixabay = await searchPixabayCandidates(query);
    for (const hit of pixabay) {
      if (!usedUrls.has(hit.url)) return hit;
    }
  }

  throw new Error(
    `No stock video for scene (keywords: "${sceneKeywords}"). Tried: ${queries.slice(0, 6).join(" → ")}`,
  );
}

export async function searchStockVideoUrl(
  query: string,
): Promise<StockResult | null> {
  try {
    return await searchStockVideoWithFallback(query, query, new Set());
  } catch {
    return null;
  }
}

export function hasStockApiKeys(): boolean {
  return Boolean(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY);
}

export function suggestKeywordsFromScene(
  sceneText: string,
  topic: string,
): string {
  const named = extractNamedPlaceFromScene(sceneText);
  const place = extractPlaceName(topic);
  const tokens = specificKeywordTokens(sceneText).slice(0, 4);

  return uniqueQueries(
    named && place ? `${named} ${place}` : undefined,
    named && tokens.length ? `${named} ${tokens.join(" ")}` : undefined,
    tokens.length ? `${tokens.join(" ")} ${place}` : undefined,
    place,
  )[0] ?? sceneText.split(/\s+/).slice(0, 5).join(" ");
}
