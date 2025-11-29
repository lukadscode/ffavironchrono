import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/axios";
import api from "@/lib/axios";
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
import { Search, Filter, X, TrendingUp } from "lucide-react";

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
  isIndoor?: boolean;
  indoorResults?: IndoorParticipantResult[];
};

type Phase = {
  id: string;
  name: string;
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
    crew_participants?: Array<{
      id?: string;
      participant: {
        id: string;
        first_name: string;
        last_name: string;
        license_number?: string;
      };
      is_coxswain: boolean;
      seat_position?: number;
    }>;
  } | null;
  splits_data?: Array<{
    distance?: number;
    time_ms?: number;
    time_display?: string;
    pace?: string;
    split_distance?: number;
    split_time_ms?: number;
    split_time_display?: string;
    split_time?: string;
    split_avg_pace?: string;
    split_stroke_rate?: number;
  }> | null;
};

export default function Results() {
  const { eventId } = useParams();
  const [races, setRaces] = useState<Race[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTimingPoint, setLastTimingPoint] = useState<TimingPoint | null>(null);
  const [timingPoints, setTimingPoints] = useState<TimingPoint[]>([]);
  const [isIndoorEvent, setIsIndoorEvent] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"scratch" | "category">("scratch");
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedClub, setSelectedClub] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
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
      fetchEventType();
      if (!isIndoorEvent) {
        fetchTimingPoints();
      }
    }
  }, [eventId, isIndoorEvent]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Vérifier le type d'événement si pas encore déterminé
        let currentIsIndoor = isIndoorEvent;
        if (!currentIsIndoor) {
          try {
            const eventRes = await api.get(`/events/${eventId}`);
            const eventData = eventRes.data.data;
            const raceType = eventData.race_type?.toLowerCase() || "";
            currentIsIndoor = raceType.includes("indoor");
            setIsIndoorEvent(currentIsIndoor);
          } catch (err) {
            console.error("Erreur vérification type événement", err);
          }
        }

        // Récupérer les phases
        const phasesRes = await publicApi.get(`/race-phases/${eventId}`);
        const phasesData = phasesRes.data.data || [];
        setPhases(phasesData);
        
        // Récupérer les courses
        const res = await publicApi.get(`/races/event/${eventId}`);
        const racesData = res.data.data || [];

        // Pour les événements indoor, ne pas attendre les timing points
        if (!currentIsIndoor && !lastTimingPoint) {
          // Attendre que les timing points soient chargés pour les événements normaux
          setRaces(racesData.map((r: any) => ({ ...r, results: [] })));
          return;
        }

        const racesWithResults = await Promise.all(
          racesData.map(async (race: any) => {
            // Afficher uniquement les courses avec statut "non_official" ou "official"
            if (race.status !== "non_official" && race.status !== "official") {
              return { ...race, results: [], isIndoor: false };
            }

            // Pour les événements indoor, essayer d'abord de récupérer les résultats indoor
            if (currentIsIndoor) {
              try {
                console.log(`🏠 Tentative chargement résultats indoor pour course ${race.id} (${race.name})`);
                console.log(`📊 Statut de la course: ${race.status} (doit être "non_official" ou "official" pour accès public)`);
                const indoorRes = await publicApi.get(`/indoor-results/race/${race.id}`);
                const indoorData = indoorRes.data.data;
                console.log(`✅ Résultats indoor reçus pour course ${race.id}:`, indoorData);
                
                if (indoorData && indoorData.participants && indoorData.participants.length > 0) {
                  // C'est une course indoor avec des résultats
                  const participants = indoorData.participants.sort((a: IndoorParticipantResult, b: IndoorParticipantResult) => 
                    a.place - b.place
                  );
                  
                  // Enrichir avec les participants des équipages
                  try {
                    const raceCrewsRes = await publicApi.get(`/race-crews/${race.id}`);
                    const raceCrews = raceCrewsRes.data.data || [];
                    
                    // Créer un map crew_id -> crew avec participants
                    const crewMap = new Map();
                    raceCrews.forEach((rc: any) => {
                      if (rc.crew_id && rc.crew) {
                        crewMap.set(rc.crew_id, rc.crew);
                      }
                    });
                    
                    // Enrichir les participants avec les infos des équipages
                    // Filtrer les participants non identifiés avec temps à 0 (couloirs vidéo)
                    const enrichedParticipants = participants
                      .filter((p: IndoorParticipantResult) => {
                        // Exclure les participants non identifiés (pas de crew_id ou crew null)
                        if (!p.crew_id || !p.crew) {
                          return false;
                        }
                        // Exclure les participants avec temps à 0
                        if (p.time_ms === 0 || p.time_ms === null || p.time_ms === undefined) {
                          return false;
                        }
                        return true;
                      })
                      .map((p: IndoorParticipantResult) => {
                        if (p.crew_id && crewMap.has(p.crew_id)) {
                          const crew = crewMap.get(p.crew_id);
                          return {
                            ...p,
                            crew: {
                              ...p.crew,
                              crew_participants: crew.crew_participants || [],
                            },
                          };
                        }
                        return p;
                      });
                    
                    console.log(`✅ Course ${race.id} a ${enrichedParticipants.length} participants indoor (enrichis)`);
                    
                    return {
                      ...race,
                      isIndoor: true,
                      indoorResults: enrichedParticipants,
                      results: [], // Pas de résultats de timing pour les courses indoor
                    };
                  } catch (crewErr: any) {
                    // Si erreur lors de la récupération des équipages, retourner quand même les résultats
                    console.warn(`⚠️ Erreur récupération équipages pour course ${race.id}:`, crewErr);
                    return {
                      ...race,
                      isIndoor: true,
                      indoorResults: participants,
                      results: [],
                    };
                  }
                } else {
                  // Course indoor mais pas encore de résultats
                  console.log(`⚠️ Course ${race.id} est indoor mais n'a pas encore de participants`);
                  return {
                    ...race,
                    isIndoor: true,
                    indoorResults: [],
                    results: [],
                  };
                }
              } catch (indoorErr: any) {
                // 404 signifie qu'il n'y a pas encore de résultats indoor, c'est normal
                if (indoorErr?.response?.status === 404) {
                  console.log(`⚠️ Course ${race.id} est indoor mais pas encore de résultats (404)`);
                  // Course indoor mais pas encore de résultats
                  return {
                    ...race,
                    isIndoor: true,
                    indoorResults: [],
                    results: [],
                  };
                } else if (indoorErr?.response?.status === 401) {
                  // 401 signifie que l'endpoint n'est pas accessible publiquement
                  console.error(`❌ Endpoint indoor-results non accessible publiquement pour course ${race.id} (401)`);
                  console.error(`📊 Statut de la course: ${race.status}`);
                  console.error(`💡 Vérifier que:`);
                  console.error(`   1. La course a le statut "non_official" ou "official"`);
                  console.error(`   2. L'endpoint /indoor-results/race/${race.id} est bien configuré pour l'accès public côté backend`);
                  console.error(`   3. L'implémentation backend est bien déployée`);
                  // Retourner la course comme indoor mais sans résultats (l'endpoint n'est pas public)
                  return {
                    ...race,
                    isIndoor: true,
                    indoorResults: [],
                    results: [],
                  };
                } else {
                  console.error(`❌ Erreur chargement résultats indoor course ${race.id}:`, indoorErr);
                  // En cas d'erreur autre que 404/401, retourner quand même la course comme indoor
                  return {
                    ...race,
                    isIndoor: true,
                    indoorResults: [],
                    results: [],
                  };
                }
              }
            }

            // Pour les courses normales, utiliser les timings
            if (!lastTimingPoint) {
              return { ...race, results: [], isIndoor: false };
            }

            try {
              // Récupérer les timings de la course
              const timingsRes = await publicApi.get(`/timings/race/${race.id}`);
              const allTimings = timingsRes.data.data || [];

              // Filtrer uniquement les timings du dernier timing point avec temps valide (> 0)
              const finishTimings = allTimings.filter(
                (t: any) => t.timing_point_id === lastTimingPoint.id && 
                           t.relative_time_ms !== null && 
                           t.relative_time_ms > 0
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

              // Créer un map crew_id -> infos (uniquement pour les équipages identifiés)
              const crewInfoMap = new Map();
              raceCrews.forEach((rc: any) => {
                if (rc.crew_id && rc.crew) {
                  crewInfoMap.set(rc.crew_id, {
                    lane: rc.lane || 0,
                    club_name: rc.crew?.club_name || "N/A",
                    club_code: rc.crew?.club_code || "N/A",
                    category: rc.crew?.category || undefined,
                  });
                }
              });

              // Construire les résultats avec tous les timings (pas seulement le dernier)
              // Récupérer tous les timings de la course avec temps valide (> 0)
              const allFinishTimings = allTimings.filter(
                (t: any) => t.relative_time_ms !== null && t.relative_time_ms > 0
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
              // Filtrer les équipages non identifiés et avec temps à 0
              const results: RaceResult[] = Array.from(timingsByCrew.entries())
                .map(([crewId, timings]): RaceResult | null => {
                  const crewInfo = crewInfoMap.get(crewId);
                  if (!crewInfo) return null; // Équipage non identifié (couloir vidéo)
                  
                  // Exclure les équipages avec club_name ou club_code à "N/A"
                  if (crewInfo.club_name === "N/A" || crewInfo.club_code === "N/A") {
                    return null;
                  }

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
                  
                  // Exclure les équipages avec temps à 0
                  if (!finishTiming || !finishTiming.relative_time_ms || finishTiming.relative_time_ms === 0) {
                    return null;
                  }

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
                isIndoor: false,
                results: sorted,
              };
            } catch (err) {
              console.error(`Erreur chargement résultats course ${race.id}:`, err);
              return { ...race, results: [], isIndoor: false };
            }
          })
        );

        // Pour les événements indoor, afficher toutes les courses (même sans résultats)
        // Pour les courses normales, afficher seulement celles avec des résultats
        const sorted = racesWithResults
          .filter((r) => {
            if (r.isIndoor) {
              // Pour les courses indoor, afficher toutes les courses (même sans résultats pour l'instant)
              console.log(`📊 Course indoor ${r.id} (${r.name}): ${r.indoorResults?.length || 0} participants`);
              return true;
            } else {
              // Pour les courses normales, afficher seulement celles avec des résultats
              return r.results.length > 0;
            }
          })
          .sort((a, b) => a.race_number - b.race_number);

        console.log(`📋 Total courses à afficher: ${sorted.length} (${sorted.filter(r => r.isIndoor).length} indoor)`);
        setRaces(sorted);
      } catch (err) {
        console.error("Erreur chargement résultats", err);
      } finally {
        setLoading(false);
      }
    };

    // Déclencher le chargement des résultats
    // fetchResults vérifie lui-même le type d'événement si nécessaire
    // Pour les événements indoor, on peut charger immédiatement
    // Pour les événements normaux, attendre les timing points (mais fetchResults gère ça)
    if (eventId) {
      fetchResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, lastTimingPoint, timingPoints.length, isIndoorEvent]);

  // Extraire les valeurs uniques pour les filtres
  const { uniqueClubs, uniqueCategories } = useMemo(() => {
    const clubs = new Map<string, string>(); // Map<club_code, club_name>
    const categories = new Set<string>();
    
    races.forEach((race) => {
      if (race.isIndoor && race.indoorResults) {
        // Pour les résultats indoor
        race.indoorResults.forEach((participant) => {
          if (participant.crew?.club_code) {
            clubs.set(participant.crew.club_code, participant.crew.club_name || participant.crew.club_code);
          }
          if (participant.crew?.category?.label) {
            categories.add(participant.crew.category.label);
          }
        });
      } else {
        // Pour les résultats normaux
        race.results?.forEach((result) => {
          if (result.club_code) {
            clubs.set(result.club_code, result.club_name || result.club_code);
          }
          if (result.category?.label) {
            categories.add(result.category.label);
          }
        });
      }
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
        if (race.isIndoor && race.indoorResults) {
          // Filtrer les résultats indoor (exclure les non identifiés avec temps à 0)
          const filteredIndoorResults = race.indoorResults.filter((participant) => {
            // Exclure les participants non identifiés
            if (!participant.crew_id || !participant.crew) {
              return false;
            }
            // Exclure les participants avec temps à 0
            if (participant.time_ms === 0 || participant.time_ms === null || participant.time_ms === undefined) {
              return false;
            }
            // Filtre par club (par code)
            if (selectedClub !== "all" && participant.crew?.club_code !== selectedClub) {
              return false;
            }
            
            // Filtre par catégorie
            if (selectedCategory !== "all" && participant.crew?.category?.label !== selectedCategory) {
              return false;
            }
            
            // Filtre par recherche
            if (searchQuery) {
              const query = searchQuery.toLowerCase();
              const matches = 
                participant.crew?.club_name?.toLowerCase().includes(query) ||
                participant.crew?.club_code?.toLowerCase().includes(query);
              if (!matches) {
                return false;
              }
            }
            
            return true;
          });
          
          return {
            ...race,
            indoorResults: filteredIndoorResults,
          };
        } else {
          // Filtrer les résultats normaux (exclure les non identifiés avec temps à 0)
          const filteredResults = (race.results || []).filter((result) => {
            // Exclure les équipages non identifiés (pas de club_name ou club_code)
            if (!result.club_name || !result.club_code || result.club_name === "N/A" || result.club_code === "N/A") {
              return false;
            }
            
            // Exclure les équipages avec temps à 0
            const timeMs = result.relative_time_ms;
            if (!timeMs || timeMs === 0) {
              return false;
            }
            
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
        }
      })
      .filter((race) => (race.isIndoor ? (race.indoorResults?.length || 0) > 0 : race.results.length > 0));
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

  // Fonction pour formater le split_time (en centièmes de seconde, ex: 625 = 62.5s = 1:02.5)
  const formatSplitTime = (splitTime: string | number | null | undefined): string => {
    if (!splitTime && splitTime !== 0) return "-";
    
    // Si c'est déjà formaté (contient ':'), retourner tel quel
    const str = splitTime.toString();
    if (str.includes(':')) {
      return str;
    }
    
    // Convertir en nombre (centièmes de seconde)
    const centiseconds = typeof splitTime === 'string' ? parseFloat(splitTime) : splitTime;
    if (isNaN(centiseconds) || centiseconds < 0) return "-";
    
    // Convertir centièmes en secondes totales
    const totalSeconds = centiseconds / 10;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((centiseconds % 10));
    
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
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

  // Fonction pour extraire le nom de série depuis le nom de la course
  const extractSeriesName = (raceName: string): string => {
    const rx = /(.*?)(?:\s*[-–—]?\s*(?:S[ée]rie|Heat)\s*)(\d+)\s*$/i;
    const rxHash = /(.*?)(?:\s*#\s*)(\d+)\s*$/i;
    const match = raceName.match(rx) || raceName.match(rxHash);
    if (match) {
      return match[1].trim();
    }
    return raceName;
  };

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

      {/* Boutons pour choisir la vue (par séries ou par catégorie) */}
      {filteredRaces.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Button
                variant={viewMode === "scratch" ? "default" : "outline"}
                onClick={() => setViewMode("scratch")}
                className="flex-1"
              >
                Vue par séries
              </Button>
              <Button
                variant={viewMode === "category" ? "default" : "outline"}
                onClick={() => setViewMode("category")}
                className="flex-1"
              >
                Par catégorie
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                {(() => {
                  // Si c'est une course indoor avec des résultats
                  if (race.isIndoor && race.indoorResults && race.indoorResults.length > 0) {
                    if (viewMode === "scratch") {
                      // Mode par séries : tous les résultats ensemble
                      return (
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <table className="w-full text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b bg-slate-50">
                                <th className="text-left py-2 px-3 font-semibold">Place</th>
                                <th className="text-left py-2 px-3 font-semibold min-w-[140px]">Équipage</th>
                                <th className="text-left py-2 px-3 font-semibold min-w-[200px]">Participants</th>
                                <th className="text-left py-2 px-3 font-semibold">Temps</th>
                                <th className="text-left py-2 px-3 font-semibold">Distance</th>
                                <th className="text-left py-2 px-3 font-semibold">SPM</th>
                                <th className="text-left py-2 px-3 font-semibold">Calories</th>
                                {race.indoorResults?.some(p => p.splits_data && p.splits_data.length > 0) && (
                                  <th className="text-left py-2 px-3 font-semibold">Splits</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {race.indoorResults.map((participant) => {
                                return (
                                  <tr
                                    key={participant.id}
                                    className="border-b hover:bg-slate-50"
                                  >
                                    <td className="py-3 px-3">
                                      <span className="font-semibold">
                                        {participant.place}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3">
                                      {participant.crew ? (
                                        <div>
                                          <div className="font-semibold">{participant.crew.club_name}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {participant.crew.club_code}
                                            {participant.crew.category && (
                                              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                {participant.crew.category.label}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-muted-foreground italic text-sm">
                                          Non identifié
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-3">
                                      {participant.crew?.crew_participants && participant.crew.crew_participants.length > 0 ? (
                                        <div className="space-y-1">
                                          {participant.crew.crew_participants
                                            .sort((a, b) => (a.seat_position || 0) - (b.seat_position || 0))
                                            .map((cp, idx) => {
                                              const isCoxswain = cp.is_coxswain || false;
                                              const firstName = cp.participant?.first_name || "";
                                              const lastName = cp.participant?.last_name || "";
                                              const displayName = firstName && lastName
                                                ? `${firstName} ${lastName}`
                                                : lastName || firstName || "N/A";
                                              
                                              return (
                                                <div
                                                  key={cp.id || idx}
                                                  className={`text-sm ${isCoxswain ? "font-semibold" : ""}`}
                                                >
                                                  {displayName}
                                                  {isCoxswain && (
                                                    <span className="text-muted-foreground ml-1 text-xs">(B)</span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-3 font-mono font-semibold">
                                      {participant.time_display}
                                    </td>
                                    <td className="py-3 px-3">{participant.distance}m</td>
                                    <td className="py-3 px-3 font-mono">{participant.avg_pace}</td>
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3 text-muted-foreground" />
                                        {participant.spm}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3">{participant.calories}</td>
                                    {race.indoorResults?.some(p => p.splits_data && p.splits_data.length > 0) && (
                                      <td className="py-3 px-3">
                                        {participant.splits_data && participant.splits_data.length > 0 ? (
                                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-mono">
                                            {participant.splits_data.map((split: any, idx: number) => {
                                              const splitTime = split.split_time 
                                                ? formatSplitTime(split.split_time)
                                                : (split.split_time_display || split.time_display || 
                                                  (split.split_time_ms ? formatTime(split.split_time_ms) : 
                                                  (split.time_ms ? formatTime(split.time_ms) : "-")));
                                              const splitDist = split.split_distance || split.distance || "";
                                              return (
                                                <span key={idx} className="whitespace-nowrap">
                                                  {splitDist ? `${splitDist}m: ` : ""}{splitTime}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    } else {
                      // Mode par catégorie : grouper par catégorie
                      const groupedByCategory = race.indoorResults.reduce((acc, participant) => {
                        const categoryLabel = participant.crew?.category?.label || "Sans catégorie";
                        if (!acc[categoryLabel]) {
                          acc[categoryLabel] = [];
                        }
                        acc[categoryLabel].push(participant);
                        return acc;
                      }, {} as Record<string, IndoorParticipantResult[]>);

                      const sortedCategories = Object.keys(groupedByCategory).sort();

                      return (
                        <div className="space-y-6">
                          {sortedCategories.map((categoryLabel) => {
                            const categoryResults = [...groupedByCategory[categoryLabel]].sort((a, b) => a.place - b.place);
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
                                <div className="overflow-x-auto -mx-4 sm:mx-0">
                                  <table className="w-full text-xs sm:text-sm">
                                    <thead>
                                      <tr className="border-b bg-slate-50">
                                        <th className="text-left py-2 px-3 font-semibold">Place</th>
                                        <th className="text-left py-2 px-3 font-semibold min-w-[140px]">Équipage</th>
                                        <th className="text-left py-2 px-3 font-semibold min-w-[200px]">Participants</th>
                                        <th className="text-left py-2 px-3 font-semibold">Temps</th>
                                        <th className="text-left py-2 px-3 font-semibold">Distance</th>
                                        <th className="text-left py-2 px-3 font-semibold">SPM</th>
                                        <th className="text-left py-2 px-3 font-semibold">Calories</th>
                                        {race.indoorResults?.some(p => p.splits_data && p.splits_data.length > 0) && (
                                          <th className="text-left py-2 px-3 font-semibold">Splits</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {categoryResults.map((participant, index) => {
                                        const categoryPosition = index + 1;
                                        return (
                                          <tr
                                            key={participant.id}
                                            className="border-b hover:bg-slate-50"
                                          >
                                            <td className="py-3 px-3">
                                              <span className="font-semibold">
                                                {categoryPosition}
                                              </span>
                                            </td>
                                            <td className="py-3 px-3">
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
                                            <td className="py-3 px-3">
                                              {participant.crew?.crew_participants && participant.crew.crew_participants.length > 0 ? (
                                                <div className="space-y-1">
                                                  {participant.crew.crew_participants
                                                    .sort((a, b) => (a.seat_position || 0) - (b.seat_position || 0))
                                                    .map((cp, idx) => {
                                                      const isCoxswain = cp.is_coxswain || false;
                                                      const firstName = cp.participant?.first_name || "";
                                                      const lastName = cp.participant?.last_name || "";
                                                      const displayName = firstName && lastName
                                                        ? `${firstName} ${lastName}`
                                                        : lastName || firstName || "N/A";
                                                      
                                                      return (
                                                        <div
                                                          key={cp.id || idx}
                                                          className={`text-sm ${isCoxswain ? "font-semibold" : ""}`}
                                                        >
                                                          {displayName}
                                                          {isCoxswain && (
                                                            <span className="text-muted-foreground ml-1 text-xs">(B)</span>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                              )}
                                            </td>
                                            <td className="py-3 px-3 font-mono font-semibold">
                                              {participant.time_display}
                                            </td>
                                            <td className="py-3 px-3">{participant.distance}m</td>
                                            <td className="py-3 px-3 font-mono">{participant.avg_pace}</td>
                                            <td className="py-3 px-3">
                                              <div className="flex items-center gap-1">
                                                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                                                {participant.spm}
                                              </div>
                                            </td>
                                            <td className="py-3 px-3">{participant.calories}</td>
                                            {race.indoorResults?.some(p => p.splits_data && p.splits_data.length > 0) && (
                                              <td className="py-3 px-3">
                                                {participant.splits_data && participant.splits_data.length > 0 ? (
                                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-mono">
                                                    {participant.splits_data.map((split: any, idx: number) => {
                                                      const splitTime = split.split_time 
                                                        ? formatSplitTime(split.split_time)
                                                        : (split.split_time_display || split.time_display || 
                                                          (split.split_time_ms ? formatTime(split.split_time_ms) : 
                                                          (split.time_ms ? formatTime(split.time_ms) : "-")));
                                                      const splitDist = split.split_distance || split.distance || "";
                                                      return (
                                                        <span key={idx} className="whitespace-nowrap">
                                                          {splitDist ? `${splitDist}m: ` : ""}{splitTime}
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                ) : (
                                                  <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                              </td>
                                            )}
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
                    }
                  }

                  // Si c'est une course normale avec des résultats de timing
                  if (viewMode === "scratch") {
                    // Mode scratch : tous les résultats ensemble
                    return (
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
                    );
                  } else {
                    // Mode par catégorie : grouper par catégorie
                    const groupedByCategory = sortedResults.reduce((acc, result) => {
                      const categoryLabel = result.category?.label || "Sans catégorie";
                      if (!acc[categoryLabel]) {
                        acc[categoryLabel] = [];
                      }
                      acc[categoryLabel].push(result);
                      return acc;
                    }, {} as Record<string, RaceResult[]>);

                    const sortedCategories = Object.keys(groupedByCategory).sort();

                    return (
                      <div className="space-y-6">
                        {sortedCategories.map((categoryLabel) => {
                          const categoryResults = [...groupedByCategory[categoryLabel]].sort((a, b) => {
                            if (a.relative_time_ms === null) return 1;
                            if (b.relative_time_ms === null) return -1;
                            return a.relative_time_ms - b.relative_time_ms;
                          });
                          const firstPlaceTime = categoryResults.length > 0 && categoryResults[0].relative_time_ms !== null
                            ? categoryResults[0].relative_time_ms
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
                              <div className="overflow-x-auto -mx-4 sm:mx-0">
                                <table className="w-full text-xs sm:text-sm">
                                  <thead>
                                    <tr className="border-b">
                                      {categoryResults.some(r => r.relative_time_ms !== null) && (
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
                                    {categoryResults.map((result, index) => {
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
                                          {categoryResults.some(r => r.relative_time_ms !== null) && (
                                            <td className="py-3 px-3 font-bold">
                                              {categoryPosition === 1 && "🥇"}
                                              {categoryPosition === 2 && "🥈"}
                                              {categoryPosition === 3 && "🥉"}
                                              <span className={categoryPosition <= 3 ? "ml-1" : ""}>
                                                {categoryPosition}
                                              </span>
                                            </td>
                                          )}
                                          <td className="py-3 px-3 font-medium">{result.lane}</td>
                                          <td className="py-3 px-3">
                                            <div>
                                              <p className="font-medium text-sm">{result.club_name}</p>
                                              <p className="text-xs text-muted-foreground">{result.club_code}</p>
                                            </div>
                                          </td>
                                          {timingPoints.map((point, pointIndex) => {
                                            const isLastPoint = pointIndex === timingPoints.length - 1;
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
                                                    {isLastPoint && timeDifference !== null && timeDifference !== 0 && (
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
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                })()}
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
