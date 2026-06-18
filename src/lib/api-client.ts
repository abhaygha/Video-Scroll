/** Parse API JSON safely — empty 500 bodies become readable errors. */
export async function parseJsonResponse<T = Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      `Server returned an empty response (${res.status}). Run: npm run dev`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Server error (${res.status}). Restart the dev server and try again.`,
    );
  }
}
