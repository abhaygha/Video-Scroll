import "dotenv/config";
import { Worker } from "bullmq";
import { renderProject } from "@/lib/media/render";
import { QUEUE_NAME } from "@/lib/queue/render-queue";
import { db } from "@/lib/db";
import { runScheduledPublish } from "@/lib/publish/scheduler";

const url = process.env.REDIS_URL?.trim();
if (!url) {
  console.error("REDIS_URL is required to run the render worker.");
  process.exit(1);
}

console.log(`[worker] Listening on queue "${QUEUE_NAME}"…`);

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { projectId } = job.data as { projectId: string };
    console.log(`[worker] Rendering project ${projectId}`);
    await renderProject(projectId);
    console.log(`[worker] Done ${projectId}`);
  },
  { connection: { url }, concurrency: 1 },
);

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] Error:", err);
});

async function processScheduledPublishes() {
  const due = await db.publishJob.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
    },
    distinct: ["projectId"],
    select: { projectId: true },
  });

  for (const job of due) {
    try {
      await runScheduledPublish(job.projectId);
      await db.publishJob.updateMany({
        where: { projectId: job.projectId, status: "SCHEDULED" },
        data: { status: "COMPLETED" },
      });
      console.log(`[worker] Published scheduled project ${job.projectId}`);
    } catch (err) {
      console.error(`[worker] Scheduled publish failed ${job.projectId}:`, err);
    }
  }
}

setInterval(() => {
  processScheduledPublishes().catch(console.error);
}, 60_000);
