import { NextResponse } from "next/server";
import { checkFfmpeg } from "@/lib/media/ffmpeg";
import { hasStockApiKeys } from "@/lib/media/stock";
import { db } from "@/lib/db";

export async function GET() {
  const ffmpeg = await checkFfmpeg();
  let database = false;

  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  return NextResponse.json({
    status: "ok",
    ffmpeg,
    database,
    stockFootage: hasStockApiKeys(),
    pexels: Boolean(process.env.PEXELS_API_KEY),
    pixabay: Boolean(process.env.PIXABAY_API_KEY),
    demoMode: !process.env.OPENAI_API_KEY,
  });
}
