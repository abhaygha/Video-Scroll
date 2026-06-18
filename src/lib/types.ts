export type GeneratedScene = {
  order: number;
  text: string;
  keywords: string;
  durationSec: number;
};

export type GeneratedScript = {
  title: string;
  script: string;
  scenes: GeneratedScene[];
};

export type CreateProjectInput = {
  topic: string;
  title?: string;
};

export type RenderResult = {
  landscapePath: string | null;
  portraitPath: string | null;
};
