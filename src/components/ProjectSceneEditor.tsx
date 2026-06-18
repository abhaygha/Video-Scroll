"use client";

import { useState } from "react";
import { SceneEditor, type EditableScene } from "@/components/SceneEditor";

type ProjectSceneEditorProps = {
  projectId: string;
  topic: string;
  initialScenes: EditableScene[];
};

export function ProjectSceneEditor({
  projectId,
  topic,
  initialScenes,
}: ProjectSceneEditorProps) {
  const [scenes, setScenes] = useState(initialScenes);

  return (
    <SceneEditor
      projectId={projectId}
      topic={topic}
      scenes={scenes}
      onScenesChange={setScenes}
    />
  );
}
