import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Users,
  X,
  ChevronRight,
  Building2,
  Award,
} from "lucide-react";
import { CrewStatus, CREW_STATUS_LABELS, NON_PARTICIPATING_STATUSES } from "@/constants/crewStatus";
import { CrewStatusBadge } from "@/components/crew/CrewStatusBadge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

type Crew = {
  id: string;
  club_name: string;
  club_code?: string;
  status: string;
  category?: {
    id: string;
    code: string;
    label: string;
  };
  crew_participants?: Array<{
    id: string;
    participant: {
      id: string;
      first_name: string;
      last_name: string;
      license_number?: string;
    };
    seat_position: number;
    is_coxswain: boolean;
  }>;
};

type StatusChangeType = 
  | "dns" 
  | "dnf" 
  | "disqualified" 
  | "withdrawn" 
  | "scratch" 
  | "changed";

export default function CrewStatusManagementPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Formulaire multi-étapes
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const [changeType, setChangeType] = useState<StatusChangeType | "">("");
  const [newParticipants, setNewParticipants] = useState<Array<{
    participantId: string;
    seat_position: number;
    is_coxswain: boolean;
  }>>([]);
  const [availableParticipants, setAvailableParticipants] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    fetchCrews();
    fetchAvailableParticipants();
  }, [eventId]);

  const fetchCrews = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await api.get(`/crews/event/${eventId}`);
      const crewsData = res.data.data || [];
      // Trier par statut (registered en premier) puis par club
      const sorted = crewsData.sort((a: Crew, b: Crew) => {
        if (a.status === CrewStatus.REGISTERED && b.status !== CrewStatus.REGISTERED) return -1;
        if (a.status !== CrewStatus.REGISTERED && b.status === CrewStatus.REGISTERED) return 1;
        return (a.club_name || "").localeCompare(b.club_name || "");
      });
      setCrews(sorted);
    } catch (err: any) {
      console.error("Erreur chargement équipages:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les équipages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableParticipants = async () => {
    if (!eventId) return;
    try {
      const res = await api.get(`/participants/event/${eventId}`);
      setAvailableParticipants(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement participants:", err);
    }
  };

  const filteredCrews = useMemo(() => {
    if (!searchQuery.trim()) return crews;
    const query = searchQuery.toLowerCase();
    return crews.filter((crew) => {
      const club = (crew.club_name || "").toLowerCase();
      const clubCode = (crew.club_code || "").toLowerCase();
      const categoryCode = (crew.category?.code || "").toLowerCase();
      return (
        club.includes(query) ||
        clubCode.includes(query) ||
        categoryCode.includes(query)
      );
    });
  }, [crews, searchQuery]);

  const handleSelectCrew = (crew: Crew) => {
    setSelectedCrew(crew);
    setChangeType("");
    setNewParticipants([]);
    setStep(2);
  };

  const handleBackToStep1 = () => {
    setSelectedCrew(null);
    setChangeType("");
    setNewParticipants([]);
    setStep(1);
  };

  const handleChangeTypeSelect = (type: StatusChangeType) => {
    setChangeType(type);
    if (type === "changed" && selectedCrew) {
      // Initialiser avec les participants actuels
      const currentParticipants = selectedCrew.crew_participants || [];
      setNewParticipants(
        currentParticipants.map((cp) => ({
          participantId: cp.participant.id,
          seat_position: cp.seat_position,
          is_coxswain: cp.is_coxswain,
        }))
      );
    } else {
      setNewParticipants([]);
    }
    setStep(3);
  };

  const handleParticipantChange = (
    index: number,
    participantId: string,
    seat_position: number,
    is_coxswain: boolean
  ) => {
    const updated = [...newParticipants];
    updated[index] = { participantId, seat_position, is_coxswain };
    setNewParticipants(updated);
  };

  const handleAddParticipantSlot = () => {
    setNewParticipants([
      ...newParticipants,
      { participantId: "", seat_position: newParticipants.length + 1, is_coxswain: false },
    ]);
  };

  const handleRemoveParticipantSlot = (index: number) => {
    const updated = newParticipants.filter((_, i) => i !== index);
    // Réajuster les positions
    const reordered = updated.map((p, i) => ({
      ...p,
      seat_position: i + 1,
    }));
    setNewParticipants(reordered);
  };

  const handleSubmit = async () => {
    if (!selectedCrew || !changeType || !eventId) return;

    setIsSubmitting(true);
    try {
      if (changeType === "changed") {
        // Duplication de l'équipage
        // 1. Créer un nouvel équipage avec status "changed" (ancien équipage)
        const oldCrewRes = await api.post("/crews", {
          event_id: eventId,
          category_id: selectedCrew.category?.id,
          status: CrewStatus.CHANGED,
          club_name: selectedCrew.club_name,
          club_code: selectedCrew.club_code,
        });
        const oldCrewId = oldCrewRes.data.data?.id || oldCrewRes.data.id;

        // 2. Copier les participants de l'ancien équipage vers le nouveau équipage "changed"
        const originalParticipants = selectedCrew.crew_participants || [];
        for (const cp of originalParticipants) {
          await api.post("/crew-participants", {
            crew_id: oldCrewId,
            participant_id: cp.participant.id,
            is_coxswain: cp.is_coxswain,
            seat_position: cp.seat_position,
          });
        }

        // 3. Mettre à jour l'équipage original avec les nouveaux participants et status "registered"
        await api.put(`/crews/${selectedCrew.id}`, {
          status: CrewStatus.REGISTERED,
        });

        // 4. Supprimer les anciens participants de l'équipage original
        for (const cp of originalParticipants) {
          try {
            await api.delete(`/crew-participants/${cp.id}`);
          } catch (err) {
            console.error(`Erreur suppression participant ${cp.id}:`, err);
          }
        }

        // 5. Ajouter les nouveaux participants à l'équipage original
        for (const np of newParticipants) {
          if (np.participantId) {
            await api.post("/crew-participants", {
              crew_id: selectedCrew.id,
              participant_id: np.participantId,
              is_coxswain: np.is_coxswain,
              seat_position: np.seat_position,
            });
          }
        }
      } else {
        // Changement de statut simple
        await api.put(`/crews/${selectedCrew.id}`, {
          status: changeType,
        });
      }

      toast({
        title: "Succès",
        description: `Le statut de l'équipage a été mis à jour avec succès.`,
      });

      // Recharger les données et revenir à l'étape 1
      await fetchCrews();
      handleBackToStep1();
    } catch (err: any) {
      console.error("Erreur mise à jour statut:", err);
      toast({
        title: "Erreur",
        description:
          err.response?.data?.message ||
          "Impossible de mettre à jour le statut de l'équipage",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/event/${eventId}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-3xl font-bold">Gestion des statuts d'équipages</h1>
          <p className="text-muted-foreground mt-2">
            Gérer les forfaits, abandons, disqualifications et changements d'équipages
          </p>
        </div>
      </div>

      {/* Étape 1: Sélection de l'équipage */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 1 : Sélectionner un équipage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Rechercher par club, code club ou catégorie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredCrews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun équipage trouvé
                </div>
              ) : (
                filteredCrews.map((crew) => (
                  <Card
                    key={crew.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleSelectCrew(crew)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                            <h3 className="font-semibold text-lg">
                              {crew.club_name}
                            </h3>
                            {crew.club_code && (
                              <span className="text-sm text-muted-foreground font-mono">
                                ({crew.club_code})
                              </span>
                            )}
                          </div>
                          {crew.category && (
                            <div className="flex items-center gap-2 mb-2">
                              <Award className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">
                                {crew.category.label} ({crew.category.code})
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {crew.crew_participants?.length || 0} participant
                              {(crew.crew_participants?.length || 0) > 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <CrewStatusBadge status={crew.status} />
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Étape 2: Sélection du type de changement */}
      {step === 2 && selectedCrew && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 2 : Choisir le type de modification</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Équipage sélectionné : <strong>{selectedCrew.club_name}</strong>
              {selectedCrew.category && ` - ${selectedCrew.category.label}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Button
                variant={changeType === "dns" ? "default" : "outline"}
                className="justify-start h-auto py-4"
                onClick={() => handleChangeTypeSelect("dns")}
              >
                <div className="flex-1 text-left">
                  <div className="font-semibold">DNS - Did Not Start</div>
                  <div className="text-sm text-muted-foreground">
                    L'équipage n'a pas pris le départ
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Button
                variant={changeType === "dnf" ? "default" : "outline"}
                className="justify-start h-auto py-4"
                onClick={() => handleChangeTypeSelect("dnf")}
              >
                <div className="flex-1 text-left">
                  <div className="font-semibold">DNF - Did Not Finish</div>
                  <div className="text-sm text-muted-foreground">
                    L'équipage a abandonné en cours de course
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Button
                variant={changeType === "disqualified" ? "default" : "outline"}
                className="justify-start h-auto py-4"
                onClick={() => handleChangeTypeSelect("disqualified")}
              >
                <div className="flex-1 text-left">
                  <div className="font-semibold">Disqualifié</div>
                  <div className="text-sm text-muted-foreground">
                    L'équipage a été disqualifié
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Button
                variant={changeType === "withdrawn" ? "default" : "outline"}
                className="justify-start h-auto py-4"
                onClick={() => handleChangeTypeSelect("withdrawn")}
              >
                <div className="flex-1 text-left">
                  <div className="font-semibold">Retiré</div>
                  <div className="text-sm text-muted-foreground">
                    L'équipage a été retiré de la compétition
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Button
                variant={changeType === "scratch" ? "default" : "outline"}
                className="justify-start h-auto py-4"
                onClick={() => handleChangeTypeSelect("scratch")}
              >
                <div className="flex-1 text-left">
                  <div className="font-semibold">Scratch</div>
                  <div className="text-sm text-muted-foreground">
                    L'équipage a été retiré avant le départ
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Button
                variant={changeType === "changed" ? "default" : "outline"}
                className="justify-start h-auto py-4"
                onClick={() => handleChangeTypeSelect("changed")}
              >
                <div className="flex-1 text-left">
                  <div className="font-semibold">Changement de participants</div>
                  <div className="text-sm text-muted-foreground">
                    Remplacer un ou plusieurs participants de l'équipage
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleBackToStep1}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Étape 3: Confirmation / Configuration */}
      {step === 3 && selectedCrew && changeType && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 3 : Confirmation</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Équipage : <strong>{selectedCrew.club_name}</strong>
              {selectedCrew.category && ` - ${selectedCrew.category.label}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {changeType === "changed" ? (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Changement de participants</AlertTitle>
                  <AlertDescription>
                    L'équipage actuel sera dupliqué avec le statut "changed" et un nouvel équipage
                    "registered" sera créé avec les nouveaux participants.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Nouveaux participants
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddParticipantSlot}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Ajouter un participant
                    </Button>
                  </div>

                  {newParticipants.map((np, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 space-y-3">
                            <div>
                              <Label>Participant</Label>
                              <Select
                                value={np.participantId}
                                onValueChange={(value) =>
                                  handleParticipantChange(
                                    index,
                                    value,
                                    np.seat_position,
                                    np.is_coxswain
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner un participant" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableParticipants.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.first_name} {p.last_name}
                                      {p.license_number && ` (${p.license_number})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`coxswain-${index}`}
                                  checked={np.is_coxswain}
                                  onChange={(e) =>
                                    handleParticipantChange(
                                      index,
                                      np.participantId,
                                      np.seat_position,
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4"
                                />
                                <Label htmlFor={`coxswain-${index}`}>
                                  Barreur
                                </Label>
                              </div>
                            </div>
                          </div>

                          {newParticipants.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveParticipantSlot(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {newParticipants.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      Aucun participant sélectionné. Cliquez sur "Ajouter un participant" pour
                      commencer.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Confirmation</AlertTitle>
                <AlertDescription>
                  Vous êtes sur le point de changer le statut de l'équipage{" "}
                  <strong>{selectedCrew.club_name}</strong> en{" "}
                  <strong>{CREW_STATUS_LABELS[changeType as CrewStatus]}</strong>.
                  {NON_PARTICIPATING_STATUSES.includes(changeType as CrewStatus) && (
                    <div className="mt-2 font-semibold">
                      Cet équipage ne sera plus pris en compte dans les courses et résultats.
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  (changeType === "changed" &&
                    (newParticipants.length === 0 ||
                      newParticipants.some((np) => !np.participantId)))
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirmer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

