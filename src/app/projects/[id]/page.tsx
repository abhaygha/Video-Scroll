import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/Header";
import { ProjectActions } from "@/components/ProjectActions";
import { ProjectSceneEditor } from "@/components/ProjectSceneEditor";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function completedRender(
  renders: {
    format: string;
    status: string;
    filePath: string | null;
    error: string | null;
  }[],
  format: string,
) {
  return renders.find(
    (r) => r.format === format && r.status === "COMPLETED" && r.filePath,
  );
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      renders: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) notFound();

  const sceneErrors = project.scenes
    .filter((s) => s.error)
    .map((s) => ({ order: s.order, error: s.error }));

  const videos = [
    {
      label: "YouTube (16:9)",
      format: "landscape",
      render: completedRender(project.renders, "LANDSCAPE_16_9"),
    },
    {
      label: "Instagram Reel (9:16)",
      format: "portrait",
      render: completedRender(project.renders, "PORTRAIT_9_16"),
    },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          ← Back to dashboard
        </Link>

        <h1 className="mt-4 text-2xl font-semibold">{project.title}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {project.topic}
        </p>
        <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
          {project.status}
          {project.renderProgress > 0 && project.status === "RENDERING"
            ? ` · ${project.renderProgress}%`
            : ""}
        </p>

        <ProjectActions
          projectId={project.id}
          initialStatus={project.status}
          initialProgress={project.renderProgress}
          initialStep={project.renderStep}
          initialError={project.lastRenderError}
          hasScenes={project.scenes.length > 0}
          hook={project.hook}
          sceneErrors={sceneErrors}
        />

        <ul className="mt-8 space-y-6">
          {videos.map(({ label, format, render }) => {
            const previewUrl = `/api/projects/${project.id}/video?format=${format}`;
            const downloadUrl = `${previewUrl}&download=1`;
            const ready = Boolean(render?.filePath);

            return (
              <li
                key={format}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="font-medium">{label}</p>
                <p className="text-xs text-zinc-500">
                  {ready ? "Ready" : "Not rendered yet"}
                </p>

                {ready ? (
                  <>
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      className="mt-3 w-full rounded-lg bg-black"
                      src={previewUrl}
                    />
                    <div className="mt-3 flex flex-wrap gap-3">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        Open in new tab
                      </a>
                      <a
                        href={downloadUrl}
                        className="cursor-pointer rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        Download MP4
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    {project.scenes.length === 0
                      ? "Generate a script first from Create."
                      : "Click Render video above to create this format."}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {project.scenes.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Edit scenes
            </h2>
            <div className="mt-3">
              <ProjectSceneEditor
                projectId={project.id}
                topic={project.topic}
                initialScenes={project.scenes.map((s) => ({
                  id: s.id,
                  order: s.order,
                  text: s.text,
                  keywords: s.keywords,
                  durationSec: s.durationSec,
                  isHook: s.isHook,
                }))}
              />
            </div>
          </section>
        )}
      </main>
    </>
  );
}
