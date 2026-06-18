import type { GeneratedScript, GeneratedScene } from "@/lib/types";

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

function normalizeScene(raw: Record<string, unknown>, index: number): GeneratedScene {
  return {
    order: typeof raw.order === "number" ? raw.order : index,
    text: String(raw.text ?? "").trim(),
    keywords: normalizeKeywords(raw.keywords) || "cinematic b-roll",
    durationSec:
      typeof raw.durationSec === "number"
        ? Math.min(Math.max(raw.durationSec, 3), 12)
        : 5,
  };
}

function normalizeScript(parsed: Record<string, unknown>, topic: string): GeneratedScript {
  const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const scenes = rawScenes.map((s, i) =>
    normalizeScene(s as Record<string, unknown>, i),
  );

  const script =
    typeof parsed.script === "string" && parsed.script.trim()
      ? parsed.script.trim()
      : scenes.map((s) => s.text).join("\n\n");

  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : topic.trim().slice(0, 80) || "Untitled video";

  return { title, script, scenes };
}

function buildDemoScript(topic: string): GeneratedScript {
  const title = topic.trim().slice(0, 80) || "Untitled video";
  const scenes = [
    {
      order: 0,
      text: `Welcome! Today we're exploring ${topic}.`,
      keywords: `${topic} intro cinematic`,
      durationSec: 5,
    },
    {
      order: 1,
      text: `Here are three key ideas you should know about ${topic}.`,
      keywords: `${topic} ideas explainer`,
      durationSec: 6,
    },
    {
      order: 2,
      text: `First — why ${topic} matters right now.`,
      keywords: `${topic} importance technology`,
      durationSec: 5,
    },
    {
      order: 3,
      text: `Second — common mistakes people make with ${topic}.`,
      keywords: `${topic} mistakes tips`,
      durationSec: 5,
    },
    {
      order: 4,
      text: `Third — how to get started with ${topic} today.`,
      keywords: `${topic} tutorial beginner`,
      durationSec: 6,
    },
    {
      order: 5,
      text: `If this helped, follow for more on ${topic}. See you next time!`,
      keywords: `${topic} outro subscribe`,
      durationSec: 4,
    },
  ];

  const script = scenes.map((s) => s.text).join("\n\n");

  return { title, script, scenes };
}

async function generateWithOpenAI(topic: string): Promise<GeneratedScript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildDemoScript(topic);
  }

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
          content:
            "You write short-form video scripts. Return JSON: { title, script, scenes: [{ order, text, keywords, durationSec }] }. 5-7 scenes, 30-60 seconds total. keywords MUST be a single string of 2-5 words for stock video search (e.g. \"paris eiffel tower sunset\"), NOT an array.",
        },
        {
          role: "user",
          content: `Topic: ${topic}`,
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
  return normalizeScript(parsed, topic);
}

export async function generateScript(topic: string): Promise<GeneratedScript> {
  if (process.env.OPENAI_API_KEY) {
    return generateWithOpenAI(topic);
  }
  return buildDemoScript(topic);
}
