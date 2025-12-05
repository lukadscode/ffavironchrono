import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Building2,
  Award,
  Users,
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  Edit,
  AlertTriangle,
  Mail,
  Hash,
  Calendar,
  Flag,
  Clock,
} from "lucide-react";
import { formatTempsPronostique } from "@/utils/formatTime";
import dayjs from "dayjs";

export default function ParticipantDetailsPage() {
  const { participantId, eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [participant, setParticipant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [crewRacesMap, setCrewRacesMap] = useState<Record<string, any[]>>({});
  const [loadingRaces, setLoadingRaces] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!participantId) {
        setError("ID de participant manquant");
        setLoading(false);
        return;
      }

      try {
        console.log("🔍 Récupération du participant:", participantId);
        const res = await api.get(`/participants/${participantId}`);
        console.log("✅ Réponse API participant:", res.data);
        
        let participantData = res.data.data || res.data;
        
        if (!participantData) {
          setError("Participant introuvable");
          setLoading(false);
          return;
        }

        // Enrichir les équipages avec leur eventId si nécessaire
        const crewParticipants = participantData.crew_participants ||
                                 participantData.CrewParticipants ||
                                 participantData.crewParticipants ||
                                 [];
        
        // Enrichir chaque équipage avec son eventId et Event si pas déjà présent
        const enrichedCrewParticipants = await Promise.all(
          crewParticipants.map(async (cp: any) => {
            const crew = cp.crew || cp.Crew;
            if (!crew) return cp;
            
            // Vérifier si eventId est déjà présent
            const existingEventId = crew.Event?.id || 
                                   crew.event_id || 
                                   crew.EventId || 
                                   crew.eventId;
            
            // Si eventId ou Event n'est pas présent, récupérer le crew complet
            if ((!existingEventId || !crew.Event) && crew.id) {
              try {
                const crewRes = await api.get(`/crews/${crew.id}`);
                const fullCrew = crewRes.data.data || crewRes.data;
                
                // Si l'événement n'est toujours pas présent, le récupérer
                let eventData = fullCrew.Event || crew.Event;
                const crewEventId = fullCrew.event_id || fullCrew.Event?.id || fullCrew.EventId || fullCrew.eventId || existingEventId;
                
                if (!eventData && crewEventId) {
                  try {
                    const eventRes = await api.get(`/events/${crewEventId}`);
                    eventData = eventRes.data.data || eventRes.data;
                  } catch (eventErr) {
                    console.warn(`⚠️ Impossible de récupérer l'événement ${crewEventId}`, eventErr);
                  }
                }
                
                return {
                  ...cp,
                  crew: {
                    ...crew,
                    ...fullCrew,
                    // S'assurer que eventId est accessible
                    event_id: crewEventId,
                    Event: eventData || fullCrew.Event || crew.Event,
                  }
                };
              } catch (err) {
                console.warn(`⚠️ Impossible de récupérer les données pour le crew ${crew.id}`, err);
                return cp;
              }
            }
            
            // Si l'événement n'est pas présent mais que l'eventId existe, récupérer l'événement
            if (!crew.Event && existingEventId) {
              try {
                const eventRes = await api.get(`/events/${existingEventId}`);
                const eventData = eventRes.data.data || eventRes.data;
                return {
                  ...cp,
                  crew: {
                    ...crew,
                    Event: eventData,
                  }
                };
              } catch (eventErr) {
                console.warn(`⚠️ Impossible de récupérer l'événement ${existingEventId}`, eventErr);
              }
            }
            
            return cp;
          })
        );
        
        participantData = {
          ...participantData,
          crew_participants: enrichedCrewParticipants,
          CrewParticipants: enrichedCrewParticipants,
          crewParticipants: enrichedCrewParticipants,
        };

        setParticipant(participantData);
        setError(null);
        
        // Charger les races pour les équipages de cet événement
        if (eventId) {
          await fetchCrewRaces(enrichedCrewParticipants, eventId);
        }
      } catch (err: any) {
        console.error("❌ Erreur chargement participant:", err);
        const errorMessage =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de charger le participant";
        
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
    fetchData();
  }, [participantId, toast, eventId]);

  // Fonction pour récupérer les races de chaque équipage
  const fetchCrewRaces = async (crewParticipants: any[], eventId: string) => {
    if (!eventId) return;
    
    setLoadingRaces(true);
    try {
      // Récupérer toutes les races de l'événement
      const racesRes = await api.get(`/races/event/${eventId}`);
      const allRaces = racesRes.data.data || [];
      
      // Récupérer toutes les race-crews en une seule fois pour toutes les races
      const allRaceCrews = await Promise.all(
        allRaces.map(async (race: any) => {
          try {
            const raceCrewsRes = await api.get(`/race-crews/${race.id}`);
            return {
              raceId: race.id,
              race: race,
              crews: raceCrewsRes.data.data || [],
            };
          } catch (err) {
            console.warn(`⚠️ Erreur récupération race-crews pour race ${race.id}`, err);
            return {
              raceId: race.id,
              race: race,
              crews: [],
            };
          }
        })
      );
      
      // Créer un map crew_id -> races
      const crewRaces: Record<string, any[]> = {};
      
      // Pour chaque équipage, trouver ses races
      for (const cp of crewParticipants) {
        const crew = cp.crew || cp.Crew;
        if (!crew?.id) continue;
        
        const crewEventId = crew.Event?.id || 
                           crew.event_id || 
                           crew.EventId || 
                           crew.eventId;
        
        // Ne traiter que les équipages de cet événement
        if (String(crewEventId).trim() !== String(eventId).trim()) {
          continue;
        }
        
        // Trouver les races où cet équipage participe
        const racesForCrew = allRaceCrews
          .filter((rc: any) => rc.crews.some((rcc: any) => rcc.crew_id === crew.id))
          .map((rc: any) => rc.race);
        
        if (racesForCrew.length > 0) {
          crewRaces[crew.id] = racesForCrew;
        }
      }
      
      setCrewRacesMap(crewRaces);
    } catch (err) {
      console.error("❌ Erreur chargement races des équipages:", err);
    } finally {
      setLoadingRaces(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParticipant({ ...participant, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    if (!participantId) return;

    setIsSaving(true);
    try {
      await api.put(`/participants/${participantId}`, participant);
      setIsEditing(false);
      toast({
        title: "Succès",
        description: "Participant mis à jour avec succès",
      });
    } catch (err: any) {
      console.error("Erreur mise à jour:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Erreur lors de la mise à jour";
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!participantId) return;

    setIsDeleting(true);
    try {
      await api.delete(`/participants/${participantId}`);
      toast({
        title: "Succès",
        description: "Participant supprimé avec succès",
      });
      navigate(`/event/${eventId}/participants`);
    } catch (err: any) {
      console.error("Erreur suppression:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Erreur lors de la suppression";
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement du participant...</p>
        </div>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive font-semibold text-lg mb-4">
            {error || "Participant introuvable"}
          </p>
          {eventId && (
            <Button
              variant="outline"
              onClick={() => navigate(`/event/${eventId}/participants`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la liste
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Gérer les équipages - vérifier différentes structures possibles
  const crewParticipants = participant.crew_participants ||
                           participant.CrewParticipants ||
                           participant.crewParticipants ||
                           [];

  // Normaliser l'eventId pour la comparaison (string)
  const normalizedEventId = eventId ? String(eventId).trim() : null;

  // Fonction helper pour extraire l'eventId d'un équipage
  const getCrewEventId = (cp: any): string | null => {
    const crew = cp.crew || cp.Crew;
    if (!crew) return null;
    
    // Vérifier différentes façons dont l'eventId peut être stocké
    const crewEventId = crew.Event?.id || 
                        crew.event_id || 
                        crew.EventId || 
                        crew.eventId;
    
    return crewEventId ? String(crewEventId).trim() : null;
  };

  // Séparer les équipages par événement
  const currentEventCrews = crewParticipants.filter((cp: any) => {
    const crewEventId = getCrewEventId(cp);
    if (!normalizedEventId || !crewEventId) return false;
    
    const match = crewEventId === normalizedEventId;
    
    // Log pour debug (uniquement si pas de match suspect)
    if (!match && normalizedEventId) {
      console.log("🔍 Équipage non match:", {
        crewId: (cp.crew || cp.Crew)?.id,
        crewEventId,
        currentEventId: normalizedEventId,
        match
      });
    }
    
    return match;
  });

  const otherEventsCrews = crewParticipants.filter((cp: any) => {
    const crewEventId = getCrewEventId(cp);
    if (!normalizedEventId) return crewEventId !== null; // Si pas d'eventId courant, tous les autres
    if (!crewEventId) return false; // Ignorer ceux sans eventId
    
    return crewEventId !== normalizedEventId;
  });
  
  console.log("📊 Résultat filtrage:", {
    total: crewParticipants.length,
    currentEvent: currentEventCrews.length,
    otherEvents: otherEventsCrews.length,
    eventId: normalizedEventId
  });

  return (
    <div className="space-y-6">
      {/* Header avec gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 text-white p-6 shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => eventId && navigate(`/event/${eventId}/participants`)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-3xl font-bold">
                  {participant.last_name} {participant.first_name}
                </h1>
              </div>
              {participant.license_number && (
                <p className="text-purple-100 text-lg">Licence: {participant.license_number}</p>
              )}
            </div>
            <div className="text-right">
              {participant.gender && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30">
                  <User className="w-5 h-5" />
                  <span className="font-semibold">{participant.gender}</span>
                </div>
              )}
            </div>
          </div>

          {currentEventCrews.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 text-purple-100">
                <Users className="w-4 h-4" />
                <span className="text-sm">
                  {currentEventCrews.length} équipage{currentEventCrews.length > 1 ? 's' : ''} dans cet événement
                  {otherEventsCrews.length > 0 && ` • ${otherEventsCrews.length} dans d'autres événements`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Informations du participant */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informations personnelles
            </CardTitle>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={participant.last_name || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={participant.first_name || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license_number">Numéro de licence</Label>
                  <Input
                    id="license_number"
                    name="license_number"
                    value={participant.license_number || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Sexe</Label>
                  <Input
                    id="gender"
                    name="gender"
                    value={participant.gender || ""}
                    onChange={handleChange}
                    placeholder="Homme, Femme, etc."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="club_name">Club</Label>
                  <Input
                    id="club_name"
                    name="club_name"
                    value={participant.club_name || ""}
                    onChange={handleChange}
                  />
                </div>
                {participant.email && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={participant.email || ""}
                      onChange={handleChange}
                      disabled
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Annuler
                </Button>
                <Button onClick={handleUpdate} disabled={isSaving}>
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
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nom complet
                </Label>
                <p className="text-lg font-semibold">
                  {participant.last_name} {participant.first_name}
                </p>
              </div>
              {participant.license_number && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Numéro de licence
                  </Label>
                  <p className="text-lg font-mono font-semibold">{participant.license_number}</p>
                </div>
              )}
              {participant.gender && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Sexe
                  </Label>
                  <p className="text-lg font-semibold">{participant.gender}</p>
                </div>
              )}
              {participant.club_name && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Club
                  </Label>
                  <p className="text-lg font-semibold">{participant.club_name}</p>
                </div>
              )}
              {participant.email && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <p className="text-lg">{participant.email}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Équipages dans cet événement */}
      {currentEventCrews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Équipages dans cet événement ({currentEventCrews.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {currentEventCrews.map((cp: any) => {
                const crew = cp.crew || cp.Crew;
                const category = crew?.category;
                const event = crew?.Event;
                
                return (
                  <Card
                    key={cp.id}
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-500"
                    onClick={() => navigate(`/event/${eventId}/crews/${crew?.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-600" />
                            {crew?.club_name || "Club inconnu"}
                          </h3>
                          {crew?.club_code && (
                            <p className="text-sm text-muted-foreground">Code: {crew.club_code}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {cp.seat_position || "—"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {category && (
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{category.label || category.code}</p>
                              {category.code && category.code !== category.label && (
                                <p className="text-xs text-muted-foreground">{category.code}</p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {cp.is_coxswain ? (
                              <span className="font-medium text-orange-600">Barreur / Cox</span>
                            ) : (
                              <span>Rameur - Place {cp.seat_position}</span>
                            )}
                          </span>
                        </div>

                        {event && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span className="line-clamp-1">{event.name}</span>
                          </div>
                        )}

                        {crew?.temps_pronostique && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Temps pronostique: <span className="font-semibold text-blue-700">{formatTempsPronostique(crew.temps_pronostique)}</span>
                            </span>
                          </div>
                        )}

                        {/* Séries/Races affectées */}
                        {crew?.id && crewRacesMap[crew.id] && crewRacesMap[crew.id].length > 0 && (
                          <div className="pt-2 mt-2 border-t">
                            <div className="flex items-center gap-2 text-sm">
                              <Flag className="w-4 h-4 text-blue-600" />
                              <div className="flex-1">
                                <p className="font-medium text-blue-700 mb-1">
                                  Série{crewRacesMap[crew.id].length > 1 ? 's' : ''} :
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {crewRacesMap[crew.id]
                                    .sort((a: any, b: any) => (a.race_number || 0) - (b.race_number || 0))
                                    .map((race: any) => (
                                      <span
                                        key={race.id}
                                        className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium"
                                      >
                                        Série {race.race_number || '?'}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Autres participations dans d'autres événements */}
      {otherEventsCrews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Autres participations ({otherEventsCrews.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {otherEventsCrews.map((cp: any) => {
                const crew = cp.crew || cp.Crew;
                const category = crew?.category;
                const event = crew?.Event;
                const otherEventId = event?.id;
                
                return (
                  <Card
                    key={cp.id}
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-500"
                    onClick={() => otherEventId && navigate(`/event/${otherEventId}/crews/${crew?.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-600" />
                            {crew?.club_name || "Club inconnu"}
                          </h3>
                          {crew?.club_code && (
                            <p className="text-sm text-muted-foreground">Code: {crew.club_code}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {cp.seat_position || "—"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {category && (
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{category.label || category.code}</p>
                              {category.code && category.code !== category.label && (
                                <p className="text-xs text-muted-foreground">{category.code}</p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {cp.is_coxswain ? (
                              <span className="font-medium text-orange-600">Barreur / Cox</span>
                            ) : (
                              <span>Rameur - Place {cp.seat_position}</span>
                            )}
                          </span>
                        </div>

                        {crew?.temps_pronostique && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Temps pronostique: <span className="font-semibold text-purple-700">{formatTempsPronostique(crew.temps_pronostique)}</span>
                            </span>
                          </div>
                        )}

                        {(event || otherEventId) && (
                          <div className="flex items-center gap-2 text-sm pt-2 mt-2 border-t border-purple-200">
                            <Calendar className="w-4 h-4 text-purple-600" />
                            <div className="flex-1">
                              <p className="text-xs text-purple-500 mb-1">Événement</p>
                              {event?.name ? (
                                <>
                                  <p className="font-medium text-purple-700 line-clamp-2">{event.name}</p>
                                  {event.location && (
                                    <p className="text-xs text-purple-600 mt-1">{event.location}</p>
                                  )}
                                </>
                              ) : (
                                <p className="font-medium text-purple-700 line-clamp-2 text-xs">
                                  ID: {otherEventId || crew?.event_id || crew?.EventId || crew?.eventId}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => eventId && navigate(`/event/${eventId}/participants`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Supprimer
        </Button>
      </div>

      {/* Modal de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="pt-4">
              <div className="space-y-3">
                <p className="font-semibold text-foreground">
                  Êtes-vous sûr de vouloir supprimer le participant{" "}
                  <span className="text-red-600">
                    {participant.last_name} {participant.first_name}
                  </span>
                  ?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    ⚠️ Cette action est irréversible. Le participant sera retiré de tous les équipages auxquels il est associé.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer définitivement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
