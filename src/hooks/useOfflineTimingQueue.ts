import { useCallback, useEffect, useState } from "react";
import api from "@/lib/axios";

const STORAGE_PREFIX = "ffa_timing_queue_";

export type QueuedTiming = {
  localId: string;
  timing_point_id: string;
  timestamp: string;
  manual_entry: boolean;
  device_id?: string;
  retries: number;
  createdAt: string;
};

function loadQueue(timingPointId: string): QueuedTiming[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + timingPointId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(timingPointId: string, queue: QueuedTiming[]) {
  localStorage.setItem(STORAGE_PREFIX + timingPointId, JSON.stringify(queue));
}

export function useOfflineTimingQueue(
  timingPointId: string | undefined,
  onSynced?: (data: unknown) => void
) {
  const [queueLength, setQueueLength] = useState(0);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isFlushing, setIsFlushing] = useState(false);

  const refreshLength = useCallback(() => {
    if (!timingPointId) {
      setQueueLength(0);
      return;
    }
    setQueueLength(loadQueue(timingPointId).length);
  }, [timingPointId]);

  const flushQueue = useCallback(async () => {
    if (!timingPointId || !navigator.onLine) return;

    const queue = loadQueue(timingPointId);
    if (queue.length === 0) return;

    setIsFlushing(true);
    const remaining: QueuedTiming[] = [];

    for (const item of queue) {
      try {
        const res = await api.post("/timings", {
          timing_point_id: item.timing_point_id,
          timestamp: item.timestamp,
          manual_entry: item.manual_entry,
          device_id: item.device_id,
          status: "pending",
        });
        onSynced?.(res.data.data);
      } catch {
        remaining.push({ ...item, retries: item.retries + 1 });
      }
    }

    saveQueue(timingPointId, remaining);
    setQueueLength(remaining.length);
    setIsFlushing(false);
  }, [timingPointId, onSynced]);

  const enqueue = useCallback(
    (payload: Omit<QueuedTiming, "localId" | "retries" | "createdAt">) => {
      if (!timingPointId) return;
      const queue = loadQueue(timingPointId);
      queue.push({
        ...payload,
        localId: crypto.randomUUID(),
        retries: 0,
        createdAt: new Date().toISOString(),
      });
      saveQueue(timingPointId, queue);
      setQueueLength(queue.length);
    },
    [timingPointId]
  );

  const postTiming = useCallback(
    async (payload: {
      timing_point_id: string;
      timestamp: string;
      manual_entry: boolean;
      device_id?: string;
    }) => {
      try {
        const res = await api.post("/timings", {
          ...payload,
          status: "pending",
        });
        return { ok: true as const, data: res.data.data };
      } catch {
        enqueue(payload);
        return { ok: false as const, queued: true };
      }
    },
    [enqueue]
  );

  useEffect(() => {
    refreshLength();
  }, [refreshLength]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushQueue]);

  useEffect(() => {
    if (isOnline && queueLength > 0) {
      flushQueue();
    }
  }, [isOnline, queueLength, flushQueue]);

  return {
    isOnline,
    queueLength,
    isFlushing,
    postTiming,
    flushQueue,
  };
}
