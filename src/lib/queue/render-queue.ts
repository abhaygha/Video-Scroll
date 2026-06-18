import { Queue } from "bullmq";

const QUEUE_NAME = "video-scroll-render";

let queue: Queue | null = null;

function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url || null;
}

export function getRenderQueue(): Queue | null {
  const url = getRedisUrl();
  if (!url) return null;

  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: { url },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }

  return queue;
}

export async function enqueueRender(
  projectId: string,
): Promise<"queued" | "sync"> {
  const q = getRenderQueue();
  if (!q) return "sync";

  try {
    const existing = await q.getJob(projectId);
    if (existing && !(await existing.isCompleted())) {
      return "queued";
    }

    await q.add("render", { projectId }, { jobId: projectId });
    return "queued";
  } catch (err) {
    console.warn("[queue] Redis unavailable, falling back to sync render:", err);
    return "sync";
  }
}

export { QUEUE_NAME };
