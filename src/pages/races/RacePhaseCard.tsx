import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RaceFormDialog from "@/components/races/RaceFormDialog";
import { useToast } from "@/hooks/use-toast";
import RaceListItem from "./RaceListItem";
import { DndContext } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import api from "@/lib/axios";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";

// helper téléchargement
async function downloadPdf(url: string, filename: string) {
  const res = await api.get(url, { responseType: "blob" });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}


interface RacePhaseCardProps {
  phase: {
    id: string;
    name: string;
    order_index: number;
  };
  onDelete: (id: string) => Promise<void>;
  eventId: string;
  enableCrewDrag?: boolean;
}

export default function RacePhaseCard({
  phase,
  onDelete,
  eventId,
  enableCrewDrag = false,
}: RacePhaseCardProps) {
  const [races, setRaces] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchRaces = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const racesForPhase = res.data.data.filter((r: any) => r.phase_id === phase.id);

      const racesWithCrews = await Promise.all(
        racesForPhase.map(async (race: any) => {
          const crewsRes = await api.get(`/race-crews/${race.id}`);
          return { ...race, crews: crewsRes.data.data };
        })
      );

      setRaces(racesWithCrews);
    } catch (err) {
      toast({ title: "Erreur lors du chargement des courses", variant: "destructive" });
    }
  };

  const handleCreateSuccess = () => {
    fetchRaces();
    toast({ title: "Course créée avec succès." });
  };

  const handleDeleteRace = async (id: string) => {
    try {
      await api.delete(`/races/${id}`);
      setRaces((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Course supprimée." });
    } catch (err) {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchRaces();
  }, [phase.id]);

  // Grouper par catégorie
  const groupedByCategory = races.reduce((acc: Record<string, any[]>, race) => {
    const label = race.crews[0]?.crew?.category_label || "Sans catégorie";
    if (!acc[label]) acc[label] = [];
    acc[label].push(race);
    return acc;
  }, {});

  return (
    <Card className="min-w-[320px] w-full  rounded-xl shadow-sm flex flex-col">
      <CardHeader className=" border-b px-4 py-2 flex items-center justify-between">
        <CardTitle className="text-sm font-semibold text-gray-700">{phase.name}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/event/${eventId}/racePhases/${phase.id}`)}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <RaceFormDialog
            phaseId={phase.id}
            eventId={eventId}
            onSuccess={handleCreateSuccess}
          />
        </div>
      </CardHeader>

      <CardContent className="px-4 py-2 overflow-y-auto max-h-[75vh] space-y-4">
        <DndContext onDragEnd={() => {}}>
          {Object.entries(groupedByCategory).map(([categoryLabel, categoryRaces]) => (
            <div key={categoryLabel} className="space-y-2">
              <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide border-b pb-1">
                {categoryLabel}
              </div>
              <SortableContext
                items={categoryRaces.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {categoryRaces.map((race) => {

                    return (
                      <div key={race.id}>
                        <RaceListItem
                          race={race}
                          onDelete={handleDeleteRace}
                          refresh={fetchRaces}
                          enableCrewDrag={enableCrewDrag}
                        />
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </div>
          ))}
        </DndContext>
      </CardContent>
    </Card>
  );
}
