import { Button } from "@/components/ui/button";
import { EyeOff } from "lucide-react";
import dayjs from "dayjs";
import api from "@/lib/axios";
import { getSocket } from "@/lib/socket";
import { Checkbox } from "@/components/ui/checkbox";

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
}: Props) {
  return (
    <div className="overflow-x-auto border rounded-xl shadow-sm">
      <table className="min-w-full text-sm text-left table-fixed">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="p-3 w-40 font-semibold">Heure</th>
            {race.RaceCrews.map((rc) => (
              <th key={rc.id} className="p-3 text-center font-semibold">
                Couloir {rc.lane}
                <br />
                <span className="text-xs text-muted-foreground">
                  {rc.Crew.club_name}
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
                  {dayjs(timing.timestamp).format("HH:mm:ss.SSS")}
                </td>

                {race.RaceCrews.map((rc) => {
                  const isChecked = assigned.some((a) => a.crew_id === rc.Crew.id);
                  const assignmentId = assigned.find((a) => a.crew_id === rc.Crew.id)?.id;

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
                                crew_id: rc.Crew.id,
                              });

                              const newAssignments = [
                                ...(assignments[timing.id] || []),
                                { id: res.data.data.id, crew_id: rc.Crew.id },
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
                                crew_id: rc.Crew.id,
                              });
                            } else {
                              if (!assignmentId) return;

                              await api.delete(`/timing-assignments/${assignmentId}`);

                              const remaining = assigned.filter((a) => a.crew_id !== rc.Crew.id);

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
                          race.RaceCrews.map(async (rc) => {
                            const result = await api.post("/timing-assignments", {
                              timing_id: timing.id,
                              crew_id: rc.Crew.id,
                            });
                            return { id: result.data.data.id, crew_id: rc.Crew.id };
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
