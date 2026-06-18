import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCreatorProfile,
  updateCreatorProfile,
} from "@/lib/creator/profile";

export async function GET() {
  const profile = await getCreatorProfile();
  return NextResponse.json({ profile });
}

const patchSchema = z.object({
  displayName: z.string().max(80).optional(),
  voiceId: z.string().max(40).optional(),
  layout: z.enum(["PIP_CORNER", "PIP_LARGE", "SPLIT_BOTTOM"]).optional(),
  brandColor: z.string().max(20).optional(),
});

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const profile = await updateCreatorProfile(parsed.data);
  return NextResponse.json({ profile });
}
