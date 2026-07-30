import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { initSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  Clock,
  Flag,
  Play,
  ShieldAlert,
} from "lucide-react";
import dayjs from "dayjs";

type RaceSummary = {
  id: string;
  name: string;
  race_number: number;
  status: string;
  start_time: string | null;
  race_type?: string;
  race_crews?: { crew?: { club_name?: string } }[];
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "À venir",
  in_progress: "En course",
  non_official: "À valider",
  official: "Officiel",
  finished: "Terminé",
  delayed: "Retard",
  cancelled: "Annulé",
};

type Props = {
  eventId: string;
};

export default function EventLiveDashboard({ eventId }: Props) {
  const navigate = useNavigate();
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRaces = useCallback(async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      setRaces(res.data.data || []);
    } catch {
      setRaces([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchRaces();
    const interval = setInterval(fetchRaces, 20_000);
    return () => clearInterval(interval);
  }, [fetchRaces]);

  useEffect(() => {
    const socket = initSocket();
    socket.emit("joinRoom", { event_id: eventId });

    const onStatus = (payload: { race_id: string; status: string }) => {
      setRaces((prev) =>
        prev.map((r) =>
          r.id === payload.race_id ? { ...r, status: payload.status } : r
        )
      );
    };

    socket.on("raceStatusUpdate", onStatus);
    socket.on("gunStart", () => fetchRaces());
    socket.on("falseStart", () => fetchRaces());

    return () => {
      socket.off("raceStatusUpdate", onStatus);
      socket.off("gunStart");
      socket.off("falseStart");
      socket.emit("leaveRoom", { event_id: eventId });
    };
  }, [eventId, fetchRaces]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of races) {
      counts[r.status] = (counts[r.status] || 0) + 1;
    }
    return counts;
  }, [races]);

  const inProgress = races.filter((r) => r.status === "in_progress");
  const toValidate = races.filter((r) => r.status === "non_official");
  const upcoming = races
    .filter((r) => r.status === "not_started" && r.start_time)
    .sort(
      (a, b) =>
        new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime()
    )
    .slice(0, 5);

  if (loading) return null;
  if (races.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Tableau de bord live
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {stats.in_progress ? (
              <Badge className="gap-1 bg-primary">
                <Play className="h-3 w-3" />
                {stats.in_progress} en course
              </Badge>
            ) : null}
            {stats.non_official ? (
              <Badge variant="secondary" className="gap-1">
                <ShieldAlert className="h-3 w-3" />
                {stats.non_official} à valider
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatPill icon={<Flag className="h-4 w-4" />} label="Total" value={races.length} />
          <StatPill icon={<Play className="h-4 w-4" />} label="En course" value={stats.in_progress || 0} accent />
          <StatPill icon={<ShieldAlert className="h-4 w-4" />} label="À valider" value={stats.non_official || 0} />
          <StatPill icon={<CheckCircle2 className="h-4 w-4" />} label="Officielles" value={stats.official || 0} />
        </div>

        {inProgress.length > 0 && (
          <Section title="Courses en cours">
            {inProgress.map((race) => (
              <RaceRow key={race.id} race={race} />
            ))}
          </Section>
        )}

        {toValidate.length > 0 && (
          <Section title="En attente de validation arbitre">
            {toValidate.slice(0, 5).map((race) => (
              <RaceRow key={race.id} race={race} />
            ))}
            {toValidate.length > 5 && (
              <Button
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => navigate(`/event/${eventId}/arbitres`)}
              >
                Voir les {toValidate.length} courses →
              </Button>
            )}
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section title="Prochains départs">
            {upcoming.map((race) => (
              <RaceRow key={race.id} race={race} showTime />
            ))}
          </Section>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => navigate(`/event/${eventId}/timing`)}>
            Ouvrir le chrono
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/event/${eventId}/arbitres`)}>
            Validation arbitre
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${accent ? "border-primary/30 bg-primary/5" : "bg-muted/30"}`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RaceRow({ race, showTime }: { race: RaceSummary; showTime?: boolean }) {
  const crew = race.race_crews?.[0]?.crew?.club_name;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="font-medium truncate">
          #{race.race_number} {crew || race.name}
        </p>
        {showTime && race.start_time && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {dayjs(race.start_time).format("HH:mm:ss")}
          </p>
        )}
      </div>
      <Badge variant="outline" className="shrink-0 text-xs">
        {STATUS_LABELS[race.status] || race.status}
      </Badge>
    </div>
  );
}
