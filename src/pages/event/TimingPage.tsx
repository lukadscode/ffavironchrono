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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import TimingTable from "@/components/timing/TimingTable";
import TimeTrialPanel from "@/components/timing/TimeTrialPanel";
import TimeBasedCountdownPanel from "@/components/timing/TimeBasedCountdownPanel";
import RelayLegBadge from "@/components/timing/RelayLegBadge";
import ReconciliationPanel from "@/components/timing/ReconciliationPanel";
import DebugTimings from "@/components/timing/DebugTimings";
import { AdminPage } from "@/components/layout/AdminPage";
import { useOfflineTimingQueue } from "@/hooks/useOfflineTimingQueue";
import { useAuth } from "@/context/AuthContext";
import { eventHasTimeTrialRaces, getNextTimeTrialRace } from "@/utils/timeTrial";
import { getDeviceId } from "@/utils/deviceId";
import { formatTimestamp } from "@/utils/formatTime";
import { gunStart, falseStart } from "@/api/races";
import {
  Timer,
  Clock,
  Users,
  Play,
  Bug,
  MapPin,
  Trophy,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  WifiOff,
  CloudUpload,
} from "lucide-react";

type Race = {
  id: string;
  name: string;
  race_number: number;
  status: string;
  start_time?: string | null;
  race_type?: string;
  Distance?: {
    meters?: number | null;
    is_relay?: boolean;
    relay_count?: number | null;
    is_time_based?: boolean;
    duration_seconds?: number | null;
    label?: string | null;
  };
  RaceCrews: {
    id: string;
    lane: number;
    status?: string;
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
  timing_point_id: string;
  relative_time_ms?: number | null;
  crew_id?: string | null;
  race_id?: string | null;
};

type Assignment = {
  id: string;
  timing_id: string;
  crew_id: string;
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<
    string,
    { label: string; color: string; icon: any; bgColor: string }
  > = {
    not_started: {
      label: "Non démarrée",
      color: "text-gray-700",
      icon: Circle,
      bgColor: "bg-gray-100 border-gray-300",
    },
    in_progress: {
      label: "En cours",
      color: "text-blue-700",
      icon: Play,
      bgColor: "bg-blue-100 border-blue-300",
    },
    non_official: {
      label: "Non officiel",
      color: "text-yellow-700",
      icon: AlertCircle,
      bgColor: "bg-yellow-100 border-yellow-300",
    },
    official: {
      label: "Officiel",
      color: "text-green-700",
      icon: CheckCircle2,
      bgColor: "bg-green-100 border-green-300",
    },
  };

  const config = statusConfig[status] || statusConfig.not_started;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.bgColor} ${config.color}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};

export default function TimingPage() {
  const { timingPointId, eventId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const canUseDebug = import.meta.env.DEV || user?.role === "superadmin";

  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [timings, setTimings] = useState<Timing[]>([]);
  const [assignments, setAssignments] = useState<
    Record<string, { id: string; crew_id: string }[]>
  >({});
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [liveTime, setLiveTime] = useState<string>("");
  const [debugMode, setDebugMode] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [timingPoints, setTimingPoints] = useState<TimingPoint[]>([]);
  const [currentTimingPoint, setCurrentTimingPoint] =
    useState<TimingPoint | null>(null);
  const [isManualTimingLoading, setIsManualTimingLoading] = useState(false);
  const [isRaceActionLoading, setIsRaceActionLoading] = useState(false);

  const { isOnline, queueLength, isFlushing, postTiming } = useOfflineTimingQueue(
    timingPointId,
    (data) => {
      const timing = data as Timing;
      setTimings((prev) => {
        if (prev.some((t) => t.id === timing.id)) return prev;
        return [...prev, timing];
      });
    }
  );

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
      ({
        timing_point_id,
        count,
      }: {
        timing_point_id: string;
        count: number;
      }) => {
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
      if (data.timing_point_id !== timingPointId) return;
      setTimings((prev) => {
        const exists = prev.some((t) => t.id === data.id);
        if (exists) return prev;
        return [...prev, data];
      });
    });

    socket.on(
      "timingAssigned",
      async ({
        timing_id,
        crew_id,
      }: {
        timing_id: string;
        crew_id: string;
      }) => {
        // Recharger les assignments depuis l'API pour avoir les IDs corrects
        try {
          await fetchAssignments();
        } catch (err) {
          console.error("Erreur rechargement assignments après WebSocket", err);
          // Fallback: ajouter sans ID (sera corrigé au prochain fetchAssignments)
          setAssignments((prev) => {
            const existing = prev[timing_id] || [];
            const alreadyAssigned = existing.some((a) => a.crew_id === crew_id);
            if (alreadyAssigned) return prev;

            return {
              ...prev,
              [timing_id]: [...existing, { id: "", crew_id }],
            };
          });
        }
      }
    );

    socket.on("gunStart", () => {
      fetchRaces();
    });

    socket.on("falseStart", () => {
      fetchRaces();
      fetchTimings();
    });

    fetchTimings();
    fetchAssignments();

    return () => {
      socket.off("gunStart");
      socket.off("falseStart");
      socket.emit("leaveRoom", { event_id: eventId, race_id: selectedRaceId });
    };
  }, [selectedRaceId, timingPointId]);

  useEffect(() => {
    fetchRaces();
    syncServerTime();
    fetchTimingPoints();

    const interval = setInterval(syncServerTime, 60_000);
    const onOnline = () => syncServerTime();
    window.addEventListener("online", onOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (selectedRaceId) {
      fetchRaces();
    }
  }, [assignments]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() + serverTimeOffset;
      setLiveTime(formatTimestamp(new Date(now)));
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
        start_time: race.start_time,
        race_type: race.race_type,
        RaceCrews: (race.race_crews || []).map((rc: any) => ({
          id: rc.id,
          lane: rc.lane,
          status: rc.status || "registered",
          Crew: rc.crew
            ? {
                id: rc.crew.id,
                club_name: rc.crew.club_name,
              }
            : null,
        })),
      }));
      const sorted = mapped.sort(
        (a: Race, b: Race) => a.race_number - b.race_number
      );
      setRaces(sorted);

      if (!selectedRaceId && sorted.length > 0) {
        const nowMs = Date.now() + serverTimeOffset;
        const ttNext = eventHasTimeTrialRaces(sorted)
          ? getNextTimeTrialRace(sorted, nowMs)
          : null;
        const autoSelectRace =
          ttNext ||
          sorted.find(
            (r: Race) => r.status === "in_progress" || r.status === "not_started"
          );
        if (autoSelectRace) {
          setSelectedRaceId(autoSelectRace.id);
        }
      }
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

      res.data.data.forEach((a: any) => {
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
      if (!selectedRaceId) {
        setTimings([]);
        return;
      }

      const res = await api.get(`/timings/race/${selectedRaceId}`);
      const allTimings = res.data.data || [];

      const filtered = allTimings.filter(
        (t: any) => t.timing_point_id === timingPointId
      );

      setTimings(filtered);
    } catch (err) {
      console.error("Erreur chargement timings:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les timings",
        variant: "destructive",
      });
    }
  };

  const syncServerTime = async () => {
    try {
      const clientTime = new Date().toISOString();
      const res = await api.get("/server-time-offset", {
        params: { client_time: clientTime },
      });
      const serverTime = new Date(res.data.server_time).getTime();
      const offset =
        typeof res.data.offset_ms === "number"
          ? res.data.offset_ms
          : serverTime - Date.now();
      setServerTimeOffset(offset);
    } catch {
      toast({
        title: "Erreur",
        description: "Échec synchronisation heure serveur",
        variant: "destructive",
      });
    }
  };

  const handleGunStart = async (raceId?: string, startTime?: string) => {
    const targetId = raceId || selectedRaceId;
    if (!targetId) return;
    setIsRaceActionLoading(true);
    try {
      const gunTime =
        startTime || new Date(Date.now() + serverTimeOffset).toISOString();
      await gunStart(targetId, gunTime);
      if (targetId !== selectedRaceId) {
        setSelectedRaceId(targetId);
      }
      await fetchRaces();
      toast({
        title: "Départ lancé",
        description: "La course est passée en cours",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de lancer le départ",
        variant: "destructive",
      });
    } finally {
      setIsRaceActionLoading(false);
    }
  };

  const handleFalseStart = async () => {
    if (!selectedRaceId) return;
    setIsRaceActionLoading(true);
    try {
      await falseStart(selectedRaceId);
      await fetchRaces();
      await fetchTimings();
      toast({
        title: "Faux départ",
        description: "La course a été remise à zéro",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'annuler le départ",
        variant: "destructive",
      });
    } finally {
      setIsRaceActionLoading(false);
    }
  };

  const handleManualTiming = async () => {
    setIsManualTimingLoading(true);
    const timestamp = new Date(Date.now() + serverTimeOffset).toISOString();
    try {
      const result = await postTiming({
        timing_point_id: timingPointId!,
        timestamp,
        manual_entry: true,
        device_id: getDeviceId(),
      });

      if (result.ok) {
        setTimings((prev) => {
          const exists = prev.some((t) => t.id === result.data.id);
          if (exists) return prev;
          return [...prev, result.data];
        });
        toast({
          title: "Timing enregistré",
          description: `Timing manuel ajouté à ${formatTimestamp(timestamp)}`,
        });
      } else {
        toast({
          title: "Hors ligne — mis en file d'attente",
          description: "L'impulsion sera envoyée dès la reconnexion",
        });
      }
    } catch (err: unknown) {
      console.error("Erreur ajout timing:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le timing",
        variant: "destructive",
      });
    } finally {
      setIsManualTimingLoading(false);
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
    Object.values(assignments)
      .flat()
      .forEach(({ crew_id }) => {
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
    return (
      selectedRace?.RaceCrews?.map((rc) => rc.Crew?.id).filter(Boolean) ?? []
    );
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

  const isStartPoint = currentTimingPoint?.order_index === 1;
  const isFinishPoint =
    timingPoints.length > 0 &&
    currentTimingPoint?.order_index === timingPoints.length;

  const stats = useMemo(() => {
    const totalTimings = visibleTimings.length;
    const assignedTimings = visibleTimings.filter(
      (t) => assignments[t.id] && assignments[t.id].length > 0
    ).length;
    const totalCrews = selectedRace?.RaceCrews?.length || 0;
    const finishedCrews = new Set(
      Object.values(assignments)
        .flat()
        .map((a) => a.crew_id)
        .filter((id) => crewIdsInSelectedRace.includes(id))
    ).size;

    return {
      totalTimings,
      assignedTimings,
      totalCrews,
      finishedCrews,
      progress: totalCrews > 0 ? (finishedCrews / totalCrews) * 100 : 0,
    };
  }, [visibleTimings, assignments, selectedRace, crewIdsInSelectedRace]);

  // Trouver la course suivante et précédente
  const { nextRace, previousRace } = useMemo(() => {
    if (!selectedRaceId || races.length === 0) {
      return { nextRace: null, previousRace: null };
    }

    const currentIndex = races.findIndex((r) => r.id === selectedRaceId);
    if (currentIndex === -1) {
      return { nextRace: null, previousRace: null };
    }

    return {
      nextRace: currentIndex < races.length - 1 ? races[currentIndex + 1] : null,
      previousRace: currentIndex > 0 ? races[currentIndex - 1] : null,
    };
  }, [races, selectedRaceId]);

  const handleNextRace = () => {
    if (nextRace) {
      setSelectedRaceId(nextRace.id);
      toast({
        title: "Course suivante",
        description: `Passage à la course #${nextRace.race_number} - ${nextRace.name}`,
      });
    }
  };

  const handlePreviousRace = () => {
    if (previousRace) {
      setSelectedRaceId(previousRace.id);
      toast({
        title: "Course précédente",
        description: `Retour à la course #${previousRace.race_number} - ${previousRace.name}`,
      });
    }
  };

  const isTimeTrialMode = useMemo(
    () => eventHasTimeTrialRaces(races),
    [races]
  );

  const selectedRaceDistance = selectedRace?.Distance;
  const isTimeBasedRace =
    !!selectedRaceDistance?.is_time_based &&
    !!selectedRaceDistance.duration_seconds;
  const isRelayRace = !!selectedRaceDistance?.is_relay;

  const pointLabel = currentTimingPoint
    ? `${currentTimingPoint.label} (${currentTimingPoint.distance_m}m)`
    : "Chronométrage";

  return (
    <AdminPage
      title={pointLabel}
      description={
        isStartPoint
          ? "Point de départ"
          : isFinishPoint
            ? "Point d'arrivée"
            : "Point intermédiaire"
      }
      icon={Timer}
      actions={
        <div className="flex flex-wrap items-center gap-2">
            {!isOnline && (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3.5 w-3.5" />
                Hors ligne
              </Badge>
            )}
            {queueLength > 0 && (
              <Badge variant="secondary" className="gap-1">
                <CloudUpload className="h-3.5 w-3.5" />
                {isFlushing ? "Envoi…" : `${queueLength} en attente`}
              </Badge>
            )}
            {selectedRace && (
              <Badge variant="outline">
                {stats.finishedCrews}/{stats.totalCrews} arrivées
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Users className="h-3.5 w-3.5" />
              {viewerCount} poste{viewerCount !== 1 ? "s" : ""}
            </Badge>
            {isRelayRace && currentTimingPoint && (
              <RelayLegBadge
                distance={selectedRaceDistance}
                timingPointDistanceM={currentTimingPoint.distance_m}
              />
            )}
          </div>
      }
    >
      {isTimeBasedRace && selectedRace && selectedRaceDistance && (
        <TimeBasedCountdownPanel
          distance={selectedRaceDistance}
          raceStatus={selectedRace.status}
          startTime={selectedRace.start_time}
          serverTimeOffset={serverTimeOffset}
          isFinishPoint={!!isFinishPoint}
        />
      )}

      {isTimeTrialMode && (
        <TimeTrialPanel
          races={races}
          selectedRaceId={selectedRaceId}
          serverTimeOffset={serverTimeOffset}
          onSelectRace={setSelectedRaceId}
          onGunStart={handleGunStart}
          isStartPoint={!!isStartPoint}
          isGunStartLoading={isRaceActionLoading}
        />
      )}

      {timingPointId && (
        <ReconciliationPanel
          timingPointId={timingPointId}
          onReconciled={() => {
            fetchTimings();
            fetchAssignments();
          }}
        />
      )}

      {/* Contrôles */}
      <Card className="shadow-md border-2">
        <CardContent className="p-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
            {/* Sélection de course */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Sélectionner une course
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 flex-shrink-0"
                  onClick={handlePreviousRace}
                  disabled={!previousRace}
                  title={previousRace ? `Course précédente: #${previousRace.race_number}` : "Aucune course précédente"}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Select
                  onValueChange={setSelectedRaceId}
                  value={selectedRaceId || undefined}
                >
                  <SelectTrigger className="flex-1 w-full h-12 text-base">
                    <SelectValue placeholder="Choisir une course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {races.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="font-semibold">
                            #{r.race_number} – {r.name}
                          </span>
                          {getStatusBadge(r.status)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 flex-shrink-0"
                  onClick={handleNextRace}
                  disabled={!nextRace}
                  title={nextRace ? `Course suivante: #${nextRace.race_number}` : "Aucune course suivante"}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              {selectedRace && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Statut de la course:
                    </span>
                    {getStatusBadge(selectedRace.status)}
                  </div>
                  {nextRace && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextRace}
                      className="text-primary hover:text-primary/80 hover:bg-primary/10"
                    >
                      Course suivante
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Horloge et contrôles */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Horloge serveur
              </Label>
              <div className="relative">
                <div className="px-6 py-4 rounded-lg bg-primary text-primary-foreground font-mono text-3xl text-center border border-primary/30 shadow-sm">
                  {liveTime || (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-lg">Synchronisation...</span>
                    </div>
                  )}
                </div>
              </div>
              {selectedRace && isStartPoint && (
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1 h-11"
                    disabled={
                      isRaceActionLoading ||
                      selectedRace.status === "official" ||
                      selectedRace.status === "in_progress"
                    }
                    onClick={() => handleGunStart()}
                  >
                    Départ canon
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-11"
                    disabled={
                      isRaceActionLoading ||
                      selectedRace.status === "official" ||
                      selectedRace.status === "not_started"
                    }
                    onClick={handleFalseStart}
                  >
                    Faux départ
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-12 text-base font-semibold"
                  size="lg"
                  onClick={handleManualTiming}
                  disabled={isManualTimingLoading}
                >
                  {isManualTimingLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Stop Timing
                    </>
                  )}
                </Button>
                {canUseDebug && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12"
                    onClick={() => setDebugMode((prev) => !prev)}
                  >
                    {debugMode ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Quitter Debug
                      </>
                    ) : (
                      <>
                        <Bug className="w-5 h-5 mr-2" />
                        Debug
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau de timing */}
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
          raceStatus={selectedRace.status}
          onRefresh={() => {
            fetchTimings();
            fetchAssignments();
            fetchRaces();
          }}
        />
      )}

      {/* Mode debug */}
      {canUseDebug && debugMode && (
        <DebugTimings
          hiddenTimings={hiddenTimings}
          setTimings={setTimings}
          toast={toast}
        />
      )}
    </AdminPage>
  );
}
