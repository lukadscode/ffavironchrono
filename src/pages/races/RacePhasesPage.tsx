import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Plus, Sparkles, Users } from "lucide-react";

import PhaseFormDialog from "@/components/races/PhaseFormDialog";
import PhaseListDnd from "@/components/races/PhaseListDnd";

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header amélioré */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            Phases de courses
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérez les phases et organisez vos courses par catégories
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <PhaseFormDialog onSubmit={handleCreatePhase} />
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-blue-900">
                Phases
              </CardTitle>
              <Trophy className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{phases.length}</div>
            <p className="text-xs text-blue-700 mt-1">
              {phases.length === 1 ? "phase créée" : "phases créées"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-900">
                Catégories
              </CardTitle>
              <Users className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{categories.length}</div>
            <p className="text-xs text-green-700 mt-1">
              {categories.length === 1 ? "catégorie disponible" : "catégories disponibles"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-purple-900">
                Équipages
              </CardTitle>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{totalCrews}</div>
            <p className="text-xs text-purple-700 mt-1">
              {totalCrews === 1 ? "équipage enregistré" : "équipages enregistrés"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-amber-900">
                Générer
              </CardTitle>
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={() => navigate(`/event/${eventId}/generate-races`)}
              disabled={phases.length === 0}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Générer les courses
            </Button>
            <p className="text-xs text-amber-700 mt-2">
              Créer les courses automatiquement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Phases avec titre amélioré */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Phases de courses
            {phases.length > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                {phases.length}
              </span>
            )}
          </h2>
        </div>
        {phases.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Aucune phase créée
              </h3>
              <p className="text-sm text-gray-500 text-center mb-4">
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
    </div>
  );
}
