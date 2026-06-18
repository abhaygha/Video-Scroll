import type { GeneratedScript, GeneratedScene } from "@/lib/types";
import {
  buildScriptPromptRules,
  clampSceneDuration,
  getEffectiveDurationMin,
  getVideoLengthConfig,
} from "@/lib/video-length";
import {
  buildPlaceScriptRules,
  extractPlaceName,
  isPlaceTopic,
  MIN_CITY_PLACES,
} from "@/lib/topic-intent";

/** OpenAI sometimes returns keywords as an array — DB expects a single string. */
export function normalizeKeywords(keywords: unknown): string {
  if (Array.isArray(keywords)) {
    return keywords
      .map((k) => String(k).trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(" ");
  }
  if (typeof keywords === "string") return keywords.trim();
  return "";
}

function normalizeScene(
  raw: Record<string, unknown>,
  index: number,
  targetDurationMin: number,
): GeneratedScene {
  const config = getVideoLengthConfig(targetDurationMin);
  const rawDuration =
    typeof raw.durationSec === "number" ? raw.durationSec : config.sceneDurationMin;

  return {
    order: typeof raw.order === "number" ? raw.order : index,
    text: String(raw.text ?? "").trim(),
    keywords: normalizeKeywords(raw.keywords) || "cinematic b-roll",
    durationSec: clampSceneDuration(rawDuration, targetDurationMin),
    isHook: Boolean(raw.isHook) || index === 0,
  };
}

function assignAssetOrders(
  scenes: GeneratedScene[],
  assetCount: number,
): GeneratedScene[] {
  if (assetCount <= 0) return scenes;
  let idx = 0;
  return scenes.map((scene) => {
    if (scene.isHook) return { ...scene, assetOrder: null };
    const assetOrder = idx % assetCount;
    idx += 1;
    return { ...scene, assetOrder };
  });
}

function countPlaceBodyScenes(scenes: GeneratedScene[]): number {
  if (scenes.length <= 2) return 0;
  return scenes.slice(1, -1).length;
}

function normalizeScript(
  parsed: Record<string, unknown>,
  topic: string,
  targetDurationMin: number,
): GeneratedScript {
  const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const scenes = rawScenes.map((s, i) =>
    normalizeScene(s as Record<string, unknown>, i, targetDurationMin),
  );

  const hook =
    typeof parsed.hook === "string" && parsed.hook.trim()
      ? parsed.hook.trim().slice(0, 120)
      : scenes[0]?.text.slice(0, 120) || `Wait until you see ${topic}…`;

  if (scenes[0]) {
    scenes[0].isHook = true;
    if (!scenes[0].text) scenes[0].text = hook;
  }

  const script =
    typeof parsed.script === "string" && parsed.script.trim()
      ? parsed.script.trim()
      : scenes.map((s) => s.text).join("\n\n");

  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : topic.trim().slice(0, 80) || "Untitled video";

  return { title, script, hook, scenes };
}

function buildDemoPlaceScenes(
  placeName: string,
  targetDurationMin: number,
): GeneratedScene[] {
  const config = getVideoLengthConfig(targetDurationMin);
  const hook = `${MIN_CITY_PLACES} places in ${placeName} you cannot skip…`;

  const placeTemplates = [
    { name: "Historic downtown district", kw: "historic downtown architecture" },
    { name: "Main city museum", kw: "museum art gallery" },
    { name: "Central park or plaza", kw: "city park green space" },
    { name: "Iconic skyline viewpoint", kw: "skyline aerial sunset" },
    { name: "Local food market", kw: "food market street vendors" },
    { name: "Famous bridge or waterfront", kw: "river waterfront bridge" },
    { name: "Historic cathedral or temple", kw: "cathedral historic architecture" },
    { name: "Arts and culture district", kw: "street art murals culture" },
    { name: "Botanical garden", kw: "botanical garden flowers" },
    { name: "Nightlife entertainment strip", kw: "nightlife neon city" },
    { name: "Scenic hiking trail", kw: "hiking trail nature" },
    { name: "Family-friendly science center", kw: "science museum family" },
    { name: "Hidden neighborhood cafe strip", kw: "cafe street local" },
    { name: "Sports stadium or arena", kw: "stadium sports city" },
    { name: "University campus landmark", kw: "university campus architecture" },
    { name: "Beach or lakeside promenade", kw: "lake beach promenade" },
    { name: "Historic fort or monument", kw: "monument landmark statue" },
    { name: "Local brewery or winery", kw: "brewery tasting room" },
    { name: "Shopping district", kw: "shopping street boutiques" },
    { name: "Scenic drive or lookout", kw: "mountain lookout scenic" },
  ];

  const scenes: GeneratedScene[] = [
    {
      order: 0,
      text: hook,
      keywords: `${placeName} cinematic aerial skyline`,
      durationSec: clampSceneDuration(4, targetDurationMin),
      isHook: true,
    },
  ];

  for (let i = 0; i < MIN_CITY_PLACES; i++) {
    const t = placeTemplates[i % placeTemplates.length];
    const suffix = i >= placeTemplates.length ? ` (spot ${i + 1})` : "";
    scenes.push({
      order: i + 1,
      text: `${t.name}${suffix} — one of the best stops in ${placeName}. Locals and travelers come here for the atmosphere, views, and stories behind every corner.`,
      keywords: `${placeName} ${t.kw}`,
      durationSec: clampSceneDuration(
        config.sceneDurationMin + (i % 4),
        targetDurationMin,
      ),
    });
  }

  scenes.push({
    order: scenes.length,
    text: `Save this ${placeName} guide before your trip — follow for more hidden gems!`,
    keywords: `${placeName} travel outro sunset`,
    durationSec: clampSceneDuration(5, targetDurationMin),
  });

  scenes.forEach((s, i) => {
    s.order = i;
  });

  return scenes;
}

function buildDemoScript(
  topic: string,
  targetDurationMin: number,
): GeneratedScript {
  const placeName = extractPlaceName(topic) || topic;
  if (isPlaceTopic(topic)) {
    const scenes = buildDemoPlaceScenes(placeName, targetDurationMin);
    const hook = scenes[0].text;
    return {
      title: `${MIN_CITY_PLACES} Best Places in ${placeName}`,
      script: scenes.map((s) => s.text).join("\n\n"),
      hook,
      scenes,
    };
  }

  const config = getVideoLengthConfig(targetDurationMin);
  const title = topic.trim().slice(0, 80) || "Untitled video";
  const hook = `Nobody talks about ${topic} like this…`;

  const bodyTemplates = [
    {
      text: `Here's what makes ${topic} absolutely unforgettable.`,
      keywords: `${topic} landmark travel`,
    },
    {
      text: `First — the moment that stops everyone in their tracks.`,
      keywords: `${topic} sunset golden hour`,
    },
    {
      text: `Second — the hidden side most tourists never see.`,
      keywords: `${topic} street culture local`,
    },
    {
      text: `Third — how locals actually experience ${topic} every day.`,
      keywords: `${topic} daily life authentic`,
    },
    {
      text: `The history behind ${topic} is more surprising than you think.`,
      keywords: `${topic} history architecture`,
    },
    {
      text: `Don't miss these spots when you visit ${topic}.`,
      keywords: `${topic} tourist attractions`,
    },
    {
      text: `Pro tip: the best time to see ${topic} is early morning.`,
      keywords: `${topic} sunrise morning`,
    },
    {
      text: `Food and culture around ${topic} deserve their own trip.`,
      keywords: `${topic} food market culture`,
    },
  ];

  const sceneCount = Math.round((config.sceneMin + config.sceneMax) / 2);
  const bodyCount = Math.max(1, sceneCount - 2);

  const scenes: GeneratedScene[] = [
    {
      order: 0,
      text: hook,
      keywords: `${topic} cinematic aerial`,
      durationSec: clampSceneDuration(4, targetDurationMin),
      isHook: true,
    },
  ];

  for (let i = 0; i < bodyCount; i++) {
    const template = bodyTemplates[i % bodyTemplates.length];
    scenes.push({
      order: i + 1,
      text: template.text,
      keywords: template.keywords,
      durationSec: clampSceneDuration(
        config.sceneDurationMin + (i % 3),
        targetDurationMin,
      ),
    });
  }

  scenes.push({
    order: scenes.length,
    text: `Save this before your next trip. Follow for more on ${topic}!`,
    keywords: `${topic} travel outro`,
    durationSec: clampSceneDuration(4, targetDurationMin),
  });

  scenes.forEach((s, i) => {
    s.order = i;
  });

  const script = scenes.map((s) => s.text).join("\n\n");

  return { title, script, hook, scenes };
}

async function expandPlaceScenesWithOpenAI(
  placeName: string,
  existing: GeneratedScript,
  targetDurationMin: number,
  needed: number,
): Promise<GeneratedScene[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || needed <= 0) return existing.scenes;

  const existingPlaces = existing.scenes
    .slice(1, -1)
    .map((s) => s.text.slice(0, 120))
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Add MORE place scenes for a travel video. Return JSON: { "scenes": [{ "text", "keywords", "durationSec" }] }
Each scene = ONE new real named place in ${placeName}. No repeats. keywords = 3-6 visual search terms.`,
        },
        {
          role: "user",
          content: `Destination: ${placeName}\nAlready covered:\n${existingPlaces}\n\nAdd exactly ${needed} NEW distinct named places.`,
        },
      ],
    }),
  });

  if (!response.ok) return existing.scenes;

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  const parsed = JSON.parse(data.choices[0].message.content) as {
    scenes: Record<string, unknown>[];
  };

  const extra = (parsed.scenes ?? []).map((s, i) =>
    normalizeScene(s, existing.scenes.length + i, targetDurationMin),
  );

  const hook = existing.scenes[0];
  const outro = existing.scenes[existing.scenes.length - 1];
  const body = [...existing.scenes.slice(1, -1), ...extra];

  return [hook, ...body, outro].map((s, i) => ({ ...s, order: i }));
}

async function generateWithOpenAI(
  topic: string,
  targetDurationMin: number,
): Promise<GeneratedScript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildDemoScript(topic, targetDurationMin);
  }

  const placeName = extractPlaceName(topic) || topic;
  const placeMode = isPlaceTopic(topic);
  const lengthRules = buildScriptPromptRules(topic, targetDurationMin);
  const placeRules = placeMode ? buildPlaceScriptRules(placeName) : "";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: placeMode ? 8000 : 4000,
      messages: [
        {
          role: "system",
          content: `You write engaging video scripts for YouTube and Instagram travel content.

Return JSON:
{
  "title": string,
  "hook": string (1 punchy sentence, max 15 words — pattern interrupt, curiosity gap),
  "script": string (full narration),
  "scenes": [{ "order", "text", "keywords", "durationSec", "isHook" }]
}

Rules:
${lengthRules}
${placeRules}
- Scene 0 MUST have isHook: true and use the hook text (shorter duration)
- Final scene should be an outro CTA (save/follow/plan trip)
- Write in first person when the creator appears in the video — energetic, enjoying the experience
- keywords MUST be a single string of 3-6 concrete visual search terms tied to what is spoken
- keywords must match the specific place or subject in that scene (NOT generic "city skyline" unless that is the scene)
- Avoid generic filler — every body scene should teach the viewer something specific`,
        },
        {
          role: "user",
          content: placeMode
            ? `Create a comprehensive "${placeName}" travel guide video.\nMinimum ${MIN_CITY_PLACES} named places required.\nTarget length: ${targetDurationMin} minute(s).\nThe creator's photos will be composited in — write as if they visited each spot.`
            : `Topic: ${topic}\nTarget video length: ${targetDurationMin} minute(s)\nThe creator's own photos will be composited into scenes — write as if they are personally there enjoying it.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const parsed = JSON.parse(data.choices[0].message.content) as Record<
    string,
    unknown
  >;
  let result = normalizeScript(parsed, topic, targetDurationMin);

  if (placeMode) {
    const placeCount = countPlaceBodyScenes(result.scenes);
    if (placeCount < MIN_CITY_PLACES) {
      const needed = MIN_CITY_PLACES - placeCount;
      console.warn(
        `[generate-script] Only ${placeCount} places for ${placeName}, expanding by ${needed}…`,
      );
      const expanded = await expandPlaceScenesWithOpenAI(
        placeName,
        result,
        targetDurationMin,
        needed,
      );
      result = {
        ...result,
        scenes: expanded,
        script: expanded.map((s) => s.text).join("\n\n"),
      };
    }
  }

  return result;
}

export async function generateScript(
  topic: string,
  targetDurationMin = 1,
  assetCount = 0,
): Promise<GeneratedScript & { effectiveDurationMin: number }> {
  const effectiveDurationMin = getEffectiveDurationMin(topic, targetDurationMin);
  let script: GeneratedScript;
  if (process.env.OPENAI_API_KEY) {
    script = await generateWithOpenAI(topic, effectiveDurationMin);
  } else {
    script = buildDemoScript(topic, effectiveDurationMin);
  }
  script.scenes = assignAssetOrders(script.scenes, assetCount);
  return { ...script, effectiveDurationMin };
}
