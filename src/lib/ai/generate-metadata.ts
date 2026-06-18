import type { ScrollScore } from "@/lib/ai/scroll-score";

export type ProjectMetadata = {
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string;
  instagramCaption: string;
};

export async function generateProjectMetadata(input: {
  title: string;
  topic: string;
  hook: string | null;
  script: string | null;
}): Promise<ProjectMetadata> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallback = {
    youtubeTitle: input.title.slice(0, 90),
    youtubeDescription: (input.script ?? input.topic).slice(0, 4500),
    youtubeTags: `${input.topic}, travel, vlog, adventure`,
    instagramCaption: `${input.hook ?? input.title}\n\n${input.topic}\n\n#travel #vlog #explore`,
  };

  if (!apiKey) return fallback;

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
            'Return JSON: { "youtubeTitle", "youtubeDescription", "youtubeTags" (comma-separated), "instagramCaption" (with hashtags) }. SEO-friendly for travel/vlog content.',
        },
        {
          role: "user",
          content: `Title: ${input.title}\nTopic: ${input.topic}\nHook: ${input.hook ?? ""}\nScript:\n${input.script ?? ""}`,
        },
      ],
    }),
  });

  if (!response.ok) return fallback;

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  const parsed = JSON.parse(data.choices[0].message.content) as Record<
    string,
    string
  >;

  return {
    youtubeTitle: String(parsed.youtubeTitle ?? fallback.youtubeTitle).slice(
      0,
      100,
    ),
    youtubeDescription: String(
      parsed.youtubeDescription ?? fallback.youtubeDescription,
    ).slice(0, 5000),
    youtubeTags: String(parsed.youtubeTags ?? fallback.youtubeTags).slice(
      0,
      500,
    ),
    instagramCaption: String(
      parsed.instagramCaption ?? fallback.instagramCaption,
    ).slice(0, 2200),
  };
}

export function metadataFromProject(project: {
  title: string;
  topic: string;
  script: string | null;
  hook: string | null;
  youtubeTitle: string | null;
  youtubeDescription: string | null;
  youtubeTags: string | null;
  instagramCaption: string | null;
}): ProjectMetadata {
  return {
    youtubeTitle: project.youtubeTitle ?? project.title,
    youtubeDescription:
      project.youtubeDescription ?? project.script ?? project.topic,
    youtubeTags: project.youtubeTags ?? project.topic,
    instagramCaption:
      project.instagramCaption ??
      `${project.hook ?? project.title}\n\n${project.topic}`,
  };
}

export type { ScrollScore };
