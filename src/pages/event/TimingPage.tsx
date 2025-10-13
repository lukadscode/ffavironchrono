import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { initSocket, getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import TimingTable from "@/components/timing/TimingTable";
import DebugTimings from "@/components/timing/DebugTimings";

type Race = {
  id: string;
  name: string;
  race_number: number;
  RaceCrews: {
    id: string;
    lane: number;
    Crew: {
      id: string;
      club_name: string;
    };
  }[];
};

type TimingPoint = {
  id: string;
  label: string;
  order_index: number;
  distance_m: number;
  event_id: string;
};

type Timing = {
  id: string;
  timestamp: string;
  manual_entry: boolean;
  status: string;
};

type Assignment = {
  id: string;
  timing_id: string;
  crew_id: string;
};

export default function TimingPage() {
  const { timingPointId, eventId } = useParams();
  const { toast } = useToast();

  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [timings, setTimings] = useState<Timing[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { id: string; crew_id: string }[]>>({});
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [liveTime, setLiveTime] = useState<string>("");
  const [debugMode, setDebugMode] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [timingPoints, setTimingPoints] = useState<TimingPoint[]>([]);
  const [currentTimingPoint, setCurrentTimingPoint] = useState<TimingPoint | null>(null);

  const socketRef = useRef<any>(null);

  // Initialisation socket + watch timing point
  useEffect(() => {
    if (!eventId || !timingPointId) return;

    const socket = initSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connecté :", socket.id);
    });

    socket.emit("watchTimingPoint", { timing_point_id: timingPointId });

    socket.on(
      "timingPointViewerCount",
      ({ timing_point_id, count }: { timing_point_id: string; count: number }) => {
        if (timing_point_id === timingPointId) {
          setViewerCount((prev) => {
            if (count > prev) {
              setTimeout(() => {
                toast({
                  title: "Nouvelle connexion",
                  description: `Un autre poste s'est connecté à ce point de chronométrage`,
                });
              }, 0);
            }
            return count;
          });
        }
      }
    );

    return () => {
      socket.emit("unwatchTimingPoint", { timing_point_id: timingPointId });
    };
  }, [eventId, timingPointId]);

  // Réactions à la sélection de course
  useEffect(() => {
    if (!eventId || !selectedRaceId || !timingPointId) return;

    const socket = socketRef.current;

    socket.emit("joinRoom", { event_id: eventId, race_id: selectedRaceId });

    socket.on("timingImpulse", (data: Timing) => {
      setTimings((prev) => {
        const exists = prev.some((t) => t.id === data.id);
        if (exists) return prev;
        return [...prev, data];
      });
    });


    socket.on("timingAssigned", ({ timing_id, crew_id }: { timing_id: string; crew_id: string }) => {
      setAssignments((prev) => {
        const existing = prev[timing_id] || [];
        const alreadyAssigned = existing.some((a) => a.crew_id === crew_id);
        if (alreadyAssigned) return prev;

        return {
          ...prev,
          [timing_id]: [...existing, { id: "", crew_id }],
        };
      });
    });

    fetchTimings();
    fetchAssignments();

    return () => {
      socket.emit("leaveRoom", { event_id: eventId, race_id: selectedRaceId });
    };
  }, [selectedRaceId]);

  useEffect(() => {
    fetchRaces();
    syncServerTime();
    fetchTimingPoints();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() + serverTimeOffset;
      setLiveTime(dayjs(now).format("HH:mm:ss.SSS"));
    }, 50);
    return () => clearInterval(interval);
  }, [serverTimeOffset]);

  const fetchTimingPoints = async () => {
    try {
      const res = await api.get(`/timing-points/event/${eventId}`);
      const sorted = res.data.data.sort(
        (a: TimingPoint, b: TimingPoint) => a.order_index - b.order_index
      );
      setTimingPoints(sorted);
      const current = sorted.find((tp: TimingPoint) => tp.id === timingPointId);
      setCurrentTimingPoint(current || null);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les points de chronométrage",
        variant: "destructive",
      });
    }
  };

  const fetchRaces = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const mapped = res.data.data.map((race: any) => ({
        ...race,
        RaceCrews: (race.race_crews || []).map((rc: any) => ({
          id: rc.id,
          lane: rc.lane,
          Crew: rc.crew ? {
            id: rc.crew.id,
            club_name: rc.crew.club_name
          } : null
        }))
      }));
      const sorted = mapped.sort((a: Race, b: Race) => a.race_number - b.race_number);
      setRaces(sorted);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les courses",
        variant: "destructive",
      });
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await api.get(`/timing-assignments/race/${selectedRaceId}`);
      const mapped: Record<string, { id: string; crew_id: string }[]> = {};

      res.data.data.forEach((a: Assignment) => {
        if (!mapped[a.timing_id]) {
          mapped[a.timing_id] = [];
        }
        mapped[a.timing_id].push({ id: a.id, crew_id: a.crew_id });
      });

      setAssignments(mapped);
    } catch {
      toast({
        title: "Erreur",
        description: "Chargement des affectations échoué",
        variant: "destructive",
      });
    }
  };

  const fetchTimings = async () => {
    try {
      const res = await api.get(`/timings/event/${eventId}`);
      setTimings(res.data.data);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les timings",
        variant: "destructive",
      });
    }
  };

  const syncServerTime = async () => {
    try {
      const res = await api.get("/server-time");
      const serverTime = new Date(res.data.server_time).getTime();
      const localTime = Date.now();
      setServerTimeOffset(serverTime - localTime);
    } catch {
      toast({
        title: "Erreur",
        description: "Échec synchronisation heure serveur",
        variant: "destructive",
      });
    }
  };

  const handleManualTiming = async () => {
    const timestamp = new Date(Date.now() + serverTimeOffset).toISOString();
    try {
      const res = await api.post("/timings", {
        timing_point_id: timingPointId,
        timestamp,
        manual_entry: true,
        status: "pending",
      });
      setTimings((prev) => {
        const exists = prev.some((t) => t.id === res.data.data.id);
        if (exists) return prev;
        return [...prev, res.data.data];
      });
      toast({ title: "Timing ajouté", description: timestamp });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le timing",
        variant: "destructive",
      });
    }
  };

  const crewIdToRaceName = useMemo(() => {
    const map: Record<string, string> = {};
    races.forEach((race) => {
      if (race.RaceCrews) {
        race.RaceCrews.forEach((rc) => {
          if (rc.Crew?.id) map[rc.Crew.id] = race.name;
        });
      }
    });
    Object.values(assignments).flat().forEach(({ crew_id }) => {
      if (!map[crew_id]) {
        for (const race of races) {
          if (race.RaceCrews?.some((rc) => rc.Crew?.id === crew_id)) {
            map[crew_id] = race.name;
            break;
          }
        }
      }
    });
    return map;
  }, [races, assignments]);

  const selectedRace = useMemo(() => {
    return races.find((r) => r.id === selectedRaceId) ?? null;
  }, [races, selectedRaceId]);

  const crewIdsInSelectedRace = useMemo(() => {
    return selectedRace?.RaceCrews?.map((rc) => rc.Crew?.id).filter(Boolean) ?? [];
  }, [selectedRace]);

  const visibleTimings = useMemo(() => {
    return timings.filter((timing) => {
      if (timing.status === "hidden") return false;
      const assigned = assignments[timing.id];
      if (timing.status === "assigned") {
        return assigned?.some((a) => crewIdsInSelectedRace.includes(a.crew_id));
      }
      return true;
    });
  }, [timings, assignments, crewIdsInSelectedRace]);

  const hiddenTimings = timings.filter((timing) => timing.status === "hidden");

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4">
      <Card className="shadow-md border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            🎯 Chronométrage {currentTimingPoint && (
              <>
                – <span className="text-blue-600">{currentTimingPoint.label}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  ({currentTimingPoint.distance_m}m)
                </span>
                {currentTimingPoint.order_index === 1 && (
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                    DÉPART
                  </span>
                )}
                {timingPoints.length > 0 && currentTimingPoint.order_index === timingPoints.length && (
                  <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                    ARRIVÉE
                  </span>
                )}
              </>
            )}
            <span className="ml-auto text-sm font-mono text-muted-foreground">
              🧍 {viewerCount} poste{viewerCount > 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Select onValueChange={setSelectedRaceId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une course" />
            </SelectTrigger>
            <SelectContent>
              {races.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  #{r.race_number} – {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-2 w-full">
            <div className="px-3 py-1 rounded-md bg-muted font-mono text-sm text-center">
              {liveTime}
            </div>
            <div className="flex gap-2">
              <Button className="w-full" size="lg" onClick={handleManualTiming}>
                ⏱️ Stop Timing
              </Button>
              <Button variant="outline" onClick={() => setDebugMode((prev) => !prev)}>
                {debugMode ? "Quitter Debug" : "🛠️ Debug"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedRace && selectedRaceId && timingPointId && (
        <TimingTable
          race={selectedRace}
          visibleTimings={visibleTimings}
          assignments={assignments}
          setAssignments={setAssignments}
          setTimings={setTimings}
          crewIdsInSelectedRace={crewIdsInSelectedRace}
          selectedRaceId={selectedRaceId}
          timingPointId={timingPointId}
          crewIdToRaceName={crewIdToRaceName}
          currentTimingPoint={currentTimingPoint}
          timingPoints={timingPoints}
          eventId={eventId!}
        />
      )}

      {debugMode && (
        <DebugTimings hiddenTimings={hiddenTimings} setTimings={setTimings} toast={toast} />
      )}
    </div>
  );
}
