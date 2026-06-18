import type { GeneratedScript, GeneratedScene } from "@/lib/types";
import {
  buildScriptPromptRules,
  clampSceneDuration,
  getVideoLengthConfig,
  normalizeTargetDurationMin,
} from "@/lib/video-length";

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

function buildDemoScript(
  topic: string,
  targetDurationMin: number,
): GeneratedScript {
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
    {
      text: `What most guides won't tell you about ${topic}.`,
      keywords: `${topic} hidden gems`,
    },
    {
      text: `Planning your visit? Here's the perfect ${topic} itinerary.`,
      keywords: `${topic} travel planning map`,
    },
    {
      text: `Budget-friendly ways to enjoy ${topic} without the crowds.`,
      keywords: `${topic} budget travel`,
    },
    {
      text: `The wildlife and nature around ${topic} will blow you away.`,
      keywords: `${topic} nature landscape`,
    },
    {
      text: `Season by season — when ${topic} looks its absolute best.`,
      keywords: `${topic} seasons weather`,
    },
    {
      text: `Photography lovers — these ${topic} angles are unmatched.`,
      keywords: `${topic} photography scenic`,
    },
    {
      text: `Safety and etiquette tips every ${topic} visitor should know.`,
      keywords: `${topic} city street`,
    },
    {
      text: `How ${topic} compares to other famous destinations worldwide.`,
      keywords: `${topic} aerial cinematic`,
    },
    {
      text: `Stories from travelers who fell in love with ${topic}.`,
      keywords: `${topic} people happy travel`,
    },
    {
      text: `The future of ${topic} — what's changing right now.`,
      keywords: `${topic} modern skyline`,
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

async function generateWithOpenAI(
  topic: string,
  targetDurationMin: number,
): Promise<GeneratedScript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildDemoScript(topic, targetDurationMin);
  }

  const lengthRules = buildScriptPromptRules(targetDurationMin);

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
          content: `You write engaging video scripts for YouTube and Instagram.

Return JSON:
{
  "title": string,
  "hook": string (1 punchy sentence, max 15 words — pattern interrupt, curiosity gap),
  "script": string (full narration),
  "scenes": [{ "order", "text", "keywords", "durationSec", "isHook" }]
}

Rules:
${lengthRules}
- Scene 0 MUST have isHook: true and use the hook text (shorter duration)
- Write in first person when the creator appears in the video — energetic, enjoying the experience
- keywords MUST be a single string of 3-6 concrete visual search terms tied to the TOPIC (e.g. "yosemite waterfall forest" NOT generic "nature")
- keywords must match what is spoken in that scene
- Avoid generic stock terms unless the topic requires them`,
        },
        {
          role: "user",
          content: `Topic: ${topic}\nTarget video length: ${targetDurationMin} minute(s)\nThe creator's own photos will be composited into scenes — write as if they are personally there enjoying it.`,
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
  return normalizeScript(parsed, topic, targetDurationMin);
}

export async function generateScript(
  topic: string,
  targetDurationMin = 1,
): Promise<GeneratedScript> {
  const minutes = normalizeTargetDurationMin(targetDurationMin);
  if (process.env.OPENAI_API_KEY) {
    return generateWithOpenAI(topic, minutes);
  }
  return buildDemoScript(topic, minutes);
}
