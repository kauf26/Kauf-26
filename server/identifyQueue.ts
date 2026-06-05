/**
 * In-memory FIFO identify queue with configurable concurrency.
 * (Lightweight implementation — add `p-queue` later if you prefer that library.)
 */

export const IDENTIFY_QUEUE_CONCURRENCY = Number(
  process.env.IDENTIFY_QUEUE_CONCURRENCY ?? 3
);
/** Must exceed vision + SCRAPE_CALL_TIMEOUT_MS (see server/index.ts) */
export const IDENTIFY_JOB_TIMEOUT_MS = Number(
  process.env.IDENTIFY_JOB_TIMEOUT_MS ?? 40_000
);

export class IdentifyJobTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentifyJobTimeoutError";
  }
}

type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

const waiting: QueueTask<unknown>[] = [];
let active = 0;
let jobSeq = 0;

export function getIdentifyQueueStats() {
  return {
    waiting: waiting.length,
    active,
    concurrency: IDENTIFY_QUEUE_CONCURRENCY,
  };
}

function logQueueSnapshot(label: string, jobId: number) {
  const stats = getIdentifyQueueStats();
  console.log(
    `[IdentifyQueue] ${label} job=#${jobId} waiting=${stats.waiting} active=${stats.active} concurrency=${stats.concurrency}`
  );
}

function pumpQueue() {
  while (active < IDENTIFY_QUEUE_CONCURRENCY && waiting.length > 0) {
    const task = waiting.shift()!;
    active++;
    const jobId = (task as QueueTask<unknown> & { jobId?: number }).jobId;

    void (async () => {
      const start = Date.now();
      if (jobId != null) logQueueSnapshot("started", jobId);
      try {
        const result = await task.run();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      } finally {
        active--;
        if (jobId != null) {
          logQueueSnapshot(`finished in ${Date.now() - start}ms`, jobId);
        }
        pumpQueue();
      }
    })();
  }
}

export function enqueueIdentifyJob<T>(run: () => Promise<T>): Promise<T> {
  const jobId = ++jobSeq;
  logQueueSnapshot("enqueued", jobId);

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const queued = new Promise<T>((resolve, reject) => {
    const task: QueueTask<T> & { jobId: number } = {
      jobId,
      run,
      resolve,
      reject,
    };
    waiting.push(task as QueueTask<unknown>);
    pumpQueue();
  });

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new IdentifyJobTimeoutError(
          `Identify job #${jobId} exceeded ${IDENTIFY_JOB_TIMEOUT_MS}ms`
        )
      );
    }, IDENTIFY_JOB_TIMEOUT_MS);
  });

  return Promise.race([queued, timeout]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  });
}
