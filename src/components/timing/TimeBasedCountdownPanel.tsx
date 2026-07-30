import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer, Flag } from "lucide-react";
import { formatDuration } from "@/utils/formatTime";
import {
  formatRaceDistanceLabel,
  getTimeBasedRemainingMs,
  type RaceDistanceInfo,
} from "@/utils/raceDistance";

type Props = {
  distance: RaceDistanceInfo;
  raceStatus: string;
  startTime?: string | null;
  serverTimeOffset: number;
  isFinishPoint: boolean;
};

export default function TimeBasedCountdownPanel({
  distance,
  raceStatus,
  startTime,
  serverTimeOffset,
  isFinishPoint,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now() + serverTimeOffset);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now() + serverTimeOffset);
    }, 100);
    return () => clearInterval(interval);
  }, [serverTimeOffset]);

  const durationSeconds = distance.duration_seconds || 0;
  const remainingMs = useMemo(
    () =>
      raceStatus === "in_progress" && startTime
        ? getTimeBasedRemainingMs(startTime, durationSeconds, nowMs)
        : durationSeconds * 1000,
    [raceStatus, startTime, durationSeconds, nowMs]
  );

  const isRunning = raceStatus === "in_progress" && !!startTime;
  const isFinished = isRunning && remainingMs !== null && remainingMs <= 0;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          Épreuve au temps
          <Badge variant="outline">{formatRaceDistanceLabel(distance)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">
            {isFinished
              ? "Temps écoulé — enregistrez les arrivées"
              : isRunning
                ? "Temps restant"
                : "Durée de l'épreuve"}
          </p>
          <p className="font-mono text-4xl font-semibold text-primary">
            {formatDuration(remainingMs ?? durationSeconds * 1000)}
          </p>
        </div>
        {isFinishPoint && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Flag className="h-4 w-4 text-accent" />
            Au signal de fin, enregistrez l&apos;impulsion d&apos;arrivée pour
            chaque équipage (distance parcourue = classement).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
