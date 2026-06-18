export type GeneratedScene = {
  order: number;
  text: string;
  keywords: string;
  durationSec: number;
  isHook?: boolean;
};

export type GeneratedScript = {
  title: string;
  script: string;
  hook: string;
  scenes: GeneratedScene[];
};

export type CreateProjectInput = {
  topic: string;
  title?: string;
  targetDurationMin?: number;
};

export type RenderResult = {
  landscapePath: string | null;
  portraitPath: string | null;
};
