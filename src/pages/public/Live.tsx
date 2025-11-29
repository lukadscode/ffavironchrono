import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/axios";
import api from "@/lib/axios";
import { initSocket, getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import dayjs from "dayjs";

type IntermediateTime = {
  timing_point_id: string;
  timing_point_label: string;
  distance_m: number;
  time_ms: string;
  order_index: number;
};

type LiveCrew = {
  crew_id: string;
  lane: number;
  club_name: string;
  club_code: string;
  intermediate_times: IntermediateTime[];
  final_time: string | null;
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

type LiveRace = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  crews: LiveCrew[];
  isIndoor?: boolean;
  indoorResults?: IndoorParticipantResult[];
};

type TimingPoint = {
  id: string;
  label: string;
  distance_m: number;
  order_index: number;
};

export default function Live() {
  const { eventId } = useParams();
  const [races, setRaces] = useState<LiveRace[]>([]);
  const [timingPoints, setTimingPoints] = useState<TimingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isIndoorEvent, setIsIndoorEvent] = useState<boolean>(false);
  const timingPointsRef = useRef<TimingPoint[]>([]);
  const [selectedParticipantForChart, setSelectedParticipantForChart] = useState<IndoorParticipantResult | null>(null);

  // Fonction helper pour enrichir les résultats indoor avec les participants
  const enrichIndoorResults = async (
    raceId: string,
    participants: IndoorParticipantResult[]
  ): Promise<IndoorParticipantResult[]> => {
    try {
      const raceCrewsRes = await publicApi.get(`/race-crews/${raceId}`);
      const raceCrews = raceCrewsRes.data.data || [];
      
      // Créer un map crew_id -> crew avec participants
      const crewMap = new Map();
      raceCrews.forEach((rc: any) => {
        if (rc.crew_id && rc.crew) {
          crewMap.set(rc.crew_id, rc.crew);
        }
      });
      
      // Enrichir les participants avec les infos des équipages
      return participants.map((p: IndoorParticipantResult): IndoorParticipantResult => {
        if (p.crew_id && crewMap.has(p.crew_id)) {
          const crew = crewMap.get(p.crew_id);
          return {
            ...p,
            crew: p.crew ? {
              ...p.crew,
              crew_participants: crew.crew_participants || [],
            } : null,
          };
        }
        return p;
      });
    } catch (crewErr: any) {
      // Si erreur lors de la récupération des équipages, retourner quand même les résultats
      console.warn(`⚠️ Erreur récupération équipages pour course ${raceId}:`, crewErr);
      return participants;
    }
  };

  useEffect(() => {
    if (!eventId) return;

    initSocket();
    const socket = getSocket();

    socket.emit("joinPublicEvent", { event_id: eventId });

    socket.on("raceStatusUpdate", ({ race_id, status }: { race_id: string; status: string }) => {
      setRaces((prev) => {
        // Si la course passe en officiel, la retirer du live
        if (status === "official") {
          return prev.filter((race) => race.id !== race_id);
        }
        // Sinon, mettre à jour le statut
        return prev.map((race) => (race.id === race_id ? { ...race, status } : race));
      });
    });

    socket.on(
      "raceIntermediateUpdate",
      async ({
        race_id,
        crew_id,
        timing_point_id,
        timing_point_label,
        distance_m,
        time_ms, // Conservé pour rétrocompatibilité
        relative_time_ms, // ← Priorité : temps relatif calculé par l'API
        order_index,
      }: {
        race_id: string;
        crew_id: string;
        timing_point_id: string;
        timing_point_label: string;
        distance_m: number;
        time_ms?: string; // Optionnel maintenant
        relative_time_ms: number | null; // ← Maintenant toujours présent
        order_index: number;
      }) => {
        console.log('🔔 raceIntermediateUpdate reçu:', { race_id, crew_id, timing_point_id, relative_time_ms });

        setRaces((prev) =>
          prev.map((race) => {
            if (race.id !== race_id) return race;

            // Utiliser la ref pour accéder aux timingPoints à jour
            const currentPoints = timingPointsRef.current;
            const lastPoint = currentPoints[currentPoints.length - 1];
            const isLastPoint = timing_point_id === lastPoint?.id;

            // Utiliser relative_time_ms en priorité (calculé par l'API), sinon time_ms (rétrocompatibilité)
            const relativeTime = relative_time_ms !== null && relative_time_ms !== undefined 
              ? relative_time_ms.toString() 
              : time_ms || "0";

            return {
              ...race,
              crews: race.crews.map((crew) => {
                if (crew.crew_id !== crew_id) return crew;

                const existingTimes = crew.intermediate_times.filter(
                  (t) => t.timing_point_id !== timing_point_id
                );

                // Si c'est le dernier point, mettre à jour final_time
                if (isLastPoint) {
                  return {
                    ...crew,
                    final_time: relativeTime,
                    intermediate_times: [
                      ...existingTimes,
                      {
                        timing_point_id,
                        timing_point_label,
                        distance_m,
                        time_ms: relativeTime,
                        order_index,
                      },
                    ].sort((a, b) => a.order_index - b.order_index),
                  };
                }

                return {
                  ...crew,
                  intermediate_times: [
                    ...existingTimes,
                    {
                      timing_point_id,
                      timing_point_label,
                      distance_m,
                      time_ms: relativeTime,
                      order_index,
                    },
                  ].sort((a, b) => a.order_index - b.order_index),
                };
              }),
            };
          })
        );
      }
    );

    socket.on(
      "raceFinalUpdate",
      ({ 
        race_id, 
        crew_id, 
        final_time, // Conservé pour rétrocompatibilité
        relative_time_ms // ← Priorité : temps relatif calculé par l'API
      }: { 
        race_id: string; 
        crew_id: string; 
        final_time?: string; // Optionnel maintenant
        relative_time_ms: number | null; // ← Maintenant toujours présent
      }) => {
        console.log('🏁 raceFinalUpdate reçu:', { race_id, crew_id, relative_time_ms });

        // Utiliser relative_time_ms en priorité (calculé par l'API), sinon final_time (rétrocompatibilité)
        const finalTime = relative_time_ms !== null && relative_time_ms !== undefined
          ? relative_time_ms.toString()
          : final_time || "0";

        setRaces((prev) =>
          prev.map((race) => {
            if (race.id !== race_id) return race;

            return {
              ...race,
              crews: race.crews.map((crew) =>
                crew.crew_id === crew_id ? { ...crew, final_time: finalTime } : crew
              ),
            };
          })
        );
      }
    );

    // Écouter les résultats indoor importés
    socket.on(
      "indoorResultsImported",
      async ({ 
        race_id, 
        event_id, 
        participants_count,
        race_status
      }: { 
        race_id: string; 
        event_id: string; 
        participants_count: number;
        race_status: string;
      }) => {
        console.log('🏠 indoorResultsImported reçu:', { race_id, participants_count, race_status });
        
        // Recharger les données pour avoir les résultats indoor à jour
        if (eventId === event_id) {
          // Mettre à jour le statut de la course
          setRaces((prev) =>
            prev.map((race) => {
              if (race.id !== race_id) return race;
              return { ...race, status: race_status };
            })
          );
          
          // Recharger les résultats indoor pour la course concernée
          try {
            const indoorRes = await publicApi.get(`/indoor-results/race/${race_id}`);
            const indoorData = indoorRes.data.data;
            if (indoorData && indoorData.participants) {
              const sortedParticipants = indoorData.participants.sort((a: any, b: any) => a.place - b.place);
              // Enrichir avec les participants des équipages
              const enrichedParticipants = await enrichIndoorResults(race_id, sortedParticipants);
              
              // Mettre à jour les résultats dans l'état
              setRaces((prev) =>
                prev.map((race) => {
                  if (race.id !== race_id) return race;
                  return {
                    ...race,
                    isIndoor: true,
                    indoorResults: enrichedParticipants,
                    status: race_status,
                  };
                })
              );
            }
          } catch (err) {
            console.error(`Erreur rechargement résultats indoor course ${race_id}:`, err);
          }
        }
      }
    );

    // Écouter les mises à jour de participants indoor (si ErgRace envoie des mises à jour en temps réel)
    socket.on(
      "indoorParticipantUpdate",
      ({ 
        race_id, 
        event_id,
        participant 
      }: { 
        race_id: string; 
        event_id: string;
        participant: {
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
      }) => {
        console.log('🏠 indoorParticipantUpdate reçu:', { race_id, participant });
        
        if (eventId !== event_id) return;
        
        // Mettre à jour les résultats de la course en temps réel
        setRaces((prev) => {
          const race = prev.find((r) => r.id === race_id);
          if (!race) return prev;
          
          // Si la course a déjà des résultats indoor, les mettre à jour
          if (race.indoorResults) {
            const existingIndex = race.indoorResults.findIndex(
              (p) => p.id === participant.id
            );
            
            let updatedResults: IndoorParticipantResult[];
            if (existingIndex >= 0) {
              // Mettre à jour le participant existant
              updatedResults = [...race.indoorResults];
              updatedResults[existingIndex] = participant;
            } else {
              // Ajouter le nouveau participant
              updatedResults = [...race.indoorResults, participant];
            }
            
            // Enrichir avec les participants des équipages (async, mais on met à jour l'état immédiatement)
            enrichIndoorResults(race_id, updatedResults).then((enrichedResults) => {
              setRaces((currentPrev) =>
                currentPrev.map((r) => {
                  if (r.id !== race_id) return r;
                  return {
                    ...r,
                    indoorResults: enrichedResults.sort((a, b) => a.place - b.place),
                  };
                })
              );
            });
            
            // Retourner immédiatement avec les résultats non enrichis (sera mis à jour après)
            return prev.map((r) => {
              if (r.id !== race_id) return r;
              return {
                ...r,
                indoorResults: updatedResults.sort((a, b) => a.place - b.place),
              };
            });
          } else {
            // Créer une nouvelle structure avec le premier participant
            enrichIndoorResults(race_id, [participant]).then((enrichedResults) => {
              setRaces((currentPrev) =>
                currentPrev.map((r) => {
                  if (r.id !== race_id) return r;
                  return {
                    ...r,
                    isIndoor: true,
                    indoorResults: enrichedResults,
                  };
                })
              );
            });
            
            return prev.map((r) => {
              if (r.id !== race_id) return r;
              return {
                ...r,
                isIndoor: true,
                indoorResults: [participant],
              };
            });
          }
        });
      }
    );

    // Écouter la complétion de la course indoor
    socket.on(
      "indoorRaceResultsComplete",
      ({ 
        race_id, 
        event_id,
        total_participants,
        race_status
      }: { 
        race_id: string; 
        event_id: string;
        total_participants: number;
        race_status: string;
      }) => {
        console.log('🏠 indoorRaceResultsComplete reçu:', { race_id, total_participants, race_status });
        
        if (eventId !== event_id) return;
        
        // Mettre à jour le statut de la course
        setRaces((prev) =>
          prev.map((race) => {
            if (race.id !== race_id) return race;
            return { ...race, status: race_status };
          })
        );
      }
    );

    return () => {
      socket.emit("leavePublicEvent", { event_id: eventId });
    };
  }, [eventId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // D'abord, déterminer le type d'événement
        let isIndoor = false;
        try {
          const eventRes = await api.get(`/events/${eventId}`);
          const eventData = eventRes.data.data;
          const raceType = eventData.race_type?.toLowerCase() || "";
          isIndoor = raceType.includes("indoor");
          setIsIndoorEvent(isIndoor);
        } catch (err) {
          console.error("Erreur chargement type événement", err);
          setIsIndoorEvent(false);
        }
        
        const promises: Promise<any>[] = [
          publicApi.get(`/races/event/${eventId}`)
        ];
        
        // Pour les événements indoor, ne pas charger les timing points
        if (!isIndoor) {
          promises.push(publicApi.get(`/timing-points/event/${eventId}`));
        }
        
        const results = await Promise.all(promises);
        const racesRes = results[0];
        const timingPointsRes = isIndoor ? { data: { data: [] } } : results[1];

        const allRaces = racesRes.data.data || [];
        const points = timingPointsRes.data.data || [];
        console.log('📊 Courses reçues:', allRaces.length, allRaces);
        console.log('📍 Points de chronométrage:', points.length, points);

        const sortedPoints = points.sort((a: TimingPoint, b: TimingPoint) => a.order_index - b.order_index);
        setTimingPoints(sortedPoints);
        timingPointsRef.current = sortedPoints; // Mettre à jour la ref
        
        // Pour les événements indoor, ne pas traiter les timing points
        if (isIndoor) {
          // Pour les événements indoor, on peut afficher les courses mais sans timing points
          const nonOfficialRaces = allRaces.filter((r: any) => r.status !== "official");
          const sorted = nonOfficialRaces.sort((a: any, b: any) => (a.race_number || 0) - (b.race_number || 0));
          const upcoming = sorted.slice(0, 6);
          
          // Charger les résultats indoor pour chaque course
          const enriched = await Promise.all(
            upcoming.map(async (race: any) => {
              let indoorResults: IndoorParticipantResult[] | undefined;
              
              // Essayer de charger les résultats indoor
              try {
                const indoorRes = await publicApi.get(`/indoor-results/race/${race.id}`);
                const indoorData = indoorRes.data.data;
                if (indoorData && indoorData.participants) {
                  const participants = indoorData.participants.sort((a: IndoorParticipantResult, b: IndoorParticipantResult) => a.place - b.place);
                  
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
                    indoorResults = participants.map((p: IndoorParticipantResult) => {
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
                  } catch (crewErr: any) {
                    // Si erreur lors de la récupération des équipages, retourner quand même les résultats
                    console.warn(`⚠️ Erreur récupération équipages pour course ${race.id}:`, crewErr);
                    indoorResults = participants;
                  }
                }
              } catch (err: any) {
                // 404 signifie qu'il n'y a pas encore de résultats, c'est normal
                if (err?.response?.status === 404) {
                  // Pas encore de résultats, c'est normal
                } else if (err?.response?.status === 401) {
                  // 401 signifie que l'endpoint n'est pas accessible publiquement
                  console.error(`❌ Endpoint indoor-results non accessible publiquement pour course ${race.id} (401)`);
                  console.error(`💡 L'endpoint /indoor-results/race/${race.id} doit être rendu accessible publiquement côté backend`);
                } else {
                  console.error(`Erreur chargement résultats indoor course ${race.id}:`, err);
                }
              }
              
              return {
                id: race.id,
                name: race.name,
                race_number: race.race_number || 0,
                start_time: race.start_time,
                status: race.status || "not_started",
                isIndoor: true,
                indoorResults,
                crews: (race.race_crews || [])
                  .sort((a: any, b: any) => a.lane - b.lane)
                  .map((rc: any) => ({
                    crew_id: rc.crew?.id || rc.crew_id,
                    lane: rc.lane,
                    club_name: rc.crew?.club_name || "N/A",
                    club_code: rc.crew?.club_code || "N/A",
                    intermediate_times: [],
                    final_time: null,
                  })),
              };
            })
          );
          
          setRaces(enriched);
          setLoading(false);
          return;
        }

        // Filtrer les courses officielles (ne pas les afficher en live)
        const nonOfficialRaces = allRaces.filter((r: any) => r.status !== "official");
        const sorted = nonOfficialRaces.sort((a: any, b: any) => (a.race_number || 0) - (b.race_number || 0));
        const upcoming = sorted.slice(0, 6);
        console.log('🔝 6 premières courses:', upcoming);

        const enriched = await Promise.all(
          upcoming.map(async (race: any) => {
            const crews = (race.race_crews || [])
              .sort((a: any, b: any) => a.lane - b.lane)
              .map((rc: any) => ({
                crew_id: rc.crew?.id || rc.crew_id,
                lane: rc.lane,
                club_name: rc.crew?.club_name || "N/A",
                club_code: rc.crew?.club_code || "N/A",
                intermediate_times: [],
                final_time: null,
              }));

            console.log(`🚣 Course ${race.name} - ${crews.length} équipages:`, crews);

            try {
              // L'API retourne maintenant relative_time_ms directement dans les assignments
              const assignmentsRes = await publicApi.get(`/timing-assignments/race/${race.id}`);
              const assignments = assignmentsRes.data.data || [];

              if (!assignments || assignments.length === 0) {
                console.log(`⚠️ Pas d'assignments pour course ${race.id}`);
                return {
                  id: race.id,
                  name: race.name,
                  race_number: race.race_number || 0,
                  start_time: race.start_time,
                  status: race.status || "not_started",
                  crews,
                };
              }

              const lastPointId = sortedPoints[sortedPoints.length - 1]?.id;
              const startPointId = sortedPoints[0]?.id;

              // Utiliser relative_time_ms directement depuis l'API
              // L'API retourne assignment.relative_time_ms et assignment.timing (enrichi)
              for (const assignment of assignments) {
                if (!assignment.timing_id || !assignment.crew_id) continue;

                // L'API retourne assignment.timing avec toutes les infos (timing_point_id, etc.)
                const timing = assignment.timing;
                if (!timing) {
                  console.warn(`⚠️ Timing non trouvé dans assignment ${assignment.id}`);
                  continue;
                }

                // Utiliser le TimingPoint depuis assignment.timing.TimingPoint si disponible
                const timingPoint = timing.TimingPoint 
                  ? {
                      id: timing.TimingPoint.id,
                      label: timing.TimingPoint.label,
                      distance_m: timing.TimingPoint.distance_m,
                      order_index: timing.TimingPoint.order_index,
                    }
                  : sortedPoints.find((p: TimingPoint) => p.id === timing.timing_point_id);
                
                if (!timingPoint) {
                  console.warn(`⚠️ TimingPoint ${timing.timing_point_id} non trouvé`);
                  continue;
                }

                const crewIndex = crews.findIndex((c: any) => c.crew_id === assignment.crew_id);
                if (crewIndex === -1) {
                  console.warn(`⚠️ Crew ${assignment.crew_id} non trouvé dans les crews`);
                  continue;
                }

                // Utiliser relative_time_ms de l'API (priorité à assignment.relative_time_ms, puis timing.relative_time_ms)
                const relativeTimeMs = assignment.relative_time_ms ?? timing.relative_time_ms;
                
                if (relativeTimeMs === null || relativeTimeMs === undefined) {
                  console.warn(`⚠️ Pas de relative_time_ms pour crew ${assignment.crew_id} au point ${timingPoint.label}`);
                  continue;
                }

                // Point de départ : temps = 0
                if (timingPoint.id === startPointId) {
                  crews[crewIndex].intermediate_times.push({
                    timing_point_id: timingPoint.id,
                    timing_point_label: timingPoint.label,
                    distance_m: timingPoint.distance_m,
                    time_ms: "0",
                    order_index: timingPoint.order_index,
                  });
                  continue;
                }

                if (timingPoint.id === lastPointId) {
                  crews[crewIndex].final_time = relativeTimeMs.toString();
                } else {
                  crews[crewIndex].intermediate_times.push({
                    timing_point_id: timingPoint.id,
                    timing_point_label: timingPoint.label,
                    distance_m: timingPoint.distance_m,
                    time_ms: relativeTimeMs.toString(),
                    order_index: timingPoint.order_index,
                  });
                }
              }

              crews.forEach((crew: any) => {
                crew.intermediate_times.sort((a: any, b: any) => a.order_index - b.order_index);
              });
            } catch (err) {
              console.error(`Erreur chargement temps pour course ${race.id}`, err);
            }

            return {
              id: race.id,
              name: race.name,
              race_number: race.race_number || 0,
              start_time: race.start_time,
              status: race.status || "not_started",
              crews,
            };
          })
        );

        const validRaces = enriched.filter(r => r !== undefined);
        // Filtrer les courses officielles (ne pas les afficher en live)
        const nonOfficialValidRaces = validRaces.filter((r) => r.status !== "official");
        console.log('✅ Courses valides après enrichissement:', nonOfficialValidRaces.length, nonOfficialValidRaces);
        setRaces(nonOfficialValidRaces);
      } catch (err) {
        console.error("Erreur chargement données live", err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchData();
  }, [eventId]);

  const formatTime = (ms: string | number) => {
    const msStr = ms.toString();

    // Si c'est déjà formaté (contient ':'), retourner tel quel
    if (msStr.includes(':')) {
      return msStr;
    }

    const diffMs = parseInt(msStr, 10);
    if (isNaN(diffMs) || diffMs < 0) return "-";

    // Si le temps est trop grand (probablement un timestamp absolu), retourner N/A
    // Un temps de course normal ne devrait pas dépasser 30 minutes (1800000ms)
    if (diffMs > 1800000) {
      console.warn('Temps suspect (trop grand):', diffMs, 'ms');
      return "-";
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = diffMs % 1000;

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "not_started":
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">À venir</span>;
      case "in_progress":
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 animate-pulse">En cours</span>;
      case "unofficial":
      case "non_official":
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Non officiel</span>;
      case "official":
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Officiel</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Live - Courses en cours</h2>

      {races.map((race) => {
        // Si c'est une course indoor avec des résultats, afficher les résultats indoor
        if (race.isIndoor && race.indoorResults && race.indoorResults.length > 0) {
          return (
            <Card key={race.id}>
              <CardHeader className="bg-slate-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {race.race_number > 0 ? `Course ${race.race_number} - ` : ""}{race.name}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {dayjs(race.start_time).format("HH:mm")}
                    </span>
                    {getStatusBadge(race.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-3 font-semibold">Place</th>
                        <th className="text-left py-2 px-3 font-semibold min-w-[140px]">Équipage</th>
                        <th className="text-left py-2 px-3 font-semibold min-w-[200px]">Participants</th>
                        <th className="text-left py-2 px-3 font-semibold">Temps</th>
                        <th className="text-left py-2 px-3 font-semibold">Distance</th>
                        <th className="text-left py-2 px-3 font-semibold">Allure</th>
                        <th className="text-left py-2 px-3 font-semibold">SPM</th>
                        <th className="text-left py-2 px-3 font-semibold">Calories</th>
                        {race.indoorResults?.some(p => p.splits_data && p.splits_data.length > 0) && (
                          <th className="text-left py-2 px-3 font-semibold">Splits</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {race.indoorResults.map((participant) => {
                        const hasSplits = participant.splits_data && participant.splits_data.length > 0;
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
                            <td className="py-3 px-3">{participant.spm}</td>
                            <td className="py-3 px-3">{participant.calories}</td>
                            {race.indoorResults?.some(p => p.splits_data && p.splits_data.length > 0) && (
                              <td className="py-3 px-3">
                                {hasSplits ? (
                                  <div>
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-mono">
                                      {participant.splits_data!.map((split, idx) => {
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
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-1 h-6 text-xs"
                                      onClick={() => setSelectedParticipantForChart(participant)}
                                    >
                                      <BarChart3 className="w-3 h-3 mr-1" />
                                      Graphique
                                    </Button>
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
              </CardContent>
            </Card>
          );
        }

        // Pour les courses normales, utiliser l'affichage avec timing points
        // Trier les équipages par temps final (classement en temps réel)
        // Si pas de temps final, garder l'ordre du couloir
        const sortedCrews = [...race.crews].sort((a, b) => {
          const aTime = a.final_time ? parseInt(a.final_time, 10) : null;
          const bTime = b.final_time ? parseInt(b.final_time, 10) : null;
          
          // Si les deux ont un temps final, trier par temps croissant
          if (aTime !== null && bTime !== null) {
            return aTime - bTime;
          }
          // Si seul a a un temps, a vient avant
          if (aTime !== null) return -1;
          // Si seul b a un temps, b vient avant
          if (bTime !== null) return 1;
          // Sinon, garder l'ordre du couloir
          return a.lane - b.lane;
        });

        // Trouver le temps du leader pour chaque timing point
        const getLeaderTimeForPoint = (pointId: string) => {
          const lastPointId = timingPoints[timingPoints.length - 1]?.id;
          if (pointId === lastPointId) {
            // Pour le dernier point, utiliser final_time
            const leader = sortedCrews.find(c => c.final_time !== null);
            return leader?.final_time ? parseInt(leader.final_time, 10) : null;
          } else {
            // Pour les points intermédiaires, trouver le meilleur temps
            const times = sortedCrews
              .map(crew => {
                const intermediate = crew.intermediate_times.find(t => t.timing_point_id === pointId);
                return intermediate?.time_ms ? parseInt(intermediate.time_ms, 10) : null;
              })
              .filter((t): t is number => t !== null)
              .sort((a, b) => a - b);
            return times.length > 0 ? times[0] : null;
          }
        };

        // Calculer le classement pour chaque équipage
        const crewsWithPosition: (LiveCrew & { position: number })[] = [];
        let currentPosition = 1;
        
        sortedCrews.forEach((crew, index) => {
          // Si ce n'est pas le premier et que le temps est différent du précédent, incrémenter la position
          if (index > 0) {
            const prevCrew = sortedCrews[index - 1];
            const prevTime = prevCrew.final_time ? parseInt(prevCrew.final_time, 10) : null;
            const currentTime = crew.final_time ? parseInt(crew.final_time, 10) : null;
            
            // Si les deux ont un temps et qu'ils sont différents, incrémenter la position
            if (prevTime !== null && currentTime !== null && prevTime !== currentTime) {
              currentPosition = index + 1;
            }
            // Si le précédent n'avait pas de temps mais celui-ci en a, c'est la première position avec temps
            else if (prevTime === null && currentTime !== null) {
              currentPosition = 1;
            }
            // Si aucun n'a de temps, garder la position basée sur l'index
            else if (prevTime === null && currentTime === null) {
              currentPosition = index + 1;
            }
            // Sinon, même temps = même position
          }
          
          crewsWithPosition.push({ ...crew, position: currentPosition });
        });

        return (
          <Card key={race.id}>
            <CardHeader className="bg-slate-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {race.race_number > 0 ? `Course ${race.race_number} - ` : ""}{race.name}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {dayjs(race.start_time).format("HH:mm")}
                  </span>
                  {getStatusBadge(race.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {sortedCrews.some(c => c.final_time !== null) && (
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
                    {crewsWithPosition.length === 0 && (
                      <tr>
                        <td colSpan={timingPoints.length + (sortedCrews.some(c => c.final_time !== null) ? 3 : 2)} className="py-6 text-center text-muted-foreground">
                          Aucun équipage pour cette course
                        </td>
                      </tr>
                    )}
                    {crewsWithPosition.map((crew) => {
                      const hasFinalTime = sortedCrews.some(c => c.final_time !== null);

                      return (
                        <tr
                          key={crew.crew_id}
                          className="border-b hover:bg-slate-50"
                        >
                          {hasFinalTime && (
                            <td className="py-3 px-3 font-bold">
                              {crew.position}
                            </td>
                          )}
                          <td className="py-3 px-3 font-medium">{crew.lane}</td>
                          <td className="py-3 px-3">
                            <div>
                              <p className="font-medium text-sm">{crew.club_name}</p>
                              <p className="text-xs text-muted-foreground">{crew.club_code}</p>
                            </div>
                          </td>
                          {timingPoints.map((point, index) => {
                            const isLastPoint = index === timingPoints.length - 1;
                            let timeToDisplay = null;

                            if (isLastPoint && crew.final_time) {
                              timeToDisplay = crew.final_time;
                            } else {
                              const intermediate = crew.intermediate_times.find(
                                (t) => t.timing_point_id === point.id
                              );
                              if (intermediate) {
                                timeToDisplay = intermediate.time_ms;
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
      })}

      {races.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Aucune course à afficher</p>
      )}

      {/* Modal avec graphique des splits */}
      <Dialog open={!!selectedParticipantForChart} onOpenChange={(open) => !open && setSelectedParticipantForChart(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Graphique des splits - {selectedParticipantForChart?.crew?.club_name || "Participant"}
            </DialogTitle>
          </DialogHeader>
          {selectedParticipantForChart && selectedParticipantForChart.splits_data && selectedParticipantForChart.splits_data.length > 0 && (
            <div className="space-y-6 mt-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedParticipantForChart.splits_data.map((split, idx) => {
                    // Convertir split_time (centièmes de seconde) en secondes pour le graphique
                    // Exemple: 625 centièmes = 62.5 secondes
                    let splitTimeInSeconds = 0;
                    if (split.split_time !== undefined && split.split_time !== null) {
                      const centiseconds = typeof split.split_time === 'string' ? parseFloat(split.split_time) : split.split_time;
                      if (!isNaN(centiseconds)) {
                        splitTimeInSeconds = centiseconds / 10; // Convertir centièmes en secondes (625 -> 62.5)
                      }
                    } else if (split.split_time_ms) {
                      splitTimeInSeconds = split.split_time_ms / 1000; // Convertir ms en secondes
                    } else if (split.time_ms) {
                      splitTimeInSeconds = split.time_ms / 1000;
                    }
                    
                    return {
                      split: `Split ${idx + 1}`,
                      distance: split.split_distance || split.distance || 0,
                      split_time_seconds: splitTimeInSeconds,
                      split_avg_pace: split.split_avg_pace ? parseFloat(String(split.split_avg_pace).replace(/[^\d.]/g, '')) : 0,
                      split_stroke_rate: split.split_stroke_rate || 0,
                    };
                  })}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="split" />
                    <YAxis yAxisId="left" label={{ value: 'Temps (secondes)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Allure / SPM', angle: 90, position: 'insideRight' }} />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'split_time_seconds') {
                          const minutes = Math.floor(value / 60);
                          const seconds = (value % 60).toFixed(1);
                          return [`${minutes}:${seconds.padStart(4, '0')}`, 'Temps'];
                        }
                        if (name === 'split_avg_pace') {
                          return [value.toFixed(2) + ' s/500m', 'Allure'];
                        }
                        if (name === 'split_stroke_rate') {
                          return [value + ' SPM', 'Cadence'];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="split_time_seconds" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Temps"
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="split_avg_pace" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Allure (s/500m)"
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="split_stroke_rate" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      name="Cadence (SPM)"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Distance totale: {selectedParticipantForChart.distance}m</p>
                <p>Temps total: {selectedParticipantForChart.time_display}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
