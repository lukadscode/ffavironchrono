import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import { CheckCircle2, Clock } from "lucide-react";

type Category = {
  id: string;
  code: string;
  label: string;
  age_group: string;
  gender: string;
  boat_seats: number;
  has_coxswain: boolean;
};

type TimingPoint = {
  id: string;
  label: string;
  order_index: number;
  distance_m: number;
};

type TimingResult = {
  crew_id: string;
  lane: number;
  relative_time_ms: number | null;
  club_name: string;
  club_code: string;
  category?: Category;
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  race_phase_id?: string;
  race_phase?: {
    id: string;
    name: string;
  };
  results: TimingResult[];
};

export default function ArbitresPage() {
  const { eventId } = useParams();
  const { toast } = useToast();
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastTimingPoint, setLastTimingPoint] = useState<TimingPoint | null>(null);

  useEffect(() => {
    if (eventId) {
      fetchTimingPoints();
      fetchRaces();
    }
  }, [eventId]);

  const fetchTimingPoints = async () => {
    try {
      const res = await api.get(`/timing-points/event/${eventId}`);
      const timingPoints = res.data.data || [];
      const sorted = timingPoints.sort((a: TimingPoint, b: TimingPoint) => b.order_index - a.order_index);
      // Le dernier timing point est celui avec le plus grand order_index
      if (sorted.length > 0) {
        setLastTimingPoint(sorted[0]);
      }
    } catch (err) {
      console.error("Erreur chargement timing points", err);
    }
  };

  const fetchRaces = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const racesData = res.data.data || [];

      // Filtrer uniquement les courses en statut "non_official"
      const nonOfficialRaces = racesData.filter((r: any) => r.status === "non_official");

      if (!lastTimingPoint) {
        // Attendre que les timing points soient chargés
        setRaces(nonOfficialRaces.map((r: any) => ({ ...r, results: [] })));
        return;
      }

      const racesWithResults = await Promise.all(
        nonOfficialRaces.map(async (race: any) => {
          try {
            // Récupérer les timings de la course
            const timingsRes = await api.get(`/timings/race/${race.id}`);
            const allTimings = timingsRes.data.data || [];

            // Filtrer uniquement les timings du dernier timing point
            const finishTimings = allTimings.filter(
              (t: any) => t.timing_point_id === lastTimingPoint.id && t.relative_time_ms !== null
            );

            // Récupérer les assignments pour avoir les crew_id
            const assignmentsRes = await api.get(`/timing-assignments/race/${race.id}`);
            const assignments = assignmentsRes.data.data || [];

            // Créer un map timing_id -> crew_id
            const timingToCrew = new Map<string, string>();
            assignments.forEach((a: any) => {
              if (a.timing_id && a.crew_id) {
                timingToCrew.set(a.timing_id, a.crew_id);
              }
            });

            // Récupérer les race-crews pour avoir les infos des équipages
            const raceCrewsRes = await api.get(`/race-crews/${race.id}`);
            const raceCrews = raceCrewsRes.data.data || [];

            // Créer un map crew_id -> infos
            const crewInfoMap = new Map();
            raceCrews.forEach((rc: any) => {
              if (rc.crew_id) {
                crewInfoMap.set(rc.crew_id, {
                  lane: rc.lane || 0,
                  club_name: rc.crew?.club_name || "N/A",
                  club_code: rc.crew?.club_code || "N/A",
                  category: rc.crew?.category || undefined,
                });
              }
            });

            // Construire les résultats
            const results: TimingResult[] = finishTimings
              .map((timing: any) => {
                const crewId = timing.crew_id || timingToCrew.get(timing.id);
                if (!crewId) return null;

                const crewInfo = crewInfoMap.get(crewId);
                if (!crewInfo) return null;

                return {
                  crew_id: crewId,
                  lane: crewInfo.lane,
                  relative_time_ms: timing.relative_time_ms,
                  club_name: crewInfo.club_name,
                  club_code: crewInfo.club_code,
                  category: crewInfo.category,
                };
              })
              .filter((r: TimingResult | null): r is TimingResult => r !== null);

            // Trier par temps (le plus rapide en premier)
            const sorted = results.sort((a, b) => {
              if (a.relative_time_ms === null) return 1;
              if (b.relative_time_ms === null) return -1;
              return a.relative_time_ms - b.relative_time_ms;
            });

            return {
              ...race,
              results: sorted,
            };
          } catch (err) {
            console.error(`Erreur chargement résultats course ${race.id}:`, err);
            return { ...race, results: [] };
          }
        })
      );

      const sorted = racesWithResults.sort((a, b) => a.race_number - b.race_number);
      setRaces(sorted);
    } catch (err) {
      console.error("Erreur chargement courses", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les courses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Recharger les courses quand le dernier timing point est disponible
  useEffect(() => {
    if (lastTimingPoint && eventId) {
      fetchRaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTimingPoint]);

  const handleValidateRace = async (raceId: string) => {
    try {
      await api.put(`/races/${raceId}`, { status: "official" });
      toast({
        title: "Course validée",
        description: "La course est maintenant officielle",
      });
      // Retirer la course de la liste
      setRaces((prev) => prev.filter((r) => r.id !== raceId));
      if (selectedRaceId === raceId) {
        setSelectedRaceId(null);
      }
    } catch (err) {
      console.error("Erreur validation course", err);
      toast({
        title: "Erreur",
        description: "Impossible de valider la course",
        variant: "destructive",
      });
    }
  };

  const formatTime = (ms: number | null) => {
    if (ms === null || ms === undefined) return "N/A";
    if (isNaN(ms)) return "N/A";

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  };

  const formatTimeDifference = (ms: number) => {
    if (ms === 0) return "0.000";
    const absMs = Math.abs(ms);
    const totalSeconds = Math.floor(absMs / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);
    const milliseconds = absMs % 1000;
    
    const sign = ms < 0 ? "-" : "+";
    
    if (minutes > 0) {
      return `${sign}${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
    }
    return `${sign}${seconds}.${milliseconds.toString().padStart(3, "0")}`;
  };

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Validation des résultats - Arbitres</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste des courses */}
        <Card>
          <CardHeader>
            <CardTitle>Courses en attente de validation</CardTitle>
          </CardHeader>
          <CardContent>
            {races.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune course en attente de validation
              </p>
            ) : (
              <div className="space-y-2">
                {races.map((race) => (
                  <button
                    key={race.id}
                    onClick={() => setSelectedRaceId(race.id)}
                    className={`w-full text-left p-4 rounded-lg border transition ${
                      selectedRaceId === race.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white hover:bg-slate-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          Course {race.race_number} - {race.name}
                        </p>
                        {race.race_phase && (
                          <p className={`text-sm ${selectedRaceId === race.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            Phase: {race.race_phase.name}
                          </p>
                        )}
                        <p className={`text-xs mt-1 ${selectedRaceId === race.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {dayjs(race.start_time).format("HH:mm")} • {race.results.length} résultats
                        </p>
                      </div>
                      <Clock className={`w-5 h-5 ${selectedRaceId === race.id ? "text-primary-foreground" : "text-yellow-500"}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Résultats de la course sélectionnée */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedRace
                  ? `Résultats - Course ${selectedRace.race_number}`
                  : "Sélectionnez une course"}
              </CardTitle>
              {selectedRace && (
                <Button
                  onClick={() => handleValidateRace(selectedRace.id)}
                  className="gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider comme officiel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRace ? (
              <p className="text-center text-muted-foreground py-8">
                Sélectionnez une course pour voir ses résultats
              </p>
            ) : selectedRace.results.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun résultat disponible pour cette course
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 font-semibold">Classement</th>
                      <th className="text-left py-2 px-4 font-semibold">Couloir</th>
                      <th className="text-left py-2 px-4 font-semibold">Club</th>
                      <th className="text-left py-2 px-4 font-semibold">Catégorie</th>
                      <th className="text-right py-2 px-4 font-semibold">Temps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const sortedResults = [...selectedRace.results];
                      const firstPlaceTime = sortedResults.length > 0 && sortedResults[0].relative_time_ms !== null
                        ? sortedResults[0].relative_time_ms
                        : null;

                      return sortedResults.map((result, index) => {
                        const position = index + 1;
                        const timeDifference = firstPlaceTime !== null && result.relative_time_ms !== null
                          ? result.relative_time_ms - firstPlaceTime
                          : null;

                        return (
                          <tr
                            key={result.crew_id}
                            className={`border-b hover:bg-slate-50 ${
                              position === 1
                                ? "bg-yellow-50"
                                : position === 2
                                  ? "bg-gray-50"
                                  : position === 3
                                    ? "bg-orange-50"
                                    : ""
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-lg">
                              {position === 1 && "🥇"}
                              {position === 2 && "🥈"}
                              {position === 3 && "🥉"}
                              <span className={position <= 3 ? "ml-1" : ""}>
                                {position}
                              </span>
                            </td>
                            <td className="py-3 px-4">{result.lane}</td>
                            <td className="py-3 px-4">
                              <div className="font-semibold">{result.club_name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{result.club_code}</div>
                            </td>
                            <td className="py-3 px-4">
                              {result.category?.label ? (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                  {result.category.label}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="font-mono font-semibold">
                                {formatTime(result.relative_time_ms)}
                              </div>
                              {timeDifference !== null && timeDifference !== 0 && (
                                <div className="text-xs text-muted-foreground mt-1 font-mono">
                                  {formatTimeDifference(timeDifference)}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

