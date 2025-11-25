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
import { Settings, Trophy, Users, Edit, Trash2 } from "lucide-react";
import PhaseFormDialog from "@/components/races/PhaseFormDialog";

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
  onEdit: (id: string, name: string, order: number) => Promise<void>;
  eventId: string;
  enableCrewDrag?: boolean;
}

export default function RacePhaseCard({
  phase,
  onDelete,
  onEdit,
  eventId,
  enableCrewDrag = false,
}: RacePhaseCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
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

  const totalRaces = races.length;
  const totalCrews = races.reduce((sum, race) => sum + (race.crews?.length || 0), 0);

  return (
    <Card className="min-w-[320px] w-full rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col border-gray-200 bg-white">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white px-4 py-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-semibold text-slate-900 truncate">
            {phase.name}
          </CardTitle>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {totalRaces} {totalRaces === 1 ? "course" : "courses"}
            </span>
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {totalCrews} {totalCrews === 1 ? "équipage" : "équipages"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/event/${eventId}/racePhases/${phase.id}`)}
            className="h-8"
            title="Gérer la phase"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <PhaseFormDialog
            phase={phase}
            onSubmit={(name, order) => onEdit(phase.id, name, order)}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                title="Modifier la phase"
              >
                <Edit className="w-4 h-4" />
              </Button>
            }
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(phase.id)}
            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Supprimer la phase"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <RaceFormDialog
            phaseId={phase.id}
            eventId={eventId}
            onSuccess={handleCreateSuccess}
          />
        </div>
      </CardHeader>

      <CardContent className="px-4 py-3 overflow-y-auto max-h-[75vh] space-y-4">
        {totalRaces === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune course dans cette phase</p>
            <p className="text-xs text-slate-400 mt-1">Créez une course pour commencer</p>
          </div>
        ) : (
          <DndContext onDragEnd={() => {}}>
            {Object.entries(groupedByCategory).map(([categoryLabel, categoryRaces]) => (
              <div key={categoryLabel} className="space-y-2">
                <div className="text-xs text-slate-700 font-semibold uppercase tracking-wide border-b border-slate-200 pb-2 pt-2 bg-slate-50 -mx-4 px-4 rounded-t">
                  {categoryLabel}
                  <span className="ml-2 text-slate-500 font-normal lowercase">
                    ({categoryRaces.length})
                  </span>
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
        )}
      </CardContent>
    </Card>
  );
}
