import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const DOWNLOAD_TIMEOUT_MS = 120_000;

export async function downloadToFile(
  url: string,
  destPath: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Download failed (${res.status})`);
    }
    if (!res.body) {
      throw new Error("Download failed: empty response");
    }

    await pipeline(
      Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(destPath),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Download timed out after 2 minutes. Try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
