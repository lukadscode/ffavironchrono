import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";

import PhaseFormDialog from "@/components/races/PhaseFormDialog";
import CategoriesList from "@/components/races/CategoriesList";
import PhaseListDnd from "@/components/races/PhaseListDnd";
import GenerateRacesDialog from "@/components/races/GenerateRacesDialog";

interface RacePhase {
  id: string;
  name: string;
  order_index: number;
}

interface Category {
  id: string;
  label: string;
  crew_count: number;
}

export default function RacesPage() {
  const { eventId } = useParams();
  const [phases, setPhases] = useState<RacePhase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();

  const fetchPhases = async () => {
    const res = await api.get(`/race-phases/${eventId}`);
    setPhases(res.data.data);
  };

  const fetchCategories = async () => {
    const res = await api.get(`/categories/event/${eventId}/with-crews`);
    setCategories(res.data.data);
  };

  const handleCreatePhase = async (name: string, order: number) => {
    try {
      await api.post("/race-phases", { event_id: eventId, name, order_index: order });
      toast({ title: "Phase créée avec succès." });
      fetchPhases();
    } catch {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    }
  };

  const handleDeletePhase = async (id: string) => {
    try {
      await api.delete(`/race-phases/${id}`);
      setPhases((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Phase supprimée." });
    } catch {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  const handleReorder = async (newPhases: RacePhase[]) => {
    setPhases(newPhases);
    await Promise.all(
      newPhases.map((p) =>
        api.put(`/race-phases/${p.id}`, { name: p.name, order_index: p.order_index })
      )
    );
  };

  useEffect(() => {
    if (eventId) {
      fetchPhases();
      fetchCategories();
    }
  }, [eventId]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Phases de courses</h2>
        <div className="flex gap-4">
          <PhaseFormDialog onSubmit={handleCreatePhase} />
          <GenerateRacesDialog
            eventId={eventId!}
            phases={phases}
            onSuccess={fetchPhases}
          />
        </div>
      </div>
      <CategoriesList categories={categories} />
      <PhaseListDnd
        phases={phases}
        onReorder={handleReorder}
        onDelete={handleDeletePhase}
        eventId={eventId!}
        enableCrewDrag={true}
      />
    </div>
  );
}
