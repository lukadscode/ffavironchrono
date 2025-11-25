import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import clsx from "clsx";
import { useDroppable, useDraggable, useDndMonitor } from "@dnd-kit/core";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

const getCategoryColor = (label: string) => {
  const hash = Array.from(label).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    "bg-blue-100", "bg-green-100", "bg-yellow-100",
    "bg-red-100", "bg-purple-100", "bg-pink-100",
  ];
  return colors[hash % colors.length];
};

interface Participant {
  id: string;
  first_name: string;
  last_name: string;
  license_number?: string;
}

interface CrewParticipant {
  id: string;
  participant_id: string;
  is_coxswain: boolean;
  seat_position: number;
  participant: Participant;
}

interface CrewEntry {
  id: string;
  lane: number;
  crew: {
    club_name: string;
    club_code: string;
    category_id: string;
    category_label?: string;
    crew_participants?: CrewParticipant[];
  };
}

interface RaceListItemProps {
  race: {
    id: string;
    name: string;
    race_type: string;
    lane_count?: number;
    crews: CrewEntry[];
    status?: string;
    start_time?: string;
  };
  onDelete: (id: string) => void;
  refresh: () => void;
  enableCrewDrag?: boolean;
}

export default function RaceListItem({ race, onDelete, refresh, enableCrewDrag = false }: RaceListItemProps) {
  const [crews, setCrews] = useState(race.crews || []);
  const { toast } = useToast();

  useEffect(() => {
    setCrews(race.crews || []);
  }, [race]);

  const categoryLabel = race.crews[0]?.crew?.category_label ?? "Catégorie";

  useDndMonitor({
    async onDragEnd(event) {
      if (!enableCrewDrag) return;

      const { active, over } = event;
      const crewId = active?.data?.current?.crewId;
      const fromRaceId = active?.data?.current?.fromRaceId;
      const target = over?.data?.current;

      if (!crewId || !target || target.raceId === fromRaceId) return;

      try {
        await api.put(`/race-crews/${crewId}`, {
          race_id: target.raceId,
          lane: target.lane,
        });
        toast({ title: "Équipage déplacé." });
        refresh();
      } catch {
        toast({ title: "Erreur lors du déplacement", variant: "destructive" });
      }
    },
  });

  const laneCount = race.lane_count || 6;
  const lanes = Array.from({ length: laneCount }, (_, i) => i + 1);

  return (
<Card className="w-full border border-gray-200 bg-white rounded-lg shadow-sm">
    <CardHeader className="p-2 bg-blue-100 flex items-center justify-between border-b">
      <div className="flex items-center gap-2 w-full justify-between">
        <div className="flex-1 truncate">
          <div className="text-sm font-medium text-gray-800 truncate">{race.name}</div>
          <div className="text-[11px] text-gray-500 truncate">{race.race_type}</div>
        </div>

        {/* Badges status et heure */}
        <div className="flex items-center gap-2 mr-2">
          {race.status && (
            <span className="text-[10px] px-2 py-[2px] rounded-full bg-gray-200 text-gray-700 uppercase font-semibold tracking-wide">
              {race.status.replace("_", " ")}
            </span>
          )}
          {race.start_time && (
            <span className="text-[10px] px-2 py-[2px] rounded-full bg-green-100 text-green-800">
              {new Date(race.start_time).toLocaleString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Bouton Supprimer */}
        <button
          onClick={() => onDelete(race.id)}
          className="text-red-500 hover:text-red-600 transition-colors p-0 h-auto w-auto background-transparent border-none cursor-pointer"
          aria-label="Supprimer la course"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </CardHeader>


  <CardContent className="px-2 bg-blue-100 py-2 space-y-1">
    {lanes.map((laneNum) => {
      const entry = crews.find((c) => c.lane === laneNum);

      const { setNodeRef: dragRef, attributes, listeners } = useDraggable(
        entry
          ? { id: entry.id, data: { crewId: entry.id, fromRaceId: race.id } }
          : { id: `empty-${race.id}-${laneNum}` }
      );

      const { setNodeRef: dropRef } = useDroppable({
        id: `${race.id}-${laneNum}`,
        data: { raceId: race.id, lane: laneNum },
      });

      const participants = entry?.crew?.crew_participants
        ?.sort((a, b) => a.seat_position - b.seat_position)
        .map((cp) => {
          const firstName = cp.participant?.first_name || "";
          const lastName = cp.participant?.last_name || "";
          const displayName = firstName && lastName ? `${firstName} ${lastName}` : lastName || firstName;
          return { displayName, isCoxswain: cp.is_coxswain };
        }) || [];

      return (
        <div
          key={laneNum}
          ref={(el) => {
            dragRef(el);
            dropRef(el);
          }}
          {...(entry ? attributes : {})}
          {...(entry ? listeners : {})}
          className={clsx(
            "px-3 py-1 rounded-md text-xs",
            entry ? "bg-white text-gray-800 cursor-grab" : "bg-gray-50 italic text-gray-400"
          )}
        >
          <div className="flex justify-between items-start gap-2">
            <span className="font-semibold">L{laneNum}</span>
            <div className="flex-1 text-right min-w-0">
              {entry ? (
                <div className="space-y-0.5">
                  <div className="font-medium truncate">{entry.crew?.club_name}</div>
                  {participants.length > 0 && (
                    <div className="text-[10px] text-gray-600 space-y-0.5">
                      {participants.map((p, idx) => (
                        <div key={idx} className={clsx("truncate", p.isCoxswain && "font-semibold")}>
                          {p.displayName}
                          {p.isCoxswain && <span className="text-gray-500 ml-0.5">(B)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="italic">(vide)</span>
              )}
            </div>
          </div>
        </div>
      );
    })}
  </CardContent>
</Card>

  );
}
