import Link from "next/link";
import { db } from "@/lib/db";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

type ProjectListItem = Awaited<
  ReturnType<
    typeof db.project.findMany<{
      include: { _count: { select: { scenes: true } } };
    }>
  >
>[number];

export default async function DashboardPage() {
  let projects: ProjectListItem[] = [];
  let dbError: string | null = null;

  try {
    projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { scenes: true } } },
    });
  } catch {
    dbError =
      "Database not connected. Run: docker compose up -d && npm run db:migrate";
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your videos</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Create once, publish to YouTube and Instagram.
            </p>
          </div>
          <Link
            href="/create"
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            New video
          </Link>
        </div>

        {dbError && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {dbError}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">No projects yet.</p>
            <Link
              href="/create"
              className="mt-4 inline-block text-sm font-medium underline"
            >
              Create your first video
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="block rounded-xl border border-zinc-200 p-5 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {project.status}
                  </p>
                  <h2 className="mt-1 font-semibold">{project.title}</h2>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {project.topic}
                  </p>
                <p className="mt-3 text-xs text-zinc-500">
                  {project._count.scenes} scenes ·{" "}
                  {new Date(project.createdAt).toLocaleDateString()} ·{" "}
                  <span className="text-blue-600 underline dark:text-blue-400">
                    Open videos
                  </span>
                  {project.status === "FAILED" && project.lastRenderError && (
                    <span className="mt-1 block truncate text-red-600 dark:text-red-400">
                      {project.lastRenderError}
                    </span>
                  )}
                </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
