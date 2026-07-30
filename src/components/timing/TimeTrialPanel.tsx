import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlarmClock,
  ChevronRight,
  Flag,
  Play,
  Timer,
} from "lucide-react";
import dayjs from "dayjs";
import {
  type TimeTrialRace,
  formatCountdown,
  getCountdownMs,
  getCrewLabel,
  getNextTimeTrialRace,
  getUpcomingTimeTrialRaces,
  isTimeTrialRace,
} from "@/utils/timeTrial";

type Props = {
  races: TimeTrialRace[];
  selectedRaceId: string | null;
  serverTimeOffset: number;
  onSelectRace: (raceId: string) => void;
  onGunStart: (raceId: string, startTime?: string) => void;
  isStartPoint: boolean;
  isGunStartLoading?: boolean;
};

export default function TimeTrialPanel({
  races,
  selectedRaceId,
  serverTimeOffset,
  onSelectRace,
  onGunStart,
  isStartPoint,
  isGunStartLoading,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now() + serverTimeOffset);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now() + serverTimeOffset);
    }, 250);
    return () => clearInterval(interval);
  }, [serverTimeOffset]);

  const upcoming = getUpcomingTimeTrialRaces(races, nowMs);
  const nextRace = getNextTimeTrialRace(races, nowMs);
  const selectedRace = races.find((r) => r.id === selectedRaceId) ?? null;
  const focusRace =
    selectedRace && isTimeTrialRace(selectedRace) ? selectedRace : nextRace;

  const countdownMs = focusRace
    ? getCountdownMs(focusRace.start_time, nowMs)
    : null;

  const handleSelectNext = useCallback(() => {
    if (nextRace) onSelectRace(nextRace.id);
  }, [nextRace, onSelectRace]);

  const prevStatusRef = useRef<string | undefined>(undefined);

  // Auto-sélection du prochain départ si aucune course TT sélectionnée
  useEffect(() => {
    if (!nextRace) return;
    const current = races.find((r) => r.id === selectedRaceId);
    if (!current || !isTimeTrialRace(current)) {
      onSelectRace(nextRace.id);
    }
  }, [nextRace?.id, selectedRaceId, races, onSelectRace]);

  // Auto-avance après fin de course (transition in_progress → non_official)
  useEffect(() => {
    if (!selectedRace || !isTimeTrialRace(selectedRace)) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = selectedRace.status;

    if (
      prev === "in_progress" &&
      (selectedRace.status === "non_official" || selectedRace.status === "official")
    ) {
      const next = getNextTimeTrialRace(
        races.filter((r) => r.id !== selectedRace.id),
        nowMs
      );
      if (next) onSelectRace(next.id);
    }
  }, [selectedRace, selectedRace?.status, races, nowMs, onSelectRace]);

  if (upcoming.length === 0) return null;

  const isImminent = countdownMs !== null && countdownMs <= 0;
  const isSoon = countdownMs !== null && countdownMs > 0 && countdownMs <= 60_000;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-5 w-5 text-primary" />
            Parcours contre la montre
          </CardTitle>
          <Badge variant="outline">{upcoming.length} départs restants</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {focusRace && (
          <div
            className={`rounded-lg border p-4 ${
              isImminent
                ? "border-accent bg-accent/5"
                : isSoon
                  ? "border-yellow-400 bg-yellow-50/50"
                  : "border-border bg-muted/30"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {focusRace.status === "in_progress" ? "En course" : "Prochain départ"}
                </p>
                <p className="text-lg font-semibold">
                  #{focusRace.race_number} — {getCrewLabel(focusRace)}
                </p>
                {focusRace.start_time && (
                  <p className="text-sm text-muted-foreground">
                    Prévu à {dayjs(focusRace.start_time).format("HH:mm:ss")}
                  </p>
                )}
              </div>
              {countdownMs !== null && focusRace.status === "not_started" && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1 justify-center">
                    <AlarmClock className="h-3.5 w-3.5" />
                    Compte à rebours
                  </p>
                  <p
                    className={`font-mono text-4xl font-bold tabular-nums ${
                      isImminent ? "text-accent" : isSoon ? "text-yellow-700" : "text-primary"
                    }`}
                  >
                    {isImminent ? "GO!" : formatCountdown(countdownMs)}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleSelectNext}>
                <ChevronRight className="h-4 w-4 mr-1" />
                Prochain départ
              </Button>
              {isStartPoint && focusRace.status === "not_started" && (
                <Button
                  size="sm"
                  onClick={() =>
                    onGunStart(
                      focusRace.id,
                      focusRace.start_time || undefined
                    )
                  }
                  disabled={isGunStartLoading}
                  className="gap-1"
                >
                  {isImminent || isSoon ? (
                    <>
                      <Play className="h-4 w-4" />
                      Top départ
                    </>
                  ) : (
                    <>
                      <Flag className="h-4 w-4" />
                      Lancer au créneau
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            File d'attente
          </p>
          <ScrollArea className="h-[180px]">
            <div className="space-y-1 pr-3">
              {upcoming.slice(0, 15).map((race, idx) => {
                const cd = getCountdownMs(race.start_time, nowMs);
                const isActive = race.id === selectedRaceId;
                return (
                  <button
                    key={race.id}
                    type="button"
                    onClick={() => onSelectRace(race.id)}
                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs opacity-70 w-5">
                        {idx + 1}
                      </span>
                      <span className="truncate font-medium">
                        {getCrewLabel(race)}
                      </span>
                      {race.status === "in_progress" && (
                        <Badge
                          variant={isActive ? "secondary" : "outline"}
                          className="text-[10px] shrink-0"
                        >
                          EN COURS
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-xs shrink-0 ml-2">
                      {race.start_time
                        ? dayjs(race.start_time).format("HH:mm:ss")
                        : "—"}
                      {cd !== null && race.status === "not_started" && cd > 0 && (
                        <span className="ml-2 opacity-70">
                          ({formatCountdown(cd)})
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
