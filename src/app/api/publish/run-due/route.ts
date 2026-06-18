import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runScheduledPublish } from "@/lib/publish/scheduler";

export async function POST() {
  const due = await db.publishJob.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
    },
    distinct: ["projectId"],
    select: { projectId: true },
  });

  const results = [];
  for (const job of due) {
    try {
      await runScheduledPublish(job.projectId);
      await db.publishJob.updateMany({
        where: {
          projectId: job.projectId,
          status: "SCHEDULED",
        },
        data: { status: "COMPLETED" },
      });
      results.push({ projectId: job.projectId, ok: true });
    } catch (err) {
      results.push({
        projectId: job.projectId,
        ok: false,
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
