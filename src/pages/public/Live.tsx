import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { initSocket, getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type LiveRace = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  crews: LiveCrew[];
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

  useEffect(() => {
    if (!eventId) return;

    initSocket();
    const socket = getSocket();

    socket.emit("joinPublicEvent", { event_id: eventId });

    socket.on("raceStatusUpdate", ({ race_id, status }: { race_id: string; status: string }) => {
      setRaces((prev) =>
        prev.map((race) => (race.id === race_id ? { ...race, status } : race))
      );
    });

    socket.on(
      "raceIntermediateUpdate",
      async ({
        race_id,
        crew_id,
        timing_point_id,
        timing_point_label,
        distance_m,
        time_ms,
        order_index,
      }: {
        race_id: string;
        crew_id: string;
        timing_point_id: string;
        timing_point_label: string;
        distance_m: number;
        time_ms: string;
        order_index: number;
      }) => {
        console.log('🔔 raceIntermediateUpdate reçu:', { race_id, crew_id, timing_point_id, time_ms });

        setRaces((prev) =>
          prev.map((race) => {
            if (race.id !== race_id) return race;

            return {
              ...race,
              crews: race.crews.map((crew) => {
                if (crew.crew_id !== crew_id) return crew;

                const existingTimes = crew.intermediate_times.filter(
                  (t) => t.timing_point_id !== timing_point_id
                );

                return {
                  ...crew,
                  intermediate_times: [
                    ...existingTimes,
                    {
                      timing_point_id,
                      timing_point_label,
                      distance_m,
                      time_ms,
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
      ({ race_id, crew_id, final_time }: { race_id: string; crew_id: string; final_time: string }) => {
        console.log('🏁 raceFinalUpdate reçu:', { race_id, crew_id, final_time });

        setRaces((prev) =>
          prev.map((race) => {
            if (race.id !== race_id) return race;

            return {
              ...race,
              crews: race.crews.map((crew) =>
                crew.crew_id === crew_id ? { ...crew, final_time } : crew
              ),
            };
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
        const [racesRes, timingPointsRes] = await Promise.all([
          api.get(`/races/event/${eventId}`),
          api.get(`/timing-points/event/${eventId}`)
        ]);

        const allRaces = racesRes.data.data || [];
        const points = timingPointsRes.data.data || [];
        console.log('📊 Courses reçues:', allRaces.length, allRaces);
        console.log('📍 Points de chronométrage:', points.length, points);

        const sortedPoints = points.sort((a: TimingPoint, b: TimingPoint) => a.order_index - b.order_index);
        setTimingPoints(sortedPoints);

        const sorted = allRaces.sort((a: any, b: any) => (a.race_number || 0) - (b.race_number || 0));
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
              const assignmentsRes = await api.get(`/timing-assignments/race/${race.id}`);
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

              const startTimings: Record<string, number> = {};

              for (const assignment of assignments) {
                if (!assignment.timing_id || !assignment.crew_id) continue;

                try {
                  const timingRes = await api.get(`/timings/${assignment.timing_id}`);
                  const timing = timingRes.data.data;
                  if (!timing) continue;

                  const timingPoint = sortedPoints.find((p: TimingPoint) => p.id === timing.timing_point_id);
                  if (!timingPoint) continue;

                  const crewIndex = crews.findIndex((c: any) => c.crew_id === assignment.crew_id);
                  if (crewIndex === -1) continue;

                  const absoluteTime = new Date(timing.timestamp).getTime();

                  if (timingPoint.id === startPointId) {
                    startTimings[assignment.crew_id] = absoluteTime;
                    continue;
                  }

                  const startTime = startTimings[assignment.crew_id];
                  if (!startTime) continue;

                  const time_ms = absoluteTime - startTime;
                  console.log(`⏱️ Crew ${assignment.crew_id} - Point ${timingPoint.label}: absolu=${absoluteTime}, start=${startTime}, relatif=${time_ms}ms`);

                  if (timingPoint.id === lastPointId) {
                    crews[crewIndex].final_time = time_ms.toString();
                  } else {
                    crews[crewIndex].intermediate_times.push({
                      timing_point_id: timingPoint.id,
                      timing_point_label: timingPoint.label,
                      distance_m: timingPoint.distance_m,
                      time_ms: time_ms.toString(),
                      order_index: timingPoint.order_index,
                    });
                  }
                } catch (err) {
                  console.error(`Erreur chargement timing ${assignment.timing_id}`, err);
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
        console.log('✅ Courses valides après enrichissement:', validRaces.length, validRaces);
        setRaces(validRaces);
      } catch (err) {
        console.error("Erreur chargement données live", err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchData();
  }, [eventId]);

  const formatTime = (ms: string | number) => {
    const diffMs = parseInt(ms.toString(), 10);
    if (isNaN(diffMs) || diffMs < 0) return "N/A";

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = diffMs % 1000;

    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "not_started":
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">À venir</span>;
      case "in_progress":
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 animate-pulse">En cours</span>;
      case "unofficial":
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

      {races.map((race) => (
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
                  {race.crews.length === 0 && (
                    <tr>
                      <td colSpan={timingPoints.length + 2} className="py-6 text-center text-muted-foreground">
                        Aucun équipage pour cette course
                      </td>
                    </tr>
                  )}
                  {race.crews.map((crew) => {
                    const isFinished = crew.final_time !== null;
                    return (
                      <tr key={crew.crew_id} className="border-b hover:bg-slate-50">
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

                          return (
                            <td
                              key={point.id}
                              className={`py-3 px-3 text-center font-mono text-sm ${
                                isLastPoint && timeToDisplay ? "font-bold text-green-600" : ""
                              }`}
                            >
                              {timeToDisplay ? (
                                formatTime(timeToDisplay)
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
      ))}

      {races.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Aucune course à afficher</p>
      )}
    </div>
  );
}
