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

export async function searchStockVideoUrl(
  query: string,
): Promise<{ url: string; source: "pexels" | "pixabay" } | null> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const res = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
        { headers: { Authorization: pexelsKey } },
      );
      if (res.ok) {
        const data = (await res.json()) as PexelsSearchResponse;
        for (const video of data.videos ?? []) {
          const link = pickBestPexelsFile(video.video_files ?? []);
          if (link) return { url: link, source: "pexels" };
        }
      }
    } catch {
      // try pixabay
    }
  }

  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (pixabayKey) {
    try {
      const res = await fetch(
        `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(query)}&per_page=8`,
      );
      if (res.ok) {
        const data = (await res.json()) as PixabayVideoResponse;
        for (const hit of data.hits ?? []) {
          const link = pickBestPixabayUrl(hit.videos);
          if (link) return { url: link, source: "pixabay" };
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function hasStockApiKeys(): boolean {
  return Boolean(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY);
}
