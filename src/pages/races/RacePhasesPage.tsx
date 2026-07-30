import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Plus, Sparkles, Users } from "lucide-react";
import clsx from "clsx";

import PhaseFormDialog from "@/components/races/PhaseFormDialog";
import PhaseListDnd from "@/components/races/PhaseListDnd";
import { AdminPage } from "@/components/layout/AdminPage";
import { StatCard } from "@/components/layout/StatCard";

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
  const navigate = useNavigate();
  const [phases, setPhases] = useState<RacePhase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();

  const fetchPhases = async () => {
    const res = await api.get(`/race-phases/${eventId}`);
    setPhases(res.data.data);
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get(`/categories/event/${eventId}/with-crews`);
      setCategories(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement catégories:", err);
    }
  };

  const handleCreatePhase = async (name: string, order: number) => {
    try {
      await api.post("/race-phases", { event_id: eventId, name, order_index: order });
      toast({ title: "Phase créée avec succès." });
      fetchPhases();
    } catch (err: any) {
      toast({ 
        title: "Erreur lors de la création", 
        description: err?.response?.data?.message || "Impossible de créer la phase",
        variant: "destructive" 
      });
    }
  };

  const handleEditPhase = async (id: string, name: string, order: number) => {
    try {
      await api.put(`/race-phases/${id}`, { name, order_index: order });
      toast({ title: "Phase modifiée avec succès." });
      fetchPhases();
    } catch (err: any) {
      toast({ 
        title: "Erreur lors de la modification", 
        description: err?.response?.data?.message || "Impossible de modifier la phase",
        variant: "destructive" 
      });
    }
  };

  const handleDeletePhase = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette phase ? Cette action est irréversible.")) {
      return;
    }
    
    try {
      await api.delete(`/race-phases/${id}`);
      setPhases((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Phase supprimée." });
    } catch (err: any) {
      toast({ 
        title: "Erreur lors de la suppression", 
        description: err?.response?.data?.message || "Impossible de supprimer la phase",
        variant: "destructive" 
      });
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

  const totalCrews = categories.reduce((sum, cat) => sum + cat.crew_count, 0);

  return (
    <AdminPage
      title="Phases de courses"
      description="Gérez les phases et organisez vos courses par catégories."
      icon={Trophy}
      actions={<PhaseFormDialog onSubmit={handleCreatePhase} />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          className={clsx(
            phases.length > 0 ? "cursor-pointer" : "opacity-60 cursor-not-allowed"
          )}
          onClick={() => {
            if (phases.length > 0) {
              navigate(`/event/${eventId}/generate-races`);
            }
          }}
          onKeyDown={(e) => {
            if (phases.length > 0 && (e.key === "Enter" || e.key === " ")) {
              navigate(`/event/${eventId}/generate-races`);
            }
          }}
          role={phases.length > 0 ? "button" : undefined}
          tabIndex={phases.length > 0 ? 0 : undefined}
        >
          <StatCard
            label="Générer"
            value="Courses"
            icon={Sparkles}
            hint={
              phases.length === 0
                ? "Créez d'abord une phase"
                : "Créer les courses automatiquement"
            }
            className={phases.length > 0 ? "hover:border-primary/50 transition-colors" : undefined}
          />
        </div>
        <StatCard
          label="Phases"
          value={phases.length}
          icon={Trophy}
          hint={phases.length === 1 ? "phase créée" : "phases créées"}
        />
        <StatCard
          label="Catégories"
          value={categories.length}
          icon={Users}
          hint={categories.length === 1 ? "catégorie disponible" : "catégories disponibles"}
        />
        <StatCard
          label="Équipages"
          value={totalCrews}
          icon={Users}
          hint={totalCrews === 1 ? "équipage enregistré" : "équipages enregistrés"}
        />
      </div>

      {/* Phases avec titre amélioré */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Phases de courses
            {phases.length > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                {phases.length}
              </span>
            )}
          </h2>
        </div>
        {phases.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Aucune phase créée
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Commencez par créer une phase pour organiser vos courses
              </p>
              <PhaseFormDialog onSubmit={handleCreatePhase} />
            </CardContent>
          </Card>
        ) : (
          <PhaseListDnd
            phases={phases}
            onReorder={handleReorder}
            onDelete={handleDeletePhase}
            onEdit={handleEditPhase}
            eventId={eventId!}
            enableCrewDrag={true}
          />
        )}
      </div>
    </AdminPage>
  );
}
