import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import { Search, Filter, X } from "lucide-react";

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

type IntermediateTime = {
  timing_point_id: string;
  timing_point_label: string;
  distance_m: number;
  time_ms: string;
  relative_time_ms: number | null;
  order_index: number;
};

type RaceResult = {
  crew_id: string;
  lane: number;
  position: number;
  final_time: string;
  relative_time_ms: number | null;
  club_name: string;
  club_code: string;
  category?: Category;
  intermediate_times: IntermediateTime[];
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
  race_crews?: any[];
  results: RaceResult[];
};

type Phase = {
  id: string;
  name: string;
};

export default function Results() {
  const { eventId } = useParams();
  const [races, setRaces] = useState<Race[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTimingPoint, setLastTimingPoint] = useState<TimingPoint | null>(null);
  const [timingPoints, setTimingPoints] = useState<TimingPoint[]>([]);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedClub, setSelectedClub] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    const fetchTimingPoints = async () => {
      try {
        const res = await publicApi.get(`/timing-points/event/${eventId}`);
        const points = res.data.data || [];
        const sorted = points.sort((a: TimingPoint, b: TimingPoint) => a.order_index - b.order_index);
        setTimingPoints(sorted);
        // Le dernier timing point est celui avec le plus grand order_index
        if (sorted.length > 0) {
          setLastTimingPoint(sorted[sorted.length - 1]);
        }
      } catch (err) {
        console.error("Erreur chargement timing points", err);
      }
    };

    if (eventId) {
      fetchTimingPoints();
    }
  }, [eventId]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Récupérer les phases
        const phasesRes = await publicApi.get(`/race-phases/${eventId}`);
        const phasesData = phasesRes.data.data || [];
        setPhases(phasesData);
        
        // Récupérer les courses
        const res = await publicApi.get(`/races/event/${eventId}`);
        const racesData = res.data.data || [];

        if (!lastTimingPoint) {
          // Attendre que les timing points soient chargés
          setRaces(racesData.map((r: any) => ({ ...r, results: [] })));
          return;
        }

        const racesWithResults = await Promise.all(
          racesData.map(async (race: any) => {
            // Afficher uniquement les courses avec statut "non_official" ou "official"
            if (race.status !== "non_official" && race.status !== "official") {
              return { ...race, results: [] };
            }

            try {
              // Récupérer les timings de la course
              const timingsRes = await publicApi.get(`/timings/race/${race.id}`);
              const allTimings = timingsRes.data.data || [];

              // Filtrer uniquement les timings du dernier timing point
              const finishTimings = allTimings.filter(
                (t: any) => t.timing_point_id === lastTimingPoint.id && t.relative_time_ms !== null
              );

              // Récupérer les assignments pour avoir les crew_id
              const assignmentsRes = await publicApi.get(`/timing-assignments/race/${race.id}`);
              const assignments = assignmentsRes.data.data || [];

              // Créer un map timing_id -> crew_id
              const timingToCrew = new Map<string, string>();
              assignments.forEach((a: any) => {
                if (a.timing_id && a.crew_id) {
                  timingToCrew.set(a.timing_id, a.crew_id);
                }
              });

              // Récupérer les race-crews pour avoir les infos des équipages
              const raceCrewsRes = await publicApi.get(`/race-crews/${race.id}`);
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

              // Construire les résultats avec tous les timings (pas seulement le dernier)
              // Récupérer tous les timings de la course (pas seulement le dernier point)
              const allFinishTimings = allTimings.filter(
                (t: any) => t.relative_time_ms !== null
              );

              // Grouper les timings par crew_id
              const timingsByCrew = new Map<string, any[]>();
              allFinishTimings.forEach((timing: any) => {
                const crewId = timing.crew_id || timingToCrew.get(timing.id);
                if (crewId) {
                  if (!timingsByCrew.has(crewId)) {
                    timingsByCrew.set(crewId, []);
                  }
                  timingsByCrew.get(crewId)!.push(timing);
                }
              });

              // Construire les résultats avec les timings intermédiaires
              const results: RaceResult[] = Array.from(timingsByCrew.entries())
                .map(([crewId, timings]): RaceResult | null => {
                  const crewInfo = crewInfoMap.get(crewId);
                  if (!crewInfo) return null;

                  // Trier les timings par order_index
                  const sortedTimings = timings.sort((a: any, b: any) => {
                    const aPoint = timingPoints.find((tp: any) => tp.id === a.timing_point_id);
                    const bPoint = timingPoints.find((tp: any) => tp.id === b.timing_point_id);
                    return (aPoint?.order_index || 0) - (bPoint?.order_index || 0);
                  });

                  // Trouver le timing du dernier point (finish)
                  const finishTiming = sortedTimings.find((t: any) => 
                    t.timing_point_id === lastTimingPoint.id
                  );

                  // Construire les timings intermédiaires (tous sauf le dernier)
                  const intermediateTimes: IntermediateTime[] = sortedTimings
                    .filter((timing: any) => timing.timing_point_id !== lastTimingPoint.id)
                    .map((timing: any) => {
                      const point = timingPoints.find((tp: any) => tp.id === timing.timing_point_id);
                      return {
                        timing_point_id: timing.timing_point_id,
                        timing_point_label: point?.label || "",
                        distance_m: point?.distance_m || 0,
                        time_ms: timing.relative_time_ms?.toString() || "0",
                        relative_time_ms: timing.relative_time_ms,
                        order_index: point?.order_index || 0,
                      };
                    });

                  return {
                    crew_id: crewId,
                    lane: crewInfo.lane,
                    relative_time_ms: finishTiming?.relative_time_ms || null,
                    final_time: finishTiming?.relative_time_ms?.toString() || "0",
                    club_name: crewInfo.club_name,
                    club_code: crewInfo.club_code,
                    category: crewInfo.category,
                    intermediate_times: intermediateTimes,
                    position: 0, // Sera calculé après le tri
                  };
                })
                .filter((r: RaceResult | null): r is RaceResult => r !== null);

              // Trier par temps (le plus rapide en premier) et assigner les positions
              const sorted = results.sort((a, b) => {
                if (a.relative_time_ms === null) return 1;
                if (b.relative_time_ms === null) return -1;
                return a.relative_time_ms - b.relative_time_ms;
              });

              // Assigner les positions
              sorted.forEach((result, index) => {
                result.position = index + 1;
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

        const sorted = racesWithResults
          .filter((r) => r.results.length > 0)
          .sort((a, b) => a.race_number - b.race_number);

        setRaces(sorted);
      } catch (err) {
        console.error("Erreur chargement résultats", err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId && lastTimingPoint && timingPoints.length > 0) {
      fetchResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, lastTimingPoint, timingPoints]);

  // Extraire les valeurs uniques pour les filtres
  const { uniqueClubs, uniqueCategories } = useMemo(() => {
    const clubs = new Map<string, string>(); // Map<club_code, club_name>
    const categories = new Set<string>();
    
    races.forEach((race) => {
      race.results?.forEach((result) => {
        if (result.club_code) {
          clubs.set(result.club_code, result.club_name || result.club_code);
        }
        if (result.category?.label) {
          categories.add(result.category.label);
        }
      });
    });
    
    return {
      uniqueClubs: Array.from(clubs.entries())
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      uniqueCategories: Array.from(categories).sort(),
    };
  }, [races]);

  // Filtrer les courses et résultats
  const filteredRaces = useMemo(() => {
    return races
      .filter((race) => {
        // Filtre par phase
        if (selectedPhase !== "all" && race.race_phase_id !== selectedPhase) {
          return false;
        }
        
        // Filtre par recherche
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesRace = race.name?.toLowerCase().includes(query);
          const matchesResult = race.results?.some((r) =>
            r.club_name?.toLowerCase().includes(query) ||
            r.club_code?.toLowerCase().includes(query)
          );
          
          if (!matchesRace && !matchesResult) {
            return false;
          }
        }
        
        return true;
      })
      .map((race) => {
        // Filtrer les résultats dans chaque course
        const filteredResults = (race.results || []).filter((result) => {
          // Filtre par club (par code)
          if (selectedClub !== "all" && result.club_code !== selectedClub) {
            return false;
          }
          
          // Filtre par catégorie
          if (selectedCategory !== "all" && result.category?.label !== selectedCategory) {
            return false;
          }
          
          // Filtre par recherche
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matches = 
              result.club_name?.toLowerCase().includes(query) ||
              result.club_code?.toLowerCase().includes(query);
            if (!matches) {
              return false;
            }
          }
          
          return true;
        });
        
        return {
          ...race,
          results: filteredResults,
        };
      })
      .filter((race) => race.results.length > 0);
  }, [races, searchQuery, selectedPhase, selectedClub, selectedCategory]);

  const formatTime = (ms: string | number | null) => {
    if (ms === null || ms === undefined) return "N/A";
    const totalMs = typeof ms === 'string' ? parseInt(ms, 10) : ms;
    if (isNaN(totalMs)) return "N/A";

    const totalSeconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = totalMs % 1000;

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

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPhase("all");
    setSelectedClub("all");
    setSelectedCategory("all");
  };

  const hasActiveFilters = searchQuery || selectedPhase !== "all" || selectedClub !== "all" || selectedCategory !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Résultats</h2>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="gap-2 w-full sm:w-auto"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Réinitialiser les filtres</span>
            <span className="sm:hidden">Réinitialiser</span>
          </Button>
        )}
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            <CardTitle className="text-base sm:text-lg">Filtres</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Recherche */}
            <div className="space-y-2">
              <Label htmlFor="search">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  placeholder="Nom, club..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtre par phase */}
            <div className="space-y-2">
              <Label htmlFor="phase">Phase</Label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger id="phase">
                  <SelectValue placeholder="Toutes les phases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les phases</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtre par club */}
            <div className="space-y-2">
              <Label htmlFor="club">Club</Label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger id="club">
                  <SelectValue placeholder="Tous les clubs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clubs</SelectItem>
                  {uniqueClubs.map((club) => (
                    <SelectItem key={club.code} value={club.code}>
                      {club.code} {club.name !== club.code && `- ${club.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtre par catégorie */}
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Toutes les catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des résultats filtrés */}
      {filteredRaces.length > 0 ? (
        filteredRaces.map((race) => {
          // Trier les résultats par position (classement)
          const sortedResults = [...race.results].sort((a, b) => a.position - b.position);
          
          // Fonction pour obtenir le temps du leader pour un timing point donné
          const getLeaderTimeForPoint = (pointId: string) => {
            let leaderTime: number | null = null;
            sortedResults.forEach((result) => {
              if (pointId === lastTimingPoint?.id) {
                if (result.relative_time_ms !== null) {
                  if (leaderTime === null || result.relative_time_ms < leaderTime) {
                    leaderTime = result.relative_time_ms;
                  }
                }
              } else {
                const intermediate = result.intermediate_times.find(
                  (t) => t.timing_point_id === pointId
                );
                if (intermediate && intermediate.relative_time_ms !== null) {
                  if (leaderTime === null || intermediate.relative_time_ms < leaderTime) {
                    leaderTime = intermediate.relative_time_ms;
                  }
                }
              }
            });
            return leaderTime;
          };

          return (
            <Card key={race.id}>
              <CardHeader className="bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Course {race.race_number} - {race.name}
                    </CardTitle>
                    {race.race_phase && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Phase: {race.race_phase.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {dayjs(race.start_time).format("HH:mm")}
                    </span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        race.status === "official"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {race.status === "official" ? "Officiel" : race.status === "non_official" ? "Non officiel" : "Non officiel"}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b">
                        {sortedResults.some(r => r.relative_time_ms !== null) && (
                          <th className="text-left py-2 px-3 font-semibold">Class.</th>
                        )}
                        <th className="text-left py-2 px-3 font-semibold">Coul.</th>
                        <th className="text-left py-2 px-3 font-semibold min-w-[140px]">Club</th>
                        {timingPoints.map((point) => (
                          <th key={point.id} className="text-center py-2 px-3 font-semibold">
                            <div className="text-xs">{point.label}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">
                              {point.distance_m}m
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.length === 0 && (
                        <tr>
                          <td colSpan={timingPoints.length + (sortedResults.some(r => r.relative_time_ms !== null) ? 3 : 2)} className="py-6 text-center text-muted-foreground">
                            Aucun résultat disponible pour cette course
                          </td>
                        </tr>
                      )}
                      {sortedResults.map((result) => {
                        const hasFinalTime = sortedResults.some(r => r.relative_time_ms !== null);

                        return (
                          <tr
                            key={result.crew_id}
                            className="border-b hover:bg-slate-50"
                          >
                            {hasFinalTime && (
                              <td className="py-3 px-3 font-bold">
                                {result.position}
                              </td>
                            )}
                            <td className="py-3 px-3 font-medium">{result.lane}</td>
                            <td className="py-3 px-3">
                              <div>
                                <p className="font-medium text-sm">{result.club_name}</p>
                                <p className="text-xs text-muted-foreground">{result.club_code}</p>
                              </div>
                            </td>
                            {timingPoints.map((point, index) => {
                              const isLastPoint = index === timingPoints.length - 1;
                              let timeToDisplay: string | null = null;

                              if (isLastPoint && result.relative_time_ms !== null) {
                                timeToDisplay = result.relative_time_ms.toString();
                              } else {
                                const intermediate = result.intermediate_times.find(
                                  (t) => t.timing_point_id === point.id
                                );
                                if (intermediate && intermediate.relative_time_ms !== null) {
                                  timeToDisplay = intermediate.relative_time_ms.toString();
                                }
                              }

                              // Calculer l'écart pour ce point
                              const leaderTimeForPoint = getLeaderTimeForPoint(point.id);
                              const crewTimeForPoint = timeToDisplay ? parseInt(timeToDisplay, 10) : null;
                              const timeDifference = leaderTimeForPoint !== null && crewTimeForPoint !== null
                                ? crewTimeForPoint - leaderTimeForPoint
                                : null;

                              return (
                                <td
                                  key={point.id}
                                  className={`py-3 px-3 text-center font-mono text-sm ${
                                    isLastPoint && timeToDisplay ? "font-bold text-green-600" : ""
                                  }`}
                                >
                                  {timeToDisplay ? (
                                    <div>
                                      <div>{formatTime(timeToDisplay)}</div>
                                      {timeDifference !== null && timeDifference !== 0 && (
                                        <div className="text-xs text-muted-foreground mt-1 font-mono">
                                          {formatTimeDifference(timeDifference)}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              {hasActiveFilters
                ? "Aucun résultat ne correspond aux filtres sélectionnés"
                : "Aucun résultat disponible"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
