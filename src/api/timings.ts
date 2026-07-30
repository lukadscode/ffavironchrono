import api from "@/lib/axios";

export type DuplicateTiming = {
  id: string;
  timestamp: string;
  device_id: string | null;
  status: string;
  manual_entry?: boolean;
};

export type DuplicateGroup = DuplicateTiming[];

export const getDuplicateGroups = async (
  timingPointId: string,
  thresholdMs = 500
): Promise<{ groups: DuplicateGroup[]; count: number }> => {
  const res = await api.get(`/timings/point/${timingPointId}/duplicates`, {
    params: { threshold_ms: thresholdMs },
  });
  return res.data.data;
};

export const reconcileTimings = async (keepId: string, hideIds: string[]) => {
  const res = await api.post("/timings/reconcile", {
    keep_id: keepId,
    hide_ids: hideIds,
  });
  return res.data;
};
