import type { Task } from "@xmcl/task";
import { reportProgress } from "../../services/notifyService";

interface TrackedTask {
  progress: number;
  total: number;
  param?: { count?: number };
  onFinished?: (index: number) => void;
}

/**
 * Polls an xmcl task and reports bytes plus finished files.
 * File count comes from `param.count`. `onFinished` lives on the download
 * task itself, so it is attached when that task starts.
 */
export async function trackTask<T>(task: Task<T>, title: string): Promise<T> {
  let completed = 0;
  let totalItems: number | null = null;

  const publish = (current: TrackedTask) => {
    const loaded = Number.isFinite(current.progress) ? current.progress : 0;
    const total = Number.isFinite(current.total) ? current.total : 0;
    reportProgress({
      title,
      loadedBytes: total > 0 ? loaded : null,
      totalBytes: total > 0 ? total : null,
      completedItems: totalItems == null ? null : completed,
      totalItems,
    });
  };

  const watched = task as Task<T> & TrackedTask;
  const timer = setInterval(() => publish(watched), 200);

  try {
    return await task.startAndWait({
      onStart(started) {
        const counted = started as TrackedTask;
        const count = counted.param?.count;
        if (typeof count === "number" && count > 0) {
          totalItems = count;
          const previous = counted.onFinished;
          counted.onFinished = (index) => {
            completed += 1;
            previous?.(index);
          };
        }
      },
      onUpdate(updated) {
        publish(updated as TrackedTask);
      },
    });
  } finally {
    clearInterval(timer);
    publish(watched);
  }
}
