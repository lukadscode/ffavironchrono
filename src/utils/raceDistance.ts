export type RaceDistanceInfo = {
  meters?: number | null;
  is_relay?: boolean;
  relay_count?: number | null;
  is_time_based?: boolean;
  duration_seconds?: number | null;
  label?: string | null;
};

export function formatRaceDistanceLabel(distance?: RaceDistanceInfo | null): string | null {
  if (!distance) return null;

  if (distance.is_time_based && distance.duration_seconds) {
    const mins = Math.floor(distance.duration_seconds / 60);
    const secs = distance.duration_seconds % 60;
    return mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;
  }

  if (distance.is_relay && distance.relay_count && distance.meters) {
    return `${distance.relay_count}x${distance.meters}m`;
  }

  if (distance.meters) {
    return `${distance.meters}m`;
  }

  return distance.label || null;
}

export function getRelayLegAtPoint(
  distance: RaceDistanceInfo | null | undefined,
  timingPointDistanceM: number
): { leg: number; total: number; segmentM: number } | null {
  if (!distance?.is_relay || !distance.meters || !distance.relay_count) {
    return null;
  }

  const segmentM = distance.meters;
  const leg = Math.max(1, Math.round(timingPointDistanceM / segmentM));
  return {
    leg: Math.min(leg, distance.relay_count),
    total: distance.relay_count,
    segmentM,
  };
}

export function getTimeBasedRemainingMs(
  startTime: string | null | undefined,
  durationSeconds: number,
  nowMs: number
): number | null {
  if (!startTime) return durationSeconds * 1000;
  const elapsed = nowMs - new Date(startTime).getTime();
  return Math.max(0, durationSeconds * 1000 - elapsed);
}
