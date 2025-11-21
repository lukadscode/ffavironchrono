import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Building2, Award, GripVertical, Save, ArrowLeft } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Plus, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

function SortableRow({ participant, onRemove }: { participant: any; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: participant.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // L'API retourne 'participant' (minuscule) au lieu de 'Participant'
  const participantData = participant.participant || participant.Participant || {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white rounded-lg border-2 transition-all duration-200 ${
        isDragging ? "border-blue-500 shadow-lg scale-105" : "border-slate-200 hover:border-blue-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Handle de drag */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-600 transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Badge de position */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
          {participant.seat_position}
        </div>

        {/* Informations du participant */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 text-lg">
              {participantData.first_name} {participantData.last_name}
            </h3>
            {participant.is_coxswain && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                Barreur
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            {participantData.license_number && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Licence:</span>
                <span className="font-mono">{participantData.license_number}</span>
              </div>
            )}
            {participantData.club_name && (
              <div className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>{participantData.club_name}</span>
              </div>
            )}
            {participantData.gender && (
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>{participantData.gender}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bouton de suppression */}
        {!participant.isNew && (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(participant.id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CrewDetail() {
  const { crewId, eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [crew, setCrew] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [newParticipant, setNewParticipant] = useState({
    first_name: "",
    last_name: "",
    license_number: "",
    club_name: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchCrew() {
      if (!crewId) {
        setError("ID d'équipage manquant");
        setLoading(false);
        return;
      }

      try {
        console.log("🔍 Récupération de l'équipage:", crewId);
        const res = await api.get(`/crews/${crewId}`);
        console.log("✅ Réponse API crew:", res.data);
        
        const crewData = res.data.data || res.data;
        
        if (!crewData) {
          setError("Équipage introuvable");
          setLoading(false);
          return;
        }

        setCrew(crewData);
        
        // Gérer les participants - l'API retourne 'crew_participants' (minuscules avec underscore)
        const crewParticipants = crewData.crew_participants || 
                                 crewData.CrewParticipants || 
                                 crewData.crewParticipants || 
                                 [];
        
        const sortedParticipants = [...crewParticipants].sort(
          (a: any, b: any) => (a.seat_position || 0) - (b.seat_position || 0)
        );
        
        console.log("👥 Participants trouvés:", sortedParticipants.length);
        setParticipants(sortedParticipants);
        setError(null);
      } catch (err: any) {
        console.error("❌ Erreur chargement équipage:", err);
        console.error("❌ Détails:", err.response?.data);
        console.error("❌ Status:", err.response?.status);
        
        const errorMessage = 
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Impossible de charger l'équipage";
        
        setError(errorMessage);
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchCrew();
  }, [crewId, toast]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = participants.findIndex((p) => p.id === active.id);
    const newIndex = participants.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(participants, oldIndex, newIndex).map((p, index) => ({
      ...p,
      seat_position: index + 1,
    }));
    setParticipants(reordered);
  };

  const handleAddParticipant = () => {
    const id = crypto.randomUUID();
    const seat_position = participants.length + 1;
    const newP = {
      id,
      seat_position,
      is_coxswain: false,
      participant: { ...newParticipant },
      isNew: true,
    };
    setParticipants([...participants, newP]);
    setNewParticipant({ first_name: "", last_name: "", license_number: "", club_name: "" });
    toast({
      title: "Participant ajouté",
      description: "N'oubliez pas d'enregistrer vos modifications",
    });
  };

  const handleRemove = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id).map((p, index) => ({
      ...p,
      seat_position: index + 1,
    })));
  };

  const handleSave = async () => {
    if (!crewId) return;

    setIsSaving(true);
    try {
      const existing = participants.filter((p) => !p.isNew).map((p) => ({
        id: p.id,
        seat_position: p.seat_position,
      }));

      const created = participants
        .filter((p) => p.isNew)
        .map((p) => {
          // Gérer les deux structures possibles (participant ou Participant)
          const participantData = p.participant || p.Participant || {};
          return {
            first_name: participantData.first_name,
            last_name: participantData.last_name,
            license_number: participantData.license_number,
            club_name: participantData.club_name,
            seat_position: p.seat_position,
            is_coxswain: p.is_coxswain,
          };
        });

      await api.put(`/crews/${crewId}/seats`, {
        seats: existing,
        new: created,
      });

      toast({
        title: "Succès",
        description: "Modifications enregistrées avec succès",
      });
    } catch (err: any) {
      console.error("Erreur enregistrement:", err);
      const errorMessage = 
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Erreur lors de l'enregistrement";
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de l'équipage...</p>
        </div>
      </div>
    );
  }

  if (error || !crew) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive font-semibold text-lg mb-4">
            {error || "Équipage introuvable"}
          </p>
          {eventId && (
            <Button
              variant="outline"
              onClick={() => navigate(`/event/${eventId}/crews`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la liste
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white p-6 shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => eventId && navigate(`/event/${eventId}/crews`)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-3xl font-bold">
                  {crew.category?.code || crew.category?.label || 'Équipage'}
                </h1>
              </div>
              <p className="text-blue-100 text-lg">{crew.club_name}</p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30">
                <Users className="w-5 h-5" />
                <span className="font-semibold">{participants.length} participant{participants.length > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Informations de l'événement */}
          {crew.Event && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-sm text-blue-100">{crew.Event.name}</p>
              <p className="text-xs text-blue-200 mt-1">
                {dayjs(crew.Event.start_date).format("DD MMMM YYYY")} - {crew.Event.location}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Informations de l'équipage */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Club
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{crew.club_name}</p>
            <p className="text-sm text-muted-foreground mt-1">Code: {crew.club_code}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="w-4 h-4" />
              Catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{crew.category?.label || 'N/A'}</p>
            {crew.category?.code && (
              <p className="text-sm text-muted-foreground mt-1">Code: {crew.category.code}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Composition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {crew.category?.boat_seats || participants.length} place{crew.category?.boat_seats !== 1 ? 's' : ''}
            </p>
            {crew.category?.has_coxswain && (
              <p className="text-sm text-muted-foreground mt-1">Avec barreur</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Participants
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              Glissez-déposez pour réorganiser
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucun participant pour le moment</p>
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={participants.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {participants.map((p) => (
                    <SortableRow key={p.id} participant={p} onRemove={handleRemove} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Formulaire d'ajout */}
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Ajouter un participant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Prénom *</Label>
              <Input
                id="first_name"
                placeholder="Prénom"
                value={newParticipant.first_name}
                onChange={(e) => setNewParticipant((p) => ({ ...p, first_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nom *</Label>
              <Input
                id="last_name"
                placeholder="Nom"
                value={newParticipant.last_name}
                onChange={(e) => setNewParticipant((p) => ({ ...p, last_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_number">Licence</Label>
              <Input
                id="license_number"
                placeholder="Numéro de licence"
                value={newParticipant.license_number}
                onChange={(e) => setNewParticipant((p) => ({ ...p, license_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="club_name">Club</Label>
              <Input
                id="club_name"
                placeholder="Nom du club"
                value={newParticipant.club_name}
                onChange={(e) => setNewParticipant((p) => ({ ...p, club_name: e.target.value }))}
              />
            </div>
          </div>
          <Button
            onClick={handleAddParticipant}
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!newParticipant.first_name || !newParticipant.last_name}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter le participant
          </Button>
        </CardContent>
      </Card>

      {/* Bouton d'enregistrement */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => eventId && navigate(`/event/${eventId}/crews`)}
        >
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="min-w-[140px]">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
