import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import { CheckCircle2, Clock, Trophy, TrendingUp } from "lucide-react";
import { formatDuration, formatTimeDifference } from "@/utils/formatTime";

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

// Type pour les résultats indoor
type IndoorParticipantResult = {
  id: string;
  place: number;
  time_display: string;
  time_ms: number;
  distance: number;
  avg_pace: string;
  spm: number;
  calories: number;
  crew_id?: string | null;
  crew?: {
    id: string;
    club_name: string;
    club_code: string;
    category?: {
      id: string;
      code: string;
      label: string;
    };
  } | null;
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
  isIndoor?: boolean;
  indoorResults?: IndoorParticipantResult[];
};

export default function ArbitresPage() {
  const { eventId } = useParams();
  const { toast } = useToast();
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastTimingPoint, setLastTimingPoint] = useState<TimingPoint | null>(null);
  const [isIndoorEvent, setIsIndoorEvent] = useState<boolean>(false);

  useEffect(() => {
    if (eventId) {
      fetchEventType();
      fetchTimingPoints();
      fetchRaces();
    }
  }, [eventId]);

  const fetchEventType = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      const eventData = res.data.data;
      const raceType = eventData.race_type?.toLowerCase() || "";
      setIsIndoorEvent(raceType.includes("indoor"));
    } catch (err) {
      console.error("Erreur chargement type événement", err);
      setIsIndoorEvent(false);
    }
  };

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

      if (!lastTimingPoint && !isIndoorEvent) {
        // Attendre que les timing points soient chargés pour les courses normales
        setRaces(nonOfficialRaces.map((r: any) => ({ ...r, results: [], isIndoor: false })));
        return;
      }

      const racesWithResults = await Promise.all(
        nonOfficialRaces.map(async (race: any) => {
          try {
            // Pour les événements indoor, essayer d'abord de récupérer les résultats indoor
            if (isIndoorEvent) {
              try {
                const indoorRes = await api.get(`/indoor-results/race/${race.id}`);
                const indoorData = indoorRes.data.data;
                
                if (indoorData && indoorData.participants && indoorData.participants.length > 0) {
                  // C'est une course indoor avec des résultats
                  const participants = indoorData.participants.sort((a: IndoorParticipantResult, b: IndoorParticipantResult) => 
                    a.place - b.place
                  );
                  
                  return {
                    ...race,
                    isIndoor: true,
                    indoorResults: participants,
                    results: [], // Pas de résultats de timing pour les courses indoor
                  };
                }
              } catch (indoorErr: any) {
                // 404 signifie qu'il n'y a pas de résultats indoor, on continue avec les timings normaux
                if (indoorErr?.response?.status !== 404) {
                  console.error(`Erreur chargement résultats indoor course ${race.id}:`, indoorErr);
                }
              }
            }

            // Pour les courses normales ou si pas de résultats indoor, utiliser les timings
            if (!lastTimingPoint) {
              return { ...race, results: [], isIndoor: false };
            }

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
              isIndoor: false,
              results: sorted,
            };
          } catch (err) {
            console.error(`Erreur chargement résultats course ${race.id}:`, err);
            return { ...race, results: [], isIndoor: false };
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

  // Recharger les courses quand le dernier timing point est disponible ou quand le type d'événement change
  useEffect(() => {
    if (eventId && (lastTimingPoint || isIndoorEvent)) {
      fetchRaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTimingPoint, isIndoorEvent]);

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

  // Utilisation des fonctions utilitaires centralisées formatDuration et formatTimeDifference
  const formatTime = (ms: number | null) => {
    if (ms === null || ms === undefined) return "N/A";
    if (isNaN(ms)) return "N/A";
    return formatDuration(ms);
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
                          {dayjs(race.start_time).format("HH:mm")} • {race.isIndoor ? (race.indoorResults?.length || 0) : race.results.length} résultats
                          {race.isIndoor && <span className="ml-1 text-xs">(Indoor)</span>}
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
            ) : (selectedRace.isIndoor ? (!selectedRace.indoorResults || selectedRace.indoorResults.length === 0) : (selectedRace.results.length === 0)) ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun résultat disponible pour cette course
              </p>
            ) : selectedRace.isIndoor && selectedRace.indoorResults && selectedRace.indoorResults.length > 0 ? (
              // Affichage des résultats indoor groupés par catégorie
              (() => {
                // Grouper les résultats par catégorie
                const groupedByCategory = selectedRace.indoorResults.reduce((acc, participant) => {
                  const categoryLabel = participant.crew?.category?.label || "Sans catégorie";
                  if (!acc[categoryLabel]) {
                    acc[categoryLabel] = [];
                  }
                  acc[categoryLabel].push(participant);
                  return acc;
                }, {} as Record<string, IndoorParticipantResult[]>);

                // Trier les catégories par ordre alphabétique
                const sortedCategories = Object.keys(groupedByCategory).sort();

                return (
                  <div className="space-y-6">
                    {sortedCategories.map((categoryLabel) => {
                      // Trier les résultats de la catégorie par temps (place)
                      const categoryResults = [...groupedByCategory[categoryLabel]].sort((a, b) => 
                        a.place - b.place
                      );
                      const firstPlaceTime = categoryResults.length > 0 && categoryResults[0].time_ms !== null
                        ? categoryResults[0].time_ms
                        : null;

                      return (
                        <div key={categoryLabel} className="space-y-2">
                          <div className="flex items-center gap-2 pb-2 border-b-2 border-primary">
                            <h3 className="text-lg font-bold text-slate-900">
                              {categoryLabel}
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              ({categoryResults.length} participant{categoryResults.length > 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-slate-50">
                                  <th className="text-left py-2 px-4 font-semibold">Place</th>
                                  <th className="text-left py-2 px-4 font-semibold">Équipage</th>
                                  <th className="text-left py-2 px-4 font-semibold">Temps</th>
                                  <th className="text-left py-2 px-4 font-semibold">Distance</th>
                                  <th className="text-left py-2 px-4 font-semibold">Allure</th>
                                  <th className="text-left py-2 px-4 font-semibold">SPM</th>
                                  <th className="text-left py-2 px-4 font-semibold">Calories</th>
                                </tr>
                              </thead>
                              <tbody>
                                {categoryResults.map((participant, index) => {
                                  const isPodium = participant.place <= 3;
                                  const categoryPosition = index + 1;
                                  return (
                                    <tr
                                      key={participant.id}
                                      className={`border-b hover:bg-slate-50 ${
                                        isPodium ? "bg-amber-50" : ""
                                      }`}
                                    >
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                          {isPodium && (
                                            <Trophy
                                              className={`w-4 h-4 ${
                                                participant.place === 1
                                                  ? "text-amber-500"
                                                  : participant.place === 2
                                                  ? "text-gray-400"
                                                  : "text-amber-700"
                                              }`}
                                            />
                                          )}
                                          <span className={`font-bold ${isPodium ? "text-lg" : ""}`}>
                                            {categoryPosition === 1 && "🥇"}
                                            {categoryPosition === 2 && "🥈"}
                                            {categoryPosition === 3 && "🥉"}
                                            <span className={categoryPosition <= 3 ? "ml-1" : ""}>
                                              {categoryPosition}
                                            </span>
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4">
                                        {participant.crew ? (
                                          <div>
                                            <div className="font-semibold">{participant.crew.club_name}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {participant.crew.club_code}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-muted-foreground italic text-sm">
                                            Non identifié
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 font-mono font-semibold">
                                        {participant.time_display}
                                      </td>
                                      <td className="py-3 px-4">{participant.distance}m</td>
                                      <td className="py-3 px-4 font-mono">{participant.avg_pace}</td>
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-1">
                                          <TrendingUp className="w-3 h-3 text-muted-foreground" />
                                          {participant.spm}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4">{participant.calories}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              // Affichage des résultats normaux (timing) groupés par catégorie
              (() => {
                // Grouper les résultats par catégorie
                const groupedByCategory = selectedRace.results.reduce((acc, result) => {
                  const categoryLabel = result.category?.label || "Sans catégorie";
                  if (!acc[categoryLabel]) {
                    acc[categoryLabel] = [];
                  }
                  acc[categoryLabel].push(result);
                  return acc;
                }, {} as Record<string, TimingResult[]>);

                // Trier les catégories par ordre alphabétique
                const sortedCategories = Object.keys(groupedByCategory).sort();

                return (
                  <div className="space-y-6">
                    {sortedCategories.map((categoryLabel) => {
                      const categoryResults = groupedByCategory[categoryLabel];
                      // Trier les résultats de la catégorie par temps
                      const sortedCategoryResults = [...categoryResults].sort((a, b) => {
                        if (a.relative_time_ms === null) return 1;
                        if (b.relative_time_ms === null) return -1;
                        return a.relative_time_ms - b.relative_time_ms;
                      });
                      const firstPlaceTime = sortedCategoryResults.length > 0 && sortedCategoryResults[0].relative_time_ms !== null
                        ? sortedCategoryResults[0].relative_time_ms
                        : null;

                      return (
                        <div key={categoryLabel} className="space-y-2">
                          <div className="flex items-center gap-2 pb-2 border-b-2 border-primary">
                            <h3 className="text-lg font-bold text-slate-900">
                              {categoryLabel}
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              ({sortedCategoryResults.length} participant{sortedCategoryResults.length > 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-4 font-semibold">Classement</th>
                                  <th className="text-left py-2 px-4 font-semibold">Couloir</th>
                                  <th className="text-left py-2 px-4 font-semibold">Club</th>
                                  <th className="text-right py-2 px-4 font-semibold">Temps</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedCategoryResults.map((result, index) => {
                                  const categoryPosition = index + 1;
                                  const timeDifference = firstPlaceTime !== null && result.relative_time_ms !== null
                                    ? result.relative_time_ms - firstPlaceTime
                                    : null;

                                  return (
                                    <tr
                                      key={result.crew_id}
                                      className={`border-b hover:bg-slate-50 ${
                                        categoryPosition === 1
                                          ? "bg-yellow-50"
                                          : categoryPosition === 2
                                            ? "bg-gray-50"
                                            : categoryPosition === 3
                                              ? "bg-orange-50"
                                              : ""
                                      }`}
                                    >
                                      <td className="py-3 px-4 font-bold text-lg">
                                        {categoryPosition === 1 && "🥇"}
                                        {categoryPosition === 2 && "🥈"}
                                        {categoryPosition === 3 && "🥉"}
                                        <span className={categoryPosition <= 3 ? "ml-1" : ""}>
                                          {categoryPosition}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4">{result.lane}</td>
                                      <td className="py-3 px-4">
                                        <div className="font-semibold">{result.club_name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{result.club_code}</div>
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
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

