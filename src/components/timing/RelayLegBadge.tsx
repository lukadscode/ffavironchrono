import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import {
  getRelayLegAtPoint,
  formatRaceDistanceLabel,
  type RaceDistanceInfo,
} from "@/utils/raceDistance";

type Props = {
  distance?: RaceDistanceInfo | null;
  timingPointDistanceM: number;
};

export default function RelayLegBadge({ distance, timingPointDistanceM }: Props) {
  const relayLeg = getRelayLegAtPoint(distance, timingPointDistanceM);

  if (!relayLeg) return null;

  return (
    <Badge variant="secondary" className="gap-1.5">
      <Users className="h-3.5 w-3.5" />
      Relais {relayLeg.leg}/{relayLeg.total} — {relayLeg.segmentM}m
      {distance && formatRaceDistanceLabel(distance)
        ? ` (${formatRaceDistanceLabel(distance)})`
        : ""}
    </Badge>
  );
}
