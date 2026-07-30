export type TimeTrialRace = {
  id: string;
  name: string;
  race_number: number;
  status: string;
  start_time?: string | null;
  race_type?: string;
  RaceCrews?: {
    id: string;
    lane: number;
    status?: string;
    Crew?: { id: string; club_name: string; club_code?: string } | null;
  }[];
};

export function isTimeTrialRace(race: TimeTrialRace): boolean {
  return race.race_type === "time_trial";
}

export function eventHasTimeTrialRaces(races: TimeTrialRace[]): boolean {
  return races.some(isTimeTrialRace);
}

export function sortByStartTime(races: TimeTrialRace[]): TimeTrialRace[] {
  return [...races].sort((a, b) => {
    const ta = a.start_time ? new Date(a.start_time).getTime() : Infinity;
    const tb = b.start_time ? new Date(b.start_time).getTime() : Infinity;
    if (ta !== tb) return ta - tb;
    return a.race_number - b.race_number;
  });
}

export function getUpcomingTimeTrialRaces(
  races: TimeTrialRace[],
  nowMs: number
): TimeTrialRace[] {
  return sortByStartTime(
    races.filter(
      (r) =>
        isTimeTrialRace(r) &&
        (r.status === "not_started" || r.status === "in_progress")
    )
  ).filter((r) => {
    if (r.status === "in_progress") return true;
    if (!r.start_time) return true;
    // Garder les départs des 2 dernières minutes (retard possible)
    return new Date(r.start_time).getTime() >= nowMs - 120_000;
  });
}

export function getCountdownMs(startTime: string | null | undefined, nowMs: number): number | null {
  if (!startTime) return null;
  return new Date(startTime).getTime() - nowMs;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function getNextTimeTrialRace(
  races: TimeTrialRace[],
  nowMs: number
): TimeTrialRace | null {
  const upcoming = getUpcomingTimeTrialRaces(races, nowMs);
  const inProgress = upcoming.find((r) => r.status === "in_progress");
  if (inProgress) return inProgress;
  return upcoming[0] ?? null;
}

export function getCrewLabel(race: TimeTrialRace): string {
  const crew = race.RaceCrews?.[0]?.Crew;
  if (!crew) return "—";
  return crew.club_code ? `${crew.club_name} (${crew.club_code})` : crew.club_name;
}
