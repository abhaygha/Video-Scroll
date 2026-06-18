import type { CompositingLayout } from "@/generated/prisma/client";

export type LayoutKey = CompositingLayout;

/** FFmpeg overlay filter for creator photo/video on stock footage. */
export function buildCreatorOverlayFilter(
  layout: LayoutKey,
  durationSec: number,
): string {
  const dur = String(durationSec);

  const scaleCorner =
    `[1:v]scale=480:-2:force_original_aspect_ratio=decrease,` +
    `pad=480:640:(ow-iw)/2:(oh-ih)/2:color=white,` +
    `fps=30,setpts=PTS-STARTPTS,trim=duration=${dur}[creator]`;

  const scaleLarge =
    `[1:v]scale=680:-2:force_original_aspect_ratio=decrease,` +
    `pad=680:900:(ow-iw)/2:(oh-ih)/2:color=white,` +
    `fps=30,setpts=PTS-STARTPTS,trim=duration=${dur}[creator]`;

  const scaleSplit =
    `[0:v]scale=1920:540:force_original_aspect_ratio=increase,crop=1920:540,fps=30[top];` +
    `[1:v]scale=1920:540:force_original_aspect_ratio=increase,crop=1920:540,` +
    `fps=30,setpts=PTS-STARTPTS,trim=duration=${dur}[bottom];` +
    `[top][bottom]vstack=inputs=2[vout]`;

  switch (layout) {
    case "SPLIT_BOTTOM":
      return scaleSplit;
    case "PIP_LARGE":
      return (
        scaleLarge +
        `;[0:v][creator]overlay=main_w-overlay_w-48:main_h-overlay_h-48:shortest=1[vout]`
      );
    case "PIP_CORNER":
    default:
      return (
        scaleCorner +
        `;[0:v][creator]overlay=main_w-overlay_w-56:main_h-overlay_h-64:shortest=1[vout]`
      );
  }
}

export const LAYOUT_LABELS: Record<LayoutKey, string> = {
  PIP_CORNER: "Corner photo (classic)",
  PIP_LARGE: "Large travel photo (recommended)",
  SPLIT_BOTTOM: "Split screen — you + scenery",
};
