import React from "react";
import { Button } from "@/components/ui/button";
import { EyeOff } from "lucide-react";
import dayjs from "dayjs";
import api from "@/lib/axios";
import { getSocket } from "@/lib/socket";
import { Checkbox } from "@/components/ui/checkbox";

type TimingPoint = {
  id: string;
  label: string;
  order_index: number;
  distance_m: number;
  event_id: string;
};

type Props = {
  race: {
    id: string;
    RaceCrews: {
      id: string;
      lane: number;
      Crew: { id: string; club_name: string };
    }[];
  };
  visibleTimings: {
    id: string;
    timestamp: string;
    status: string;
  }[];
  assignments: Record<string, { id: string; crew_id: string }[]>;
  setAssignments: React.Dispatch<
    React.SetStateAction<Record<string, { id: string; crew_id: string }[]>>
  >;
  setTimings: React.Dispatch<React.SetStateAction<any[]>>;
  crewIdsInSelectedRace: string[];
  selectedRaceId: string;
  timingPointId: string;
  crewIdToRaceName: Record<string, string>;
  currentTimingPoint: TimingPoint | null;
  timingPoints: TimingPoint[];
  eventId: string;
};

export default function TimingTable({
  race,
  visibleTimings,
  assignments,
  setAssignments,
  setTimings,
  crewIdsInSelectedRace,
  selectedRaceId,
  timingPointId,
  crewIdToRaceName,
  currentTimingPoint,
  timingPoints,
  eventId,
}: Props) {
  const [startTimings, setStartTimings] = React.useState<Record<string, Record<string, string>>>({});

  const isStartPoint = currentTimingPoint?.order_index === 1;
  const isFinishPoint = timingPoints.length > 0 && currentTimingPoint?.order_index === timingPoints.length;
  const startPoint = timingPoints.find(tp => tp.order_index === 1);

  const checkRaceStarted = async () => {
    if (!isStartPoint) return;

    try {
      const res = await api.get(`/races/${selectedRaceId}`);
      const currentRace = res.data.data;

      if (currentRace.status === "not_started") {
        await api.put(`/races/${selectedRaceId}`, { status: "in_progress" });
      }
    } catch (err) {
      console.error("Erreur mise à jour statut course", err);
    }
  };

  const checkRaceFinished = async () => {
    console.log("🔍 checkRaceFinished appelée", {
      isFinishPoint,
      currentTimingPoint,
      timingPointsLength: timingPoints.length
    });

    if (!isFinishPoint) {
      console.log("❌ Pas un point d'arrivée, skip");
      return;
    }

    try {
      const totalCrews = race.RaceCrews?.length || 0;

      console.log("📊 Race actuelle:", {
        raceId: selectedRaceId,
        totalCrews,
        RaceCrews: race.RaceCrews
      });

      if (totalCrews === 0) {
        console.log("⚠️ Aucun équipage dans cette course");
        return;
      }

      const res = await api.get(`/races/${selectedRaceId}`);
      const currentRace = res.data.data;

      const finishPointId = currentTimingPoint?.id;
      if (!finishPointId) {
        console.log("❌ Pas de finishPointId");
        return;
      }

      const timingsRes = await api.get(`/timings/timing-point/${finishPointId}`);
      const finishTimings = timingsRes.data.data || [];

      console.log("⏱️ Timings d'arrivée:", finishTimings);

      const assignmentsRes = await api.get(`/timing-assignments/race/${selectedRaceId}`);
      const allAssignments = assignmentsRes.data.data || [];

      console.log("🔗 Assignments de la course:", allAssignments);

      const finishedCrews = new Set();

      for (const timing of finishTimings) {
        const assignment = allAssignments.find((a: any) => a.timing_id === timing.id);
        if (assignment) {
          console.log(`✅ Timing ${timing.id} assigné à crew ${assignment.crew_id}`);
          finishedCrews.add(assignment.crew_id);
        }
      }

      console.log(`🏁 Crews finis: ${finishedCrews.size}/${totalCrews}`, Array.from(finishedCrews));

      if (finishedCrews.size === totalCrews && currentRace.status === "in_progress") {
        console.log("🎉 Passage en unofficial");
        await api.put(`/races/${selectedRaceId}`, { status: "unofficial" });
      } else if (finishedCrews.size < totalCrews && currentRace.status === "unofficial") {
        console.log("↩️ Retour en in_progress");
        await api.put(`/races/${selectedRaceId}`, { status: "in_progress" });
      } else {
        console.log("⏸️ Aucune action nécessaire", {
          condition1: `${finishedCrews.size} === ${totalCrews}`,
          condition2: `status = ${currentRace.status}`
        });
      }
    } catch (err) {
      console.error("Erreur vérification fin de course", err);
    }
  };

  React.useEffect(() => {
    if (isStartPoint || !startPoint) return;

    const fetchStartTimings = async () => {
      try {
        const res = await api.get(`/timings/event/${eventId}`);
        const allTimings = res.data.data;

        const startTimingsMap: Record<string, Record<string, string>> = {};

        for (const crewId of crewIdsInSelectedRace) {
          const assignmentsRes = await api.get(`/timing-assignments/crew/${crewId}`);
          const crewAssignments = assignmentsRes.data.data;

          const startAssignment = crewAssignments.find(
            (a: any) => allTimings.some(
              (t: any) => t.id === a.timing_id && t.timing_point_id === startPoint.id
            )
          );

          if (startAssignment) {
            const startTiming = allTimings.find((t: any) => t.id === startAssignment.timing_id);
            if (startTiming) {
              if (!startTimingsMap[race.id]) startTimingsMap[race.id] = {};
              startTimingsMap[race.id][crewId] = startTiming.timestamp;
            }
          }
        }

        setStartTimings(startTimingsMap);
      } catch (err) {
        console.error('Erreur chargement timings de départ:', err);
      }
    };

    fetchStartTimings();
  }, [race.id, crewIdsInSelectedRace, isStartPoint, startPoint, eventId]);

  const calculateSplitTime = (currentTimestamp: string, crewId: string): string | null => {
    if (isStartPoint) return null;

    const startTimestamp = startTimings[race.id]?.[crewId];
    if (!startTimestamp) return null;

    const start = new Date(startTimestamp).getTime();
    const current = new Date(currentTimestamp).getTime();
    const diffMs = current - start;

    if (diffMs < 0) return null;

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = diffMs % 1000;

    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };
  return (
    <div className="overflow-x-auto border rounded-xl shadow-sm">
      <table className="min-w-full text-sm text-left table-fixed">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="p-3 w-40 font-semibold">
              {isStartPoint ? 'Heure de départ' : isFinishPoint ? 'Temps final' : `Temps intermédiaire (${currentTimingPoint?.distance_m}m)`}
            </th>
            {(race.RaceCrews || [])
              .sort((a, b) => a.lane - b.lane)
              .map((rc) => (
                <th key={rc.id} className="p-3 text-center font-semibold">
                  Couloir {rc.lane}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {rc.Crew?.club_name}
                  </span>
                </th>
              ))}
            <th className="p-3 text-center font-semibold w-32">Actions</th>
            <th className="p-3 text-center font-semibold w-40">Statut</th>
          </tr>
        </thead>
        <tbody>
          {visibleTimings.map((timing) => {
            const assigned = assignments[timing.id] || [];
            const isAssignedToThisRace =
              assigned.length === 0 || assigned.some((a) => crewIdsInSelectedRace.includes(a.crew_id));
            const isLocked = assigned.length > 0;

            return (
              <tr
                key={timing.id}
                className={`border-t hover:bg-accent transition ${isLocked ? "bg-green-50" : ""}`}
              >
                <td className="p-2 font-mono whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {dayjs(timing.timestamp).format("HH:mm:ss.SSS")}
                    </span>
                    {!isStartPoint && assigned.length > 0 && assigned.map((a) => {
                      const splitTime = calculateSplitTime(timing.timestamp, a.crew_id);
                      if (!splitTime) return null;
                      return (
                        <span key={a.crew_id} className={`text-sm font-bold ${isFinishPoint ? 'text-red-600' : 'text-blue-600'}`}>
                          {splitTime}
                        </span>
                      );
                    })}
                  </div>
                </td>

                {(race.RaceCrews || [])
                  .sort((a, b) => a.lane - b.lane)
                  .map((rc) => {
                    const isChecked = assigned.some((a) => a.crew_id === rc.Crew?.id);
                    const assignmentId = assigned.find((a) => a.crew_id === rc.Crew?.id)?.id;

                    return (
                      <td key={rc.id} className="p-2 text-center">
                      <Checkbox
                        checked={isChecked}
                        disabled={isLocked && !isChecked}
                        onCheckedChange={async (checked) => {
                          try {
                            if (checked) {
                              const res = await api.post("/timing-assignments", {
                                timing_id: timing.id,
                                crew_id: rc.Crew?.id,
                              });

                              const newAssignments = [
                                ...(assignments[timing.id] || []),
                                { id: res.data.data.id, crew_id: rc.Crew?.id },
                              ];

                              setAssignments((prev) => ({
                                ...prev,
                                [timing.id]: newAssignments,
                              }));

                              await api.put(`/timings/${timing.id}`, {
                                status: "assigned",
                              });

                              setTimings((prev) =>
                                prev.map((t) =>
                                  t.id === timing.id ? { ...t, status: "assigned" } : t
                                )
                              );

                              getSocket().emit("assignTiming", {
                                race_id: selectedRaceId,
                                timing_id: timing.id,
                                crew_id: rc.Crew?.id,
                              });

                              await checkRaceStarted();
                              await checkRaceFinished();
                            } else {
                              if (!assignmentId) return;

                              await api.delete(`/timing-assignments/${assignmentId}`);

                              const remaining = assigned.filter((a) => a.crew_id !== rc.Crew?.id);

                              setAssignments((prev) => ({
                                ...prev,
                                [timing.id]: remaining,
                              }));

                              if (remaining.length === 0) {
                                await api.put(`/timings/${timing.id}`, {
                                  status: "pending",
                                });

                                setTimings((prev) =>
                                  prev.map((t) =>
                                    t.id === timing.id ? { ...t, status: "pending" } : t
                                  )
                                );
                              }

                              await checkRaceFinished();
                            }
                          } catch (err) {
                            console.error("Erreur assignation", err);
                          }
                        }}
                        className="h-4 w-4 mx-auto"
                      />
                    </td>
                  );
                })}

                <td className="p-2 flex items-center justify-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await Promise.all(
                          (race.RaceCrews || []).map(async (rc) => {
                            const result = await api.post("/timing-assignments", {
                              timing_id: timing.id,
                              crew_id: rc.Crew?.id,
                            });
                            return { id: result.data.data.id, crew_id: rc.Crew?.id };
                          })
                        );

                        setAssignments((prev) => ({
                          ...prev,
                          [timing.id]: res,
                        }));

                        await api.put(`/timings/${timing.id}`, {
                          status: "assigned",
                        });

                        setTimings((prev) =>
                          prev.map((t) =>
                            t.id === timing.id ? { ...t, status: "assigned" } : t
                          )
                        );

                        getSocket().emit("assignTiming", {
                          race_id: selectedRaceId,
                          timing_id: timing.id,
                          crew_id: "multi",
                        });

                        await checkRaceStarted();
                        await checkRaceFinished();
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    title="Assigner à tous"
                  >
                    🏁
                  </Button>

                  <Button
                    size="icon"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await api.put(`/timings/${timing.id}`, {
                          status: "hidden",
                        });
                        setTimings((prev) => prev.filter((t) => t.id !== timing.id));
                        await checkRaceFinished();
                      } catch {}
                    }}
                  >
                    <EyeOff className="w-4 h-4" />
                  </Button>
                </td>

                <td className="p-2 text-center">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      timing.status === "assigned"
                        ? "bg-green-100 text-green-800"
                        : timing.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {timing.status}
                    {timing.status === "assigned" && assigned.length > 0 && (
                      <> – {crewIdToRaceName[assigned[0]?.crew_id] ?? "Autre série"}</>
                    )}
                  </span>
                  
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
