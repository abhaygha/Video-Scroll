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
};

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
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    out.push(q);
  }
  return out;
}

/** Build fallback search queries — topic nouns first, then simplified keywords. */
export function buildStockQueries(sceneKeywords: string, topic: string): string[] {
  const keywords = sceneKeywords.trim();
  const topicWords = topic.trim().split(/\s+/).filter(Boolean);
  const shortKeywords = keywords.split(/\s+/).slice(0, 4).join(" ");
  const shortTopic = topicWords.slice(0, 4).join(" ");

  return uniqueQueries(
    keywords,
    shortKeywords,
    topic.trim(),
    shortTopic,
    topicWords.length >= 2 ? `${topicWords[0]} ${topicWords[1]}` : undefined,
    "cinematic b-roll",
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
        results.push({ url: link, source: "pexels" });
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
        results.push({ url: link, source: "pixabay" });
      }
    }
  } catch {
    return results;
  }

  return results;
}

/** Try multiple queries and skip clips already used in this render. */
export async function searchStockVideoWithFallback(
  sceneKeywords: string,
  topic: string,
  usedUrls: Set<string>,
): Promise<StockResult> {
  const queries = buildStockQueries(sceneKeywords, topic);

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
    `No stock video for scene (keywords: "${sceneKeywords}"). Tried: ${queries.join(" → ")}`,
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
