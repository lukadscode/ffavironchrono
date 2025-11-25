import { useEffect, useState, useMemo } from "react";
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
import { Trash2, Plus, User, Search, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [existingParticipants, setExistingParticipants] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showIntranetSearch, setShowIntranetSearch] = useState(false);
  const [intranetLicenseNumber, setIntranetLicenseNumber] = useState("");
  const [loadingIntranetSearch, setLoadingIntranetSearch] = useState(false);
  const [showNewParticipantForm, setShowNewParticipantForm] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    first_name: "",
    last_name: "",
    license_number: "",
    club_name: "",
    gender: "",
    email: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);

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
    if (eventId) {
      fetchParticipants();
    }
  }, [crewId, eventId, toast]);

  const fetchParticipants = async () => {
    if (!eventId) return;
    try {
      const res = await api.get(`/participants/event/${eventId}`);
      const participantsData = res.data.data ?? [];
      setExistingParticipants(participantsData);
    } catch (err) {
      console.error("Erreur chargement participants:", err);
    }
  };

  // Calculer les places disponibles
  const maxSeats = crew?.category?.boat_seats || 0;
  const hasCoxswain = crew?.category?.has_coxswain || false;
  const requiredParticipants = maxSeats + (hasCoxswain ? 1 : 0);
  const currentParticipantsCount = participants.length;
  const canAddParticipant = crew && maxSeats > 0 && currentParticipantsCount < requiredParticipants;

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !crewId) return;

    const oldIndex = participants.findIndex((p) => p.id === active.id);
    const newIndex = participants.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(participants, oldIndex, newIndex).map((p, index) => ({
      ...p,
      seat_position: index + 1,
    }));
    
    // Mettre à jour l'état local immédiatement pour un feedback visuel
    setParticipants(reordered);
    
    // Enregistrer automatiquement via l'API
    try {
      const seats = reordered.map((p) => ({
        id: p.id,
        seat_position: p.seat_position,
        is_coxswain: p.is_coxswain || false,
      }));

      await api.put(`/crews/${crewId}/seats`, {
        seats,
      });

      // Recharger pour s'assurer que tout est à jour
      const res = await api.get(`/crews/${crewId}`);
      const crewData = res.data.data || res.data;
      const crewParticipants = crewData.crew_participants || 
                               crewData.CrewParticipants || 
                               crewData.crewParticipants || 
                               [];
      
      const sortedParticipants = [...crewParticipants].sort(
        (a: any, b: any) => (a.seat_position || 0) - (b.seat_position || 0)
      );
      
      setParticipants(sortedParticipants);
    } catch (err: any) {
      console.error("Erreur enregistrement ordre:", err);
      // En cas d'erreur, restaurer l'ordre précédent
      setParticipants(participants);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible d'enregistrer l'ordre",
        variant: "destructive",
      });
    }
  };

  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return existingParticipants.filter((p) => {
      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
      const license = (p.license_number || "").toLowerCase();
      const club = (p.club_name || "").toLowerCase();
      return fullName.includes(query) || license.includes(query) || club.includes(query);
    });
  }, [existingParticipants, searchQuery]);

  const handleSearchIntranet = async () => {
    if (!intranetLicenseNumber.trim()) return;
    setLoadingIntranetSearch(true);
    try {
      const res = await api.get(`/participants/intranet/${intranetLicenseNumber.trim()}`);
      const participantData = res.data.data || res.data;
      if (participantData) {
        handleAddExistingParticipant(participantData);
        setIntranetLicenseNumber("");
        setShowIntranetSearch(false);
      } else {
        toast({
          title: "Participant introuvable",
          description: "Aucun participant trouvé avec ce numéro de licence",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de rechercher sur l'intranet",
        variant: "destructive",
      });
    } finally {
      setLoadingIntranetSearch(false);
    }
  };

  const handleAddExistingParticipant = async (participant: any) => {
    if (!canAddParticipant || !crewId) {
      toast({
        title: "Limite atteinte",
        description: `L'équipage est complet (${requiredParticipants} participants maximum)`,
        variant: "destructive",
      });
      return;
    }
    
    const seat_position = participants.length + 1;
    
    try {
      // Enregistrer immédiatement via l'API
      await api.post(`/crews/${crewId}/seats`, {
        participant_id: participant.id,
        seat_position,
        is_coxswain: false,
      });

      // Recharger les données pour avoir la structure complète
      const res = await api.get(`/crews/${crewId}`);
      const crewData = res.data.data || res.data;
      const crewParticipants = crewData.crew_participants || 
                               crewData.CrewParticipants || 
                               crewData.crewParticipants || 
                               [];
      
      const sortedParticipants = [...crewParticipants].sort(
        (a: any, b: any) => (a.seat_position || 0) - (b.seat_position || 0)
      );
      
      setParticipants(sortedParticipants);
      setSearchQuery("");
      setShowIntranetSearch(false);
      setIntranetLicenseNumber("");
      
      toast({
        title: "Participant ajouté",
        description: "Le participant a été ajouté avec succès",
      });
    } catch (err: any) {
      console.error("Erreur ajout participant:", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible d'ajouter le participant",
        variant: "destructive",
      });
    }
  };

  const handleAddNewParticipant = async () => {
    if (!canAddParticipant || !crewId) {
      toast({
        title: "Limite atteinte",
        description: `L'équipage est complet (${requiredParticipants} participants maximum)`,
        variant: "destructive",
      });
      return;
    }
    if (!newParticipant.first_name || !newParticipant.last_name) {
      toast({
        title: "Erreur",
        description: "Le prénom et le nom sont requis",
        variant: "destructive",
      });
      return;
    }
    
    const seat_position = participants.length + 1;
    
    try {
      setIsAddingParticipant(true);
      
      // Enregistrer immédiatement via l'API avec création du participant
      await api.post(`/crews/${crewId}/seats`, {
        new_participant: {
          first_name: newParticipant.first_name,
          last_name: newParticipant.last_name,
          license_number: newParticipant.license_number || undefined,
          club_name: newParticipant.club_name || undefined,
          gender: newParticipant.gender || undefined,
          email: newParticipant.email || undefined,
        },
        seat_position,
        is_coxswain: false,
      });

      // Recharger les données pour avoir la structure complète
      const res = await api.get(`/crews/${crewId}`);
      const crewData = res.data.data || res.data;
      const crewParticipants = crewData.crew_participants || 
                               crewData.CrewParticipants || 
                               crewData.crewParticipants || 
                               [];
      
      const sortedParticipants = [...crewParticipants].sort(
        (a: any, b: any) => (a.seat_position || 0) - (b.seat_position || 0)
      );
      
      setParticipants(sortedParticipants);
      setNewParticipant({
        first_name: "",
        last_name: "",
        license_number: "",
        club_name: "",
        gender: "",
        email: "",
      });
      setShowNewParticipantForm(false);
      
      toast({
        title: "Participant ajouté",
        description: "Le participant a été créé et ajouté avec succès",
      });
    } catch (err: any) {
      console.error("Erreur ajout participant:", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible d'ajouter le participant",
        variant: "destructive",
      });
    } finally {
      setIsAddingParticipant(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!crewId) return;
    
    try {
      // Supprimer immédiatement via l'API
      await api.delete(`/crews/${crewId}/seats/${id}`);
      
      // Recharger les données pour avoir la structure complète
      const res = await api.get(`/crews/${crewId}`);
      const crewData = res.data.data || res.data;
      const crewParticipants = crewData.crew_participants || 
                               crewData.CrewParticipants || 
                               crewData.crewParticipants || 
                               [];
      
      const sortedParticipants = [...crewParticipants].sort(
        (a: any, b: any) => (a.seat_position || 0) - (b.seat_position || 0)
      );
      
      setParticipants(sortedParticipants);
      
      toast({
        title: "Participant supprimé",
        description: "Le participant a été retiré de l'équipage",
      });
    } catch (err: any) {
      console.error("Erreur suppression participant:", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de supprimer le participant",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!crewId) return;

    setIsSaving(true);
    try {
      // Sauvegarder uniquement les changements de position (drag & drop)
      const seats = participants.map((p) => ({
        id: p.id,
        seat_position: p.seat_position,
        is_coxswain: p.is_coxswain || false,
      }));

      await api.put(`/crews/${crewId}/seats`, {
        seats,
      });

      toast({
        title: "Succès",
        description: "Ordre des participants enregistré avec succès",
      });
      
      // Recharger pour s'assurer que tout est à jour
      const res = await api.get(`/crews/${crewId}`);
      const crewData = res.data.data || res.data;
      const crewParticipants = crewData.crew_participants || 
                               crewData.CrewParticipants || 
                               crewData.crewParticipants || 
                               [];
      
      const sortedParticipants = [...crewParticipants].sort(
        (a: any, b: any) => (a.seat_position || 0) - (b.seat_position || 0)
      );
      
      setParticipants(sortedParticipants);
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header avec gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white p-4 sm:p-6 shadow-lg">
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
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">
                  {crew.category?.code || crew.category?.label || 'Équipage'}
                </h1>
              </div>
              <p className="text-blue-100 text-sm sm:text-base md:text-lg break-words">{crew.club_name}</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Formulaire d'ajout - Affiché seulement si nécessaire */}
      {canAddParticipant && (
        <div className="space-y-4">
          {/* Badge de progression */}
          {crew?.category && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-blue-900">
                    Participants requis pour cette catégorie
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-lg font-bold ${
                        currentParticipantsCount === requiredParticipants
                          ? "text-green-600"
                          : "text-blue-600"
                      }`}
                    >
                      {currentParticipantsCount}/{requiredParticipants}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-blue-800">
                  <p>
                    • <strong>{maxSeats}</strong> participant{maxSeats > 1 ? "s" : ""} rameur{maxSeats > 1 ? "s" : ""}
                  </p>
                  {hasCoxswain && (
                    <p>
                      • <strong>1</strong> barreur
                    </p>
                  )}
                </div>
                {currentParticipantsCount < requiredParticipants && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-sm text-blue-700">
                      ⚠️ Il reste{" "}
                      <strong>{requiredParticipants - currentParticipantsCount}</strong> participant
                      {requiredParticipants - currentParticipantsCount > 1 ? "s" : ""} à ajouter
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recherche de participants existants */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="w-4 h-4" />
                Rechercher un participant existant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Rechercher par nom, licence ou club..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowIntranetSearch(false);
                  }}
                  className="pl-10"
                />
              </div>
              
              {searchQuery && filteredParticipants.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {filteredParticipants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => handleAddExistingParticipant(p)}
                    >
                      <div>
                        <p className="font-semibold">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {p.license_number && `Licence: ${p.license_number} • `}
                          {p.club_name}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Ajouter
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && filteredParticipants.length === 0 && !showIntranetSearch && (
                <div className="text-center py-6 space-y-4">
                  <div className="text-muted-foreground">
                    <p className="font-medium mb-2">Aucun résultat trouvé</p>
                    <p className="text-sm">Essayez une autre recherche ou :</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowIntranetSearch(true);
                        setSearchQuery("");
                      }}
                      className="flex items-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Rechercher sur l'intranet
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => {
                        setShowNewParticipantForm(true);
                        setSearchQuery("");
                      }}
                      className="flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Créer un nouveau participant
                    </Button>
                  </div>
                </div>
              )}

              {showIntranetSearch && (
                <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Recherche sur l'intranet</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowIntranetSearch(false);
                        setIntranetLicenseNumber("");
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="intranet_license">Numéro de licence *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="intranet_license"
                        placeholder="Ex: 123456"
                        value={intranetLicenseNumber}
                        onChange={(e) => setIntranetLicenseNumber(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearchIntranet()}
                      />
                      <Button
                        onClick={handleSearchIntranet}
                        disabled={loadingIntranetSearch || !intranetLicenseNumber.trim()}
                      >
                        {loadingIntranetSearch ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recherche le participant sur l'intranet avec son numéro de licence
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Créer un nouveau participant */}
          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Créer un nouveau participant
                </CardTitle>
                {!showNewParticipantForm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewParticipantForm(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Afficher le formulaire
                  </Button>
                )}
              </div>
            </CardHeader>
            {showNewParticipantForm && (
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Prénom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={newParticipant.first_name}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, first_name: e.target.value })
                      }
                      placeholder="Prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Nom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={newParticipant.last_name}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, last_name: e.target.value })
                      }
                      placeholder="Nom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Numéro de licence</Label>
                    <Input
                      value={newParticipant.license_number}
                      onChange={(e) =>
                        setNewParticipant({
                          ...newParticipant,
                          license_number: e.target.value,
                        })
                      }
                      placeholder="Licence"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Club</Label>
                    <Input
                      value={newParticipant.club_name}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, club_name: e.target.value })
                      }
                      placeholder="Club"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Genre</Label>
                    <Select
                      value={newParticipant.gender}
                      onValueChange={(value) =>
                        setNewParticipant({ ...newParticipant, gender: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le genre" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Homme">Homme</SelectItem>
                        <SelectItem value="Femme">Femme</SelectItem>
                        <SelectItem value="Mixte">Mixte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newParticipant.email}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, email: e.target.value })
                      }
                      placeholder="user@example.com"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewParticipantForm(false);
                      setNewParticipant({
                        first_name: "",
                        last_name: "",
                        license_number: "",
                        club_name: "",
                        gender: "",
                        email: "",
                      });
                    }}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleAddNewParticipant}
                    disabled={!newParticipant.first_name || !newParticipant.last_name || isAddingParticipant}
                    className="flex-1"
                  >
                    {isAddingParticipant ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ajout...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Ajouter le participant
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Bouton retour */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => eventId && navigate(`/event/${eventId}/crews`)}
        >
          Retour
        </Button>
      </div>
    </div>
  );
}
