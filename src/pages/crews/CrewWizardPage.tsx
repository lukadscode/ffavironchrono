import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronRight,
  ChevronLeft,
  Ship,
  Users,
  Link2,
  Loader2,
  Building2,
  Award,
  UserPlus,
  Search,
  CheckCircle2,
} from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, GripVertical } from "lucide-react";

type Category = {
  id: string;
  code: string;
  label: string;
  boat_seats: number;
  has_coxswain: boolean;
};

type Participant = {
  id?: string;
  first_name: string;
  last_name: string;
  license_number?: string;
  club_name?: string;
  gender?: string;
  email?: string;
};

type CrewParticipant = {
  id: string;
  participant: Participant;
  seat_position: number;
  is_coxswain: boolean;
  isNew?: boolean;
  participantId?: string; // ID du participant existant
};

interface Club {
  nom: string;
  nom_court: string;
  code: string;
  etat: string;
  type: string;
  logo: string | null;
  logo_url: string | null;
  code_region: string | null;
  nom_region: string | null;
  code_departement: string | null;
  nom_departement: string | null;
}

const STEPS = [
  { id: 1, title: "Informations équipage", icon: Ship },
  { id: 2, title: "Participants", icon: Users },
  { id: 3, title: "Liaison", icon: Link2 },
];

export default function CrewWizardPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingParticipants, setExistingParticipants] = useState<Participant[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [clubSearchQuery, setClubSearchQuery] = useState<string>("");
  const [isClubSelectOpen, setIsClubSelectOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showIntranetSearch, setShowIntranetSearch] = useState(false);
  const [intranetLicenseNumber, setIntranetLicenseNumber] = useState("");
  const [loadingIntranetSearch, setLoadingIntranetSearch] = useState(false);
  const [showNewParticipantForm, setShowNewParticipantForm] = useState(false);

  // Étape 1: Informations équipage
  const [crewData, setCrewData] = useState({
    club_name: "",
    club_code: "",
    category_id: "",
    coach_name: "",
  });

  // Étape 2: Participants
  const [participants, setParticipants] = useState<CrewParticipant[]>([]);
  const [newParticipant, setNewParticipant] = useState({
    first_name: "",
    last_name: "",
    license_number: "",
    club_name: "",
    gender: "",
    email: "",
  });

  useEffect(() => {
    if (eventId) {
      fetchCategories();
      fetchParticipants();
      fetchClubs();
    }
  }, [eventId]);

  const fetchClubs = async () => {
    setLoadingClubs(true);
    try {
      const res = await api.get("/clubs");
      const clubsData = res.data.data || [];
      // Trier les clubs par nom
      const sortedClubs = clubsData.sort((a: Club, b: Club) => 
        a.nom.localeCompare(b.nom)
      );
      setClubs(sortedClubs);
    } catch (err: any) {
      console.error("Erreur chargement clubs:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger la liste des clubs. Vous pouvez saisir manuellement.",
        variant: "destructive",
      });
    } finally {
      setLoadingClubs(false);
    }
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/event-categories/${eventId}`);
      const eventCategoriesData = res.data.data || res.data || [];
      
      console.log("📋 Données récupérées:", eventCategoriesData);
      
      // Extraire les catégories depuis la structure event-categories
      const formattedCategories = eventCategoriesData
        .map((eventCat: any) => {
          const category = eventCat.Category || eventCat.category;
          if (!category) return null;
          
          return {
            id: category.id,
            code: category.code || "",
            label: category.label || category.name || "",
            boat_seats: category.boat_seats || 0,
            has_coxswain: category.has_coxswain || false,
            age_group: category.age_group || "",
            gender: category.gender || "",
          };
        })
        .filter((cat: any) => cat !== null); // Filtrer les valeurs null
      
      console.log("📋 Catégories formatées:", formattedCategories);
      
      setCategories(formattedCategories);
      
      if (formattedCategories.length === 0) {
        toast({
          title: "Aucune catégorie",
          description: "Aucune catégorie disponible pour cet événement. Veuillez créer des catégories d'abord.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Erreur chargement catégories:", err);
      console.error("Détails:", err.response?.data);
      toast({
        title: "Erreur",
        description: `Impossible de charger les catégories: ${err.response?.data?.message || err.message || "Erreur inconnue"}`,
        variant: "destructive",
      });
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const res = await api.get(`/participants/event/${eventId}`);
      setExistingParticipants(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement participants:", err);
    }
  };

  const selectedCategory = categories.find((c) => c.id === crewData.category_id);
  const maxSeats = selectedCategory?.boat_seats || 0;
  const hasCoxswain = selectedCategory?.has_coxswain || false;
  const requiredParticipants = maxSeats + (hasCoxswain ? 1 : 0);

  const filteredParticipants = existingParticipants.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.first_name?.toLowerCase().includes(query) ||
      p.last_name?.toLowerCase().includes(query) ||
      p.license_number?.toLowerCase().includes(query) ||
      p.club_name?.toLowerCase().includes(query)
    );
  });

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return (
          crewData.club_name &&
          crewData.club_code &&
          crewData.category_id
        );
      case 2:
        // Vérifier que le nombre exact de participants requis est atteint
        if (selectedCategory) {
          const coxswainCount = participants.filter((p) => p.is_coxswain).length;
          const nonCoxswainCount = participants.filter((p) => !p.is_coxswain).length;
          
          if (hasCoxswain) {
            // Il faut exactement maxSeats participants + 1 barreur
            return nonCoxswainCount === maxSeats && coxswainCount === 1;
          } else {
            // Il faut exactement maxSeats participants
            return nonCoxswainCount === maxSeats && coxswainCount === 0;
          }
        }
        return false;
      case 3:
        return participants.length <= maxSeats + (hasCoxswain ? 1 : 0);
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canGoNext()) {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      } else {
        handleFinish();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddNewParticipant = () => {
    if (!newParticipant.first_name || !newParticipant.last_name) {
      toast({
        title: "Erreur",
        description: "Le prénom et le nom sont requis",
        variant: "destructive",
      });
      return;
    }

    const seatPosition = participants.length + 1;
    const newP: CrewParticipant = {
      id: crypto.randomUUID(),
      participant: { 
        ...newParticipant,
        id: crypto.randomUUID() // Ajouter un id temporaire pour le nouveau participant
      },
      seat_position: seatPosition,
      is_coxswain: false,
      isNew: true,
    };

    setParticipants([...participants, newP]);
    setNewParticipant({
      first_name: "",
      last_name: "",
      license_number: "",
      club_name: "",
      gender: "",
      email: "",
    });
  };

  const handleAddExistingParticipant = (participant: Participant) => {
    const seatPosition = participants.length + 1;
    const newP: CrewParticipant = {
      id: crypto.randomUUID(),
      participant,
      seat_position: seatPosition,
      is_coxswain: false,
      participantId: participant.id,
    };

    setParticipants([...participants, newP]);
    setSearchQuery("");
    setShowIntranetSearch(false);
    setIntranetLicenseNumber("");
  };

  const handleSearchIntranet = async () => {
    if (!intranetLicenseNumber.trim()) {
      toast({
        title: "Numéro de licence requis",
        description: "Veuillez saisir un numéro de licence",
        variant: "destructive",
      });
      return;
    }

    setLoadingIntranetSearch(true);
    try {
      // Rechercher sur l'intranet avec le numéro de licence
      const res = await api.get(`/participants/licencie/${intranetLicenseNumber.trim()}`);
      
      const participantData = res.data.data || res.data;
      
      if (participantData) {
        const typeLibelle = participantData.type_libelle || "";
        const prenom = participantData.prenom || "";
        const nom = participantData.nom || "";
        const numeroLicence = participantData.numero_licence || intranetLicenseNumber.trim();
        
        // Vérifier le type de licence
        if (typeLibelle.toLowerCase().includes("loisir")) {
          // Licence loisir : afficher une erreur
          toast({
            title: "Licence loisir",
            description: `${prenom} ${nom} (${numeroLicence}) a une licence loisir et ne peut pas participer à une compétition.`,
            variant: "destructive",
          });
          setIntranetLicenseNumber("");
          setLoadingIntranetSearch(false);
          return;
        }
        
        if (typeLibelle.toLowerCase().includes("compétition") || typeLibelle.toLowerCase().includes("competition")) {
          // Licence compétition : ajouter directement le participant
          // Convertir le genre de l'intranet (M/F) vers le format attendu (Homme/Femme)
          let normalizedGender = "";
          if (participantData.genre) {
            const genre = participantData.genre.trim().toUpperCase();
            if (genre === "M" || genre === "HOMME") {
              normalizedGender = "Homme";
            } else if (genre === "F" || genre === "FEMME") {
              normalizedGender = "Femme";
            } else {
              normalizedGender = participantData.genre;
            }
          }
          
          const newParticipantData: Participant = {
            id: "", // Sera créé par le backend
            first_name: prenom,
            last_name: nom,
            license_number: numeroLicence,
            club_name: participantData.club_nom_court || participantData.club_code || "",
            gender: normalizedGender,
          };
          
          // Créer un CrewParticipant temporaire
          const seatPosition = participants.length + 1;
          const newP: CrewParticipant = {
            id: crypto.randomUUID(),
            participant: newParticipantData,
            seat_position: seatPosition,
            is_coxswain: false,
            isNew: true, // Marquer comme nouveau pour qu'il soit créé lors de la finalisation
          };
          
          setParticipants([...participants, newP]);
          setShowIntranetSearch(false);
          setIntranetLicenseNumber("");
          toast({
            title: "Participant ajouté",
            description: `${prenom} ${nom} a été ajouté directement depuis l'intranet.`,
          });
        } else {
          // Type de licence non spécifié ou autre : pré-remplir le formulaire
          // Convertir le genre de l'intranet (M/F) vers le format attendu (Homme/Femme)
          let normalizedGender = "";
          if (participantData.genre) {
            const genre = participantData.genre.trim().toUpperCase();
            if (genre === "M" || genre === "HOMME") {
              normalizedGender = "Homme";
            } else if (genre === "F" || genre === "FEMME") {
              normalizedGender = "Femme";
            } else {
              normalizedGender = participantData.genre;
            }
          }
          
          setNewParticipant({
            first_name: prenom,
            last_name: nom,
            license_number: numeroLicence,
            club_name: participantData.club_nom_court || participantData.club_code || "",
            gender: normalizedGender,
            email: participantData.mail || "",
          });
          setShowIntranetSearch(false);
          setShowNewParticipantForm(true);
          setIntranetLicenseNumber("");
          toast({
            title: "Participant trouvé",
            description: "Les informations ont été pré-remplies depuis l'intranet. Veuillez vérifier et compléter si nécessaire.",
          });
        }
      } else {
        toast({
          title: "Aucun résultat",
          description: "Aucun participant trouvé avec ce numéro de licence sur l'intranet.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Erreur recherche intranet:", err);
      const status = err?.response?.status;
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error;
      
      if (status === 400) {
        toast({
          title: "Erreur",
          description: errorMessage || "Le numéro de licence est manquant ou invalide",
          variant: "destructive",
        });
      } else if (status === 404) {
        toast({
          title: "Licencié non trouvé",
          description: "Aucun licencié trouvé avec ce numéro de licence sur l'intranet. Vous pouvez créer un nouveau participant.",
          variant: "destructive",
        });
        // Proposer de créer quand même avec le numéro de licence
        setNewParticipant({
          first_name: "",
          last_name: "",
          license_number: intranetLicenseNumber.trim(),
          club_name: "",
          gender: "",
          email: "",
        });
        setShowIntranetSearch(false);
        setShowNewParticipantForm(true);
      } else {
        toast({
          title: "Erreur",
          description: errorMessage || "Impossible de rechercher sur l'intranet. Veuillez réessayer plus tard.",
          variant: "destructive",
        });
      }
    } finally {
      setLoadingIntranetSearch(false);
    }
  };

  const handleRemoveParticipant = (id: string) => {
    const updated = participants
      .filter((p) => p.id !== id)
      .map((p, index) => ({
        ...p,
        seat_position: index + 1,
      }));
    setParticipants(updated);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = participants.findIndex((p) => p.id === active.id);
    const newIndex = participants.findIndex((p) => p.id === over.id);

    const newOrder = arrayMove(participants, oldIndex, newIndex).map((p, index) => ({
      ...p,
      seat_position: index + 1,
    }));

    setParticipants(newOrder);
  };

  // Fonction pour convertir le gender en format attendu par l'API
  const normalizeGender = (gender: string | undefined): string | undefined => {
    if (!gender) return undefined;
    const normalized = gender.trim();
    if (normalized === "M" || normalized === "m" || normalized === "Homme") return "Homme";
    if (normalized === "F" || normalized === "f" || normalized === "Femme") return "Femme";
    if (normalized === "Mixte") return "Mixte";
    return normalized; // Retourner tel quel si déjà au bon format
  };

  const handleFinish = async () => {
    if (!eventId) return;

    setIsSaving(true);
    try {
      // Étape 1: Créer l'équipage
      const crewPayload: any = {
        event_id: eventId,
        category_id: crewData.category_id,
        club_name: crewData.club_name,
        club_code: crewData.club_code,
      };
      
      // Ajouter coach_name seulement s'il n'est pas vide
      const trimmedCoachName = crewData.coach_name?.trim();
      if (trimmedCoachName) {
        crewPayload.coach_name = trimmedCoachName;
      }
      
      const crewRes = await api.post("/crews", crewPayload);

      const crewId = crewRes.data.data.id;

      // Étape 2: Créer les nouveaux participants
      const newParticipants = participants.filter((p) => p.isNew);
      const createdParticipantIds: string[] = [];
      
      for (const p of newParticipants) {
        try {
          const participantData = p.participant || {};
          const normalizedGender = normalizeGender(participantData.gender);
          const participantRes = await api.post("/participants", {
            first_name: participantData.first_name || "",
            last_name: participantData.last_name || "",
            license_number: participantData.license_number || "",
            gender: normalizedGender || undefined,
            email: participantData.email || undefined,
            club_name: participantData.club_name || undefined,
          });
          createdParticipantIds.push(participantRes.data.data.id);
        } catch (err: any) {
          console.error("Erreur création participant:", err);
          console.error("Données envoyées:", {
            first_name: p.participant?.first_name,
            last_name: p.participant?.last_name,
            license_number: p.participant?.license_number,
            gender: p.participant?.gender,
            email: p.participant?.email,
            club_name: p.participant?.club_name,
          });
          throw new Error(
            `Impossible de créer le participant ${p.participant?.first_name} ${p.participant?.last_name}: ${err?.response?.data?.message || err.message}`
          );
        }
      }

      // Étape 3: Ajouter tous les participants à l'équipage via /crew-participants
      for (let index = 0; index < participants.length; index++) {
        const p = participants[index];
        let participantId: string;
        
        if (p.participantId) {
          // Participant existant
          participantId = p.participantId;
        } else if (p.isNew) {
          // Nouveau participant créé
          const newIndex = newParticipants.findIndex((np) => np.id === p.id);
          if (newIndex === -1 || !createdParticipantIds[newIndex]) {
            throw new Error(`Impossible de trouver l'ID du participant créé pour ${p.participant?.first_name} ${p.participant?.last_name}`);
          }
          participantId = createdParticipantIds[newIndex];
        } else {
          throw new Error(`Participant ${p.id} n'a pas d'ID`);
        }

        // Ajouter le participant à l'équipage via /crew-participants
        const payload: any = {
          crew_id: crewId,
          participant_id: participantId,
          is_coxswain: p.is_coxswain || false,
          seat_position: index + 1,
        };
        
        // Ajouter coxswain_weight seulement si c'est un barreur
        if (p.is_coxswain) {
          payload.coxswain_weight = 0;
        }
        
        await api.post("/crew-participants", payload);
      }

      toast({
        title: "Succès",
        description: "Équipage créé avec succès !",
      });

      navigate(`/event/${eventId}/crews/${crewId}`);
    } catch (err: any) {
      console.error("Erreur création équipage:", err);
      console.error("Détails de l'erreur:", err.response?.data);
      const errorMessage =
        err?.message ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Erreur lors de la création de l'équipage";
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
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white p-6 shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Ship className="w-8 h-8" />
            Créer un équipage
          </h1>
          <p className="text-blue-100">Assistant de création en {STEPS.length} étapes</p>
        </div>
      </div>

      {/* Indicateur d'étapes */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white"
                      : isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white border-gray-300 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <StepIcon className="w-6 h-6" />
                  )}
                </div>
                <p
                  className={`mt-2 text-sm font-medium ${
                    isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {step.title}
                </p>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    isCompleted ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Contenu des étapes */}
      <Card className="shadow-lg">
        <CardContent className="p-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  Informations de l'équipage
                </h2>
                <p className="text-muted-foreground">
                  Remplissez les informations de base de l'équipage
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="club_select">
                    Club <span className="text-red-500">*</span>
                  </Label>
                  {loadingClubs ? (
                    <div className="flex items-center gap-2 p-3 border rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Chargement des clubs...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select
                        value={selectedClubId}
                        open={isClubSelectOpen}
                        onOpenChange={setIsClubSelectOpen}
                        onValueChange={(value) => {
                          if (value === "manual") {
                            // Mode manuel
                            setSelectedClubId("manual");
                            setCrewData({ ...crewData, club_name: "", club_code: "" });
                            setIsClubSelectOpen(false);
                          } else {
                            // Club sélectionné
                            const club = clubs.find((c) => c.code === value);
                            if (club) {
                              setSelectedClubId(club.code);
                              setCrewData({
                                ...crewData,
                                club_name: club.nom,
                                club_code: club.code,
                              });
                              setIsClubSelectOpen(false);
                              setClubSearchQuery("");
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un club" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[500px] p-0">
                          {/* Zone de recherche */}
                          <div className="sticky top-0 z-10 bg-background border-b p-2">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                placeholder="Rechercher un club..."
                                value={clubSearchQuery}
                                onChange={(e) => {
                                  setClubSearchQuery(e.target.value);
                                  if (!isClubSelectOpen) {
                                    setIsClubSelectOpen(true);
                                  }
                                }}
                                className="pl-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsClubSelectOpen(true);
                                }}
                                onFocus={() => setIsClubSelectOpen(true)}
                              />
                            </div>
                          </div>
                          
                          {/* Liste filtrée */}
                          <ScrollArea className="max-h-[400px]">
                            <div className="p-1">
                              <SelectItem 
                                value="manual"
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Saisie manuelle</span>
                                </div>
                              </SelectItem>
                              
                              {clubs
                                .filter((club) => {
                                  if (!clubSearchQuery) return true;
                                  const query = clubSearchQuery.toLowerCase();
                                  return (
                                    club.nom.toLowerCase().includes(query) ||
                                    club.nom_court?.toLowerCase().includes(query) ||
                                    club.code.toLowerCase().includes(query) ||
                                    club.nom_region?.toLowerCase().includes(query) ||
                                    club.nom_departement?.toLowerCase().includes(query)
                                  );
                                })
                                .map((club) => (
                                  <SelectItem 
                                    key={club.code} 
                                    value={club.code}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col py-1">
                                      <div className="flex items-center gap-2">
                                        {club.logo_url && (
                                          <img
                                            src={club.logo_url}
                                            alt={club.nom}
                                            className="w-6 h-6 object-contain rounded"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                          />
                                        )}
                                        <span className="font-medium">{club.nom}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        {club.nom_court && club.nom_court !== club.nom && (
                                          <span className="text-xs text-muted-foreground">
                                            {club.nom_court}
                                          </span>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                          {club.code}
                                        </span>
                                        {club.nom_region && (
                                          <span className="text-xs text-muted-foreground">
                                            • {club.nom_region}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              
                              {clubs.filter((club) => {
                                if (!clubSearchQuery) return false;
                                const query = clubSearchQuery.toLowerCase();
                                return (
                                  club.nom.toLowerCase().includes(query) ||
                                  club.nom_court?.toLowerCase().includes(query) ||
                                  club.code.toLowerCase().includes(query) ||
                                  club.nom_region?.toLowerCase().includes(query) ||
                                  club.nom_departement?.toLowerCase().includes(query)
                                );
                              }).length === 0 && clubSearchQuery && (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  Aucun club trouvé pour "{clubSearchQuery}"
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                      
                      {clubSearchQuery && clubs.filter((club) => {
                        const query = clubSearchQuery.toLowerCase();
                        return (
                          club.nom.toLowerCase().includes(query) ||
                          club.nom_court?.toLowerCase().includes(query) ||
                          club.code.toLowerCase().includes(query) ||
                          club.nom_region?.toLowerCase().includes(query) ||
                          club.nom_departement?.toLowerCase().includes(query)
                        );
                      }).length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {clubs.filter((club) => {
                            const query = clubSearchQuery.toLowerCase();
                            return (
                              club.nom.toLowerCase().includes(query) ||
                              club.nom_court?.toLowerCase().includes(query) ||
                              club.code.toLowerCase().includes(query) ||
                              club.nom_region?.toLowerCase().includes(query) ||
                              club.nom_departement?.toLowerCase().includes(query)
                            );
                          }).length} club(s) trouvé(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {selectedClubId === "manual" && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="club_name">
                        Nom du club <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="club_name"
                        value={crewData.club_name}
                        onChange={(e) =>
                          setCrewData({ ...crewData, club_name: e.target.value })
                        }
                        placeholder="Ex: Club Nautique de Paris"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="club_code">
                        Code club <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="club_code"
                        value={crewData.club_code}
                        onChange={(e) =>
                          setCrewData({ ...crewData, club_code: e.target.value.toUpperCase() })
                        }
                        placeholder="Ex: C075001"
                      />
                    </div>
                  </div>
                )}

                {selectedClubId && selectedClubId !== "manual" && crewData.club_code && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-start gap-3">
                      {clubs.find((c) => c.code === crewData.club_code)?.logo_url && (
                        <img
                          src={clubs.find((c) => c.code === crewData.club_code)?.logo_url || ""}
                          alt={crewData.club_name}
                          className="w-16 h-16 object-contain rounded border"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{crewData.club_name}</p>
                        <p className="text-sm text-muted-foreground mt-1">Code: {crewData.club_code}</p>
                        {clubs.find((c) => c.code === crewData.club_code)?.nom_region && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {clubs.find((c) => c.code === crewData.club_code)?.nom_region}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="category_id">
                    Catégorie <span className="text-red-500">*</span>
                  </Label>
                  {categories.length === 0 ? (
                    <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        Aucune catégorie disponible. Veuillez créer des catégories pour cet événement.
                      </p>
                    </div>
                  ) : (
                    <>
                      <Select
                        value={crewData.category_id}
                        onValueChange={(value) =>
                          setCrewData({ ...crewData, category_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{cat.label || cat.code || "Sans nom"}</span>
                                {cat.code && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {cat.code}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedCategory && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedCategory.boat_seats} place{selectedCategory.boat_seats > 1 ? "s" : ""}
                          {selectedCategory.has_coxswain && " + barreur"}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="coach_name">Nom de l'entraîneur (optionnel)</Label>
                  <Input
                    id="coach_name"
                    value={crewData.coach_name}
                    onChange={(e) =>
                      setCrewData({ ...crewData, coach_name: e.target.value })
                    }
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-600" />
                  Participants
                </h2>
                {selectedCategory && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-blue-900">
                        Participants requis pour cette catégorie
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-lg font-bold ${
                            participants.length === requiredParticipants
                              ? "text-green-600"
                              : "text-blue-600"
                          }`}
                        >
                          {participants.length}/{requiredParticipants}
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
                    {participants.length < requiredParticipants && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-sm text-blue-700">
                          ⚠️ Il reste{" "}
                          <strong>{requiredParticipants - participants.length}</strong> participant
                          {requiredParticipants - participants.length > 1 ? "s" : ""} à ajouter
                        </p>
                      </div>
                    )}
                    {participants.length === requiredParticipants && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-sm text-green-700 font-semibold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Nombre de participants requis atteint !
                        </p>
                      </div>
                    )}
                    {participants.length > requiredParticipants && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-sm text-red-600 font-semibold">
                          ⚠️ Trop de participants ! Maximum autorisé: {requiredParticipants}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-muted-foreground">
                  Ajoutez des participants existants ou créez-en de nouveaux
                </p>
              </div>

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
                        disabled={!newParticipant.first_name || !newParticipant.last_name}
                        className="flex-1"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Ajouter le participant
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Liste des participants ajoutés */}
              {participants.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">
                    Participants ajoutés ({participants.length})
                  </h3>
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext
                      items={participants.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {participants.map((p) => (
                          <ParticipantRow
                            key={p.id}
                            participant={p}
                            onRemove={handleRemoveParticipant}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Link2 className="w-6 h-6 text-blue-600" />
                  Liaison des participants
                </h2>
                <p className="text-muted-foreground">
                  Organisez les positions et désignez le barreur si nécessaire
                </p>
              </div>

              {selectedCategory && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Catégorie sélectionnée:</strong> {selectedCategory.label} (
                    {selectedCategory.code})
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Nombre de places: {selectedCategory.boat_seats}
                    {selectedCategory.has_coxswain && " + 1 barreur"}
                  </p>
                  {participants.length > maxSeats + (hasCoxswain ? 1 : 0) && (
                    <p className="text-sm text-red-600 mt-2 font-semibold">
                      ⚠️ Trop de participants ! Maximum: {maxSeats}
                      {hasCoxswain && " + 1 barreur"}
                    </p>
                  )}
                </div>
              )}

              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={participants.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {participants.map((p) => (
                      <ParticipantRow
                        key={p.id}
                        participant={p}
                        onRemove={handleRemoveParticipant}
                        showCoxswain={hasCoxswain}
                        onToggleCoxswain={(id) => {
                          setParticipants(
                            participants.map((part) =>
                              part.id === id
                                ? { ...part, is_coxswain: !part.is_coxswain }
                                : part
                            )
                          );
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Précédent
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/event/${eventId}/crews`)}
          >
            Annuler
          </Button>
          <Button onClick={handleNext} disabled={!canGoNext() || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Création...
              </>
            ) : currentStep === 3 ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Créer l'équipage
              </>
            ) : (
              <>
                Suivant
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ParticipantRow({
  participant,
  onRemove,
  showCoxswain = false,
  onToggleCoxswain,
}: {
  participant: CrewParticipant;
  onRemove: (id: string) => void;
  showCoxswain?: boolean;
  onToggleCoxswain?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: participant.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 border-2 rounded-lg bg-white ${
        isDragging ? "border-blue-500 shadow-lg" : "border-slate-200 hover:border-blue-300"
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
        {participant.seat_position}
      </div>
      <div className="flex-1">
        <p className="font-semibold">
          {participant.participant.first_name} {participant.participant.last_name}
        </p>
        <p className="text-sm text-muted-foreground">
          {participant.participant.license_number && `Licence: ${participant.participant.license_number} • `}
          {participant.participant.club_name}
        </p>
      </div>
      {showCoxswain && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={participant.is_coxswain}
            onCheckedChange={() => onToggleCoxswain?.(participant.id)}
          />
          <Label className="text-sm">Barreur</Label>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(participant.id)}
        className="text-red-600 hover:text-red-700"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

