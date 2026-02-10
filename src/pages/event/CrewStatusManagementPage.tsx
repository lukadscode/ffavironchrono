import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Search,
  UserPlus,
  CheckCircle2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  | "changed"
  | "category_change";

type EventCategory = {
  id: string;
  code: string;
  label: string;
};

type RaceCrewLite = {
  id: string;
  lane: number;
  crew_id?: string;
  Crew?: { id: string };
};

type RaceOption = {
  id: string;
  name: string;
  race_number?: number;
  lane_count?: number;
  race_crews: RaceCrewLite[];
};

export default function CrewStatusManagementPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewSearchQuery, setCrewSearchQuery] = useState("");
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Formulaire multi-étapes
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const [changeType, setChangeType] = useState<StatusChangeType | "">("");
  const [newParticipants, setNewParticipants] = useState<Array<{
    participantId: string;
    seat_position: number;
    is_coxswain: boolean;
    newParticipantData?: any; // Pour stocker les données des participants à créer
  }>>([]);
  const [availableParticipants, setAvailableParticipants] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [currentParticipants, setCurrentParticipants] = useState<Array<{
    id: string;
    participant: {
      id: string;
      first_name: string;
      last_name: string;
      license_number?: string;
    };
    seat_position: number;
    is_coxswain: boolean;
  }>>([]);

  // Changement de catégorie
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  // Séries / courses pour réaffecter un équipage après changement de catégorie
  const [availableRaces, setAvailableRaces] = useState<RaceOption[]>([]);
  const [raceSearchQuery, setRaceSearchQuery] = useState("");
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [selectedLane, setSelectedLane] = useState<number | null>(null);
  const [crewRaceAssignments, setCrewRaceAssignments] = useState<
    { raceId: string; raceName: string; lane: number; raceCrewId: string }[]
  >([]);

  // Recherche multi-phase : mode équipages vs participants
  const [searchMode, setSearchMode] = useState<"crews" | "participants">("crews");
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const participantSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [participantResults, setParticipantResults] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [selectedSearchParticipant, setSelectedSearchParticipant] = useState<any | null>(null);

  useEffect(() => {
    if (!eventId) return;
    fetchAvailableParticipants();
    // Ne pas charger les équipages au démarrage, seulement après recherche
  }, [eventId]);

  const fetchCrews = useCallback(
    async (searchQuery: string = "") => {
      if (!eventId) return;

      const trimmed = searchQuery.trim();

      // Si la recherche est vide ou trop courte, ne pas charger
      if (!trimmed || trimmed.length < 2) {
        setCrews([]);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get(`/crews/event/${eventId}/with-participants`, {
          params: {
            search: trimmed,
            page: 1,
            pageSize: 200, // on laisse le backend paginer, limite max 200
          },
        });

        const crewsData: Crew[] = res.data?.data || res.data || [];

        // Trier par statut (registered en premier) puis par club
        const sorted = (crewsData || []).sort((a: Crew, b: Crew) => {
          if (a.status === CrewStatus.REGISTERED && b.status !== CrewStatus.REGISTERED) return -1;
          if (a.status !== CrewStatus.REGISTERED && b.status === CrewStatus.REGISTERED) return 1;
          return (a.club_name || "").localeCompare(b.club_name || "");
        });

        setCrews(sorted);
      } catch (err: any) {
        console.error("Erreur chargement équipages (with-participants):", err);
        toast({
          title: "Erreur",
          description: err.response?.data?.message || "Impossible de charger les équipages",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [eventId, toast]
  );

  // Charger les équipages pour un participant spécifique (phase 2)
  const fetchCrewsForParticipant = useCallback(
    async (participantId: string) => {
      if (!participantId) return;
      setLoading(true);
      try {
        const res = await api.get(`/participants/${participantId}/crews`);
        const crewsData: Crew[] = res.data?.data || res.data || [];

        const sorted = (crewsData || []).sort((a: Crew, b: Crew) => {
          if (a.status === CrewStatus.REGISTERED && b.status !== CrewStatus.REGISTERED) return -1;
          if (a.status !== CrewStatus.REGISTERED && b.status === CrewStatus.REGISTERED) return 1;
          return (a.club_name || "").localeCompare(b.club_name || "");
        });

        setCrews(sorted);
      } catch (err: any) {
        console.error("Erreur chargement équipages pour le participant:", err);
        toast({
          title: "Erreur",
          description: err.response?.data?.message || "Impossible de charger les équipages du participant",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );
  
  // Debounce pour la recherche
  useEffect(() => {
    // Nettoyer le timer précédent
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }

    const trimmedQuery = crewSearchQuery.trim();

    // Si la recherche est vide ou trop courte, ne rien faire (garder les résultats précédents)
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return;
    }

    // Créer un nouveau timer pour déclencher la recherche après 500ms
    searchDebounceTimerRef.current = setTimeout(() => {
      if (searchMode === "crews") {
        fetchCrews(trimmedQuery);
      }
    }, 500);

    // Cleanup
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
        searchDebounceTimerRef.current = null;
      }
    };
  }, [crewSearchQuery, fetchCrews, searchMode]);

  // Debounce pour la recherche de participants (phase 1 multi-phase)
  useEffect(() => {
    if (participantSearchDebounceRef.current) {
      clearTimeout(participantSearchDebounceRef.current);
      participantSearchDebounceRef.current = null;
    }

    const trimmedQuery = participantSearchQuery.trim();

    if (searchMode !== "participants") {
      return;
    }

    if (!trimmedQuery || trimmedQuery.length < 2) {
      setParticipantResults([]);
      return;
    }

    participantSearchDebounceRef.current = setTimeout(async () => {
      if (!eventId) return;
      setLoadingParticipants(true);
      try {
        const res = await api.get(`/participants/event/${eventId}`, {
          params: {
            search: trimmedQuery,
            page: 1,
            pageSize: 50,
          },
        });
        const data = res.data?.data || res.data || [];
        setParticipantResults(data);
      } catch (err: any) {
        console.error("Erreur recherche participants pour crew-status:", err);
        toast({
          title: "Erreur",
          description: err.response?.data?.message || "Impossible de rechercher les participants",
          variant: "destructive",
        });
      } finally {
        setLoadingParticipants(false);
      }
    }, 500);

    return () => {
      if (participantSearchDebounceRef.current) {
        clearTimeout(participantSearchDebounceRef.current);
        participantSearchDebounceRef.current = null;
      }
    };
  }, [participantSearchQuery, eventId, searchMode, toast]);

  const fetchAvailableParticipants = async () => {
    if (!eventId) return;
    try {
      const res = await api.get(`/participants/event/${eventId}`);
      // Vérifier différentes structures de réponse
      let participantsData = [];
      if (Array.isArray(res.data)) {
        participantsData = res.data;
      } else if (res.data?.data) {
        participantsData = Array.isArray(res.data.data) ? res.data.data : [];
      } else if (res.data?.participants) {
        participantsData = Array.isArray(res.data.participants) ? res.data.participants : [];
      }
      setAvailableParticipants(participantsData);
      console.log("Participants chargés:", participantsData.length, participantsData);
      if (participantsData.length === 0) {
        console.warn("Aucun participant trouvé dans la réponse:", res.data);
      }
    } catch (err: any) {
      console.error("Erreur chargement participants:", err);
      toast({
        title: "Erreur",
        description: err.response?.data?.message || "Impossible de charger les participants",
        variant: "destructive",
      });
    }
  };

  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return availableParticipants;
    const query = searchQuery.toLowerCase();
    return availableParticipants.filter((p) => {
      return (
        p.first_name?.toLowerCase().includes(query) ||
        p.last_name?.toLowerCase().includes(query) ||
        p.license_number?.toLowerCase().includes(query) ||
        p.club_name?.toLowerCase().includes(query)
      );
    });
  }, [availableParticipants, searchQuery]);

  // Résultats de recherche participants (mode multi-phase) filtrés côté front
  const displayedParticipantResults = useMemo(() => {
    const q = participantSearchQuery.trim().toLowerCase();
    if (!q) return participantResults;
    return participantResults.filter((p) => {
      const first = (p.first_name || "").toLowerCase();
      const last = (p.last_name || "").toLowerCase();
      const license = (p.license_number || "").toLowerCase();
      const club = (p.club_name || "").toLowerCase();
      return (
        first.includes(q) ||
        last.includes(q) ||
        `${first} ${last}`.includes(q) ||
        license.includes(q) ||
        club.includes(q)
      );
    });
  }, [participantResults, participantSearchQuery]);

  // Les équipages sont déjà filtrés dans fetchCrews, on les retourne directement
  const filteredCrews = crews;

  const handleSelectSearchParticipant = (participant: any) => {
    setSelectedSearchParticipant(participant);
    // Charger uniquement les équipages de ce participant (phase 2)
    fetchCrewsForParticipant(participant.id);
  };

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
    setSelectedCategoryId("");
    setCategorySearchQuery("");
    setAvailableRaces([]);
    setRaceSearchQuery("");
    setSelectedRaceId("");
    setSelectedLane(null);
    setCrewRaceAssignments([]);
    setStep(1);
  };

  const handleChangeTypeSelect = async (type: StatusChangeType) => {
    setChangeType(type);
    if (type === "changed" && selectedCrew) {
      // Recharger les détails complets du crew pour avoir les participants à jour
      try {
        const crewDetailRes = await api.get(`/crews/${selectedCrew.id}`);
        const crewDetail = crewDetailRes.data.data || crewDetailRes.data;
        const participants = crewDetail.crew_participants || 
                           crewDetail.CrewParticipants || 
                           crewDetail.crewParticipants || 
                           selectedCrew.crew_participants || 
                           [];
        setCurrentParticipants(participants);
        console.log("Participants actuels chargés:", participants.length, participants);
      } catch (err) {
        console.error("Erreur chargement détails crew:", err);
        // Utiliser les participants déjà chargés en fallback
        const participants = selectedCrew.crew_participants || [];
        setCurrentParticipants(participants);
      }
      setNewParticipants([]);
      setSearchQuery("");
      setShowNewParticipantForm(false);
      setShowIntranetSearch(false);
    } else if (type === "category_change" && selectedCrew && eventId) {
      // Charger les catégories configurées pour l'évènement
      try {
        const res = await api.get(`/categories/event/${eventId}/with-crews`);
        const cats = (res.data.data || res.data || []).map((cat: any) => ({
          id: cat.id,
          code: cat.code,
          label: cat.label || cat.name || cat.code,
        }));
        setEventCategories(cats);
      } catch (err) {
        console.error("Erreur chargement catégories d'événement:", err);
        toast({
          title: "Erreur",
          description: "Impossible de charger les catégories de l'événement",
          variant: "destructive",
        });
      }

      // Charger les courses et les lanes disponibles + les séries où l'équipage est déjà présent
      try {
        const racesRes = await api.get(`/races/event/${eventId}`);
        const racesData = racesRes.data.data || racesRes.data || [];
        const raceOptions: RaceOption[] = [];
        const assignments: { raceId: string; raceName: string; lane: number; raceCrewId: string }[] = [];

        for (const race of racesData) {
          try {
            const raceCrewsRes = await api.get(`/race-crews/${race.id}`);
            const raceCrews: RaceCrewLite[] = raceCrewsRes.data.data || raceCrewsRes.data || [];

            raceOptions.push({
              id: race.id,
              name: race.name,
              race_number: race.race_number,
              lane_count: race.lane_count,
              race_crews: raceCrews,
            });

            raceCrews.forEach((rc: RaceCrewLite) => {
              const crewId = rc.crew_id || rc.Crew?.id;
              if (crewId === selectedCrew.id) {
                assignments.push({
                  raceId: race.id,
                  raceName: race.name,
                  lane: rc.lane,
                  raceCrewId: rc.id,
                });
              }
            });
          } catch (err) {
            console.error(`Erreur chargement race-crews pour la course ${race.id}:`, err);
          }
        }

        setAvailableRaces(raceOptions);
        setCrewRaceAssignments(assignments);
      } catch (err) {
        console.error("Erreur chargement des courses pour l'événement:", err);
      }

      setSelectedCategoryId(selectedCrew.category?.id || "");
      setCategorySearchQuery("");
      setRaceSearchQuery("");
      setSelectedRaceId("");
      setSelectedLane(null);
    } else {
      setNewParticipants([]);
      setCurrentParticipants([]);
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

  const handleRemoveCurrentParticipant = (participantId: string) => {
    setCurrentParticipants(currentParticipants.filter(cp => cp.participant.id !== participantId));
  };

  const handleAddExistingParticipant = (participant: any) => {
    const seatPosition = newParticipants.length + 1;
    setNewParticipants([
      ...newParticipants,
      {
        participantId: participant.id,
        seat_position: seatPosition,
        is_coxswain: false,
      }
    ]);
    setSearchQuery("");
    setShowIntranetSearch(false);
    setIntranetLicenseNumber("");
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

    // Créer temporairement un participant (sera créé côté backend)
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const seatPosition = newParticipants.length + 1;
    setNewParticipants([
      ...newParticipants,
      {
        participantId: tempId,
        seat_position: seatPosition,
        is_coxswain: false,
        newParticipantData: { ...newParticipant }, // Stocker les données pour création
      }
    ]);
    
    // Réinitialiser le formulaire
    setNewParticipant({
      first_name: "",
      last_name: "",
      license_number: "",
      club_name: "",
      gender: "",
      email: "",
    });
    setShowNewParticipantForm(false);
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
      const res = await api.get(`/participants/licencie/${intranetLicenseNumber.trim()}`);
      const intranetData = res.data.data || res.data;
      
      if (intranetData) {
        const typeLibelle = intranetData.type_libelle || "";
        const prenom = intranetData.prenom || "";
        const nom = intranetData.nom || "";
        const numeroLicence = intranetData.numero_licence || intranetLicenseNumber.trim();
        
        if (typeLibelle.toLowerCase().includes("loisir")) {
          toast({
            title: "Licence loisir",
            description: `${prenom} ${nom} (${numeroLicence}) a une licence loisir et ne peut pas participer à une compétition.`,
            variant: "destructive",
          });
          setIntranetLicenseNumber("");
          setLoadingIntranetSearch(false);
          return;
        }
        
        let normalizedGender = "";
        if (intranetData.genre) {
          const genre = intranetData.genre.trim().toUpperCase();
          if (genre === "M" || genre === "HOMME") {
            normalizedGender = "Homme";
          } else if (genre === "F" || genre === "FEMME") {
            normalizedGender = "Femme";
          }
        }
        
        if (typeLibelle.toLowerCase().includes("compétition") || typeLibelle.toLowerCase().includes("competition")) {
          // Ajouter directement avec les données de l'intranet
          const tempId = `temp-${Date.now()}-${Math.random()}`;
          const seatPosition = newParticipants.length + 1;
          const newParticipantData = {
            first_name: prenom,
            last_name: nom,
            license_number: numeroLicence,
            club_name: intranetData.club_nom_court || intranetData.club_code || "",
            gender: normalizedGender,
          };
          setNewParticipants([
            ...newParticipants,
            {
              participantId: tempId,
              seat_position: seatPosition,
              is_coxswain: false,
              newParticipantData: newParticipantData,
            }
          ]);
          setShowIntranetSearch(false);
          setIntranetLicenseNumber("");
          toast({
            title: "Participant ajouté",
            description: `${prenom} ${nom} a été ajouté depuis l'intranet.`,
          });
        } else {
          // Pré-remplir le formulaire
          setNewParticipant({
            first_name: prenom,
            last_name: nom,
            license_number: numeroLicence,
            club_name: intranetData.club_nom_court || intranetData.club_code || "",
            gender: normalizedGender,
            email: intranetData.mail || "",
          });
          setShowIntranetSearch(false);
          setShowNewParticipantForm(true);
          setIntranetLicenseNumber("");
          toast({
            title: "Participant trouvé",
            description: "Les informations ont été pré-remplies. Veuillez vérifier et compléter.",
          });
        }
      }
    } catch (err: any) {
      console.error("Erreur recherche intranet:", err);
      if (err?.response?.status === 404) {
        toast({
          title: "Licencié non trouvé",
          description: "Aucun licencié trouvé avec ce numéro de licence.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: "Erreur lors de la recherche sur l'intranet",
          variant: "destructive",
        });
      }
    } finally {
      setLoadingIntranetSearch(false);
    }
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

        // 4. Supprimer les anciens participants de l'équipage original (ceux qui ont été retirés)
        const removedParticipantIds = new Set(
          originalParticipants
            .filter(cp => !currentParticipants.find(cp2 => cp2.participant.id === cp.participant.id))
            .map(cp => cp.id)
        );
        for (const cp of originalParticipants) {
          if (removedParticipantIds.has(cp.id)) {
            try {
              await api.delete(`/crew-participants/${cp.id}`);
            } catch (err) {
              console.error(`Erreur suppression participant ${cp.id}:`, err);
            }
          }
        }

        // 5. Ajouter les nouveaux participants à l'équipage original
        for (const np of newParticipants) {
          if (np.participantId) {
            let participantId = np.participantId;
            
            // Si c'est un ID temporaire, créer le participant d'abord
            if (np.participantId.startsWith("temp-") && np.newParticipantData) {
              try {
                // Normaliser le genre comme dans CrewWizardPage
                const normalizeGender = (gender: string | undefined): string | undefined => {
                  if (!gender) return undefined;
                  const normalized = gender.trim();
                  if (normalized === "M" || normalized === "m" || normalized === "Homme") return "Homme";
                  if (normalized === "F" || normalized === "f" || normalized === "Femme") return "Femme";
                  if (normalized === "Mixte") return "Mixte";
                  return normalized;
                };

                const normalizedGender = normalizeGender(np.newParticipantData.gender);
                const newParticipantRes = await api.post("/participants", {
                  event_id: eventId,
                  first_name: np.newParticipantData.first_name,
                  last_name: np.newParticipantData.last_name,
                  license_number: np.newParticipantData.license_number || undefined,
                  club_name: np.newParticipantData.club_name || undefined,
                  gender: normalizedGender || undefined,
                  email: np.newParticipantData.email || undefined,
                });
                participantId = newParticipantRes.data.data?.id || newParticipantRes.data.id;
                // Recharger la liste des participants disponibles
                await fetchAvailableParticipants();
              } catch (err: any) {
                console.error("Erreur création participant:", err);
                toast({
                  title: "Erreur",
                  description: `Impossible de créer le participant: ${err.response?.data?.message || "Erreur inconnue"}`,
                  variant: "destructive",
                });
                continue;
              }
            }
            
            if (participantId && !participantId.startsWith("temp-")) {
              await api.post("/crew-participants", {
                crew_id: selectedCrew.id,
                participant_id: participantId,
                is_coxswain: np.is_coxswain,
                seat_position: np.seat_position,
              });
            }
          }
        }
      } else if (changeType === "category_change") {
        if (!selectedCategoryId) {
          toast({
            title: "Erreur",
            description: "Veuillez sélectionner une catégorie",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // Mettre à jour la catégorie de l'équipage (statut reste inchangé)
        await api.put(`/crews/${selectedCrew.id}`, {
          category_id: selectedCategoryId,
        });

        // Retirer l'équipage de toutes les courses où il est déjà présent
        if (crewRaceAssignments.length > 0) {
          for (const assign of crewRaceAssignments) {
            try {
              await api.delete(`/race-crews/${assign.raceCrewId}`);
            } catch (err) {
              console.error(`Erreur suppression de l'équipage de la course ${assign.raceId}:`, err);
            }
          }
        }

        // Passer à l'étape 4 pour éventuellement replacer l'équipage dans une série
        toast({
          title: "Catégorie mise à jour",
          description: "La catégorie de l'équipage a été modifiée. Vous pouvez maintenant le replacer dans une série.",
        });
        setStep(4);
        return;
      } else {
        // Changement de statut simple
        await api.put(`/crews/${selectedCrew.id}`, {
          status: changeType,
        });

        // Si l'équipage devient non-participant ou disqualifié, le retirer des courses
        if (NON_PARTICIPATING_STATUSES.includes(changeType as CrewStatus) || changeType === "disqualified") {
          try {
            const racesRes = await api.get(`/races/event/${eventId}`);
            const racesData = racesRes.data.data || racesRes.data || [];

            for (const race of racesData) {
              try {
                const raceCrewsRes = await api.get(`/race-crews/${race.id}`);
                const raceCrews: RaceCrewLite[] = raceCrewsRes.data.data || raceCrewsRes.data || [];

                for (const rc of raceCrews) {
                  const crewId = rc.crew_id || rc.Crew?.id;
                  if (crewId === selectedCrew.id) {
                    await api.delete(`/race-crews/${rc.id}`);
                  }
                }
              } catch (err) {
                console.error(`Erreur nettoyage des séries pour la course ${race.id}:`, err);
              }
            }
          } catch (err) {
            console.error("Erreur lors du retrait de l'équipage des courses:", err);
          }
        }
      }

      toast({
        title: "Succès",
        description: `Le statut de l'équipage a été mis à jour avec succès.`,
      });

      // Recharger les données et revenir à l'étape 1
      if (crewSearchQuery.trim().length >= 2) {
        await fetchCrews(crewSearchQuery);
      } else {
        setCrews([]);
      }
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

      {/* Étape 1: Sélection de l'équipage (ou du participant en multi-phase) */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 1 : Sélectionner un équipage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle de mode de recherche */}
            <div className="flex gap-2">
              <Button
                variant={searchMode === "crews" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSearchMode("crews");
                  setParticipantSearchQuery("");
                  setParticipantResults([]);
                  setSelectedSearchParticipant(null);
                }}
              >
                Rechercher par équipage / club
              </Button>
              <Button
                variant={searchMode === "participants" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSearchMode("participants");
                  setCrewSearchQuery("");
                  setCrews([]);
                  setSelectedSearchParticipant(null);
                }}
              >
                Rechercher par participant
              </Button>
            </div>

            {searchMode === "crews" ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par club, code club, catégorie ou participant (min. 2 caractères)..."
                    value={crewSearchQuery}
                    onChange={(e) => setCrewSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Recherche en cours...</span>
                  </div>
                )}
                
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {!loading && filteredCrews.length === 0 && crewSearchQuery.trim().length < 2 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm font-medium mb-2">Rechercher un équipage</p>
                      <p className="text-xs">Tapez au moins 2 caractères pour commencer la recherche</p>
                    </div>
                  ) : !loading && filteredCrews.length === 0 && crewSearchQuery.trim().length >= 2 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm font-medium">Aucun équipage trouvé</p>
                      <p className="text-xs mt-1">Essayez avec d'autres mots-clés</p>
                    </div>
                  ) : !loading ? (
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {crew.crew_participants?.length || 0} participant
                                  {(crew.crew_participants?.length || 0) > 1 ? "s" : ""}
                                </span>
                                {crew.crew_participants && crew.crew_participants.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {crew.crew_participants.slice(0, 3).map((cp, idx) => (
                                      <span
                                        key={cp.id || idx}
                                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200"
                                      >
                                        {cp.participant?.first_name} {cp.participant?.last_name}
                                      </span>
                                    ))}
                                    {crew.crew_participants.length > 3 && (
                                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                        +{crew.crew_participants.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
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
                  ) : null}
                </div>
              </>
            ) : (
              <>
                {/* Mode recherche par participant (multi-phase) */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un participant par nom, licence ou club (min. 2 caractères)..."
                    value={participantSearchQuery}
                    onChange={(e) => setParticipantSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {loadingParticipants && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Recherche de participants...</span>
                  </div>
                )}

                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                  {!loadingParticipants &&
                    participantResults.length === 0 &&
                    participantSearchQuery.trim().length < 2 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-sm font-medium mb-2">Rechercher un participant</p>
                        <p className="text-xs">Tapez au moins 2 caractères pour lancer la recherche</p>
                      </div>
                    )}

                  {!loadingParticipants &&
                    participantResults.length === 0 &&
                    participantSearchQuery.trim().length >= 2 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-sm font-medium">Aucun participant trouvé</p>
                        <p className="text-xs mt-1">Essayez avec d'autres mots-clés</p>
                      </div>
                    )}

                  {displayedParticipantResults.map((p) => (
                    <Card
                      key={p.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${
                        selectedSearchParticipant?.id === p.id ? "ring-2 ring-blue-500" : ""
                      }`}
                      onClick={() => handleSelectSearchParticipant(p)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-semibold">
                            {p.first_name} {p.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {p.license_number && `Licence : ${p.license_number}`}
                            {p.club_name && (p.license_number ? " • " : "")}
                            {p.club_name}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Liste des équipages du participant sélectionné */}
                {selectedSearchParticipant && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Équipages pour{" "}
                      <span className="font-semibold">
                        {selectedSearchParticipant.first_name} {selectedSearchParticipant.last_name}
                      </span>
                    </p>

                    {loading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                        <span className="text-sm text-muted-foreground">Chargement des équipages...</span>
                      </div>
                    )}

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {!loading && filteredCrews.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-xs">
                          Aucun équipage trouvé pour ce participant.
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
                                  <div className="flex items-center gap-2 flex-wrap">
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
                  </div>
                )}
              </>
            )}
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
                  <div className="font-semibold">Forfait</div>
                  <div className="text-sm text-muted-foreground">
                    L'équipage est forfait et ne prendra pas le départ
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

              <Button
                variant={changeType === "category_change" ? "default" : "outline"}
                className="justify-start h-auto py-4"
                onClick={() => handleChangeTypeSelect("category_change")}
              >
                <div className="flex-1 text-left">
                  <div className="font-semibold">Changement de catégorie</div>
                  <div className="text-sm text-muted-foreground">
                    Modifier la catégorie de l'équipage et, si besoin, l'affecter à une autre série
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
                    Les participants marqués pour suppression seront retirés. Les nouveaux participants ajoutés remplaceront ceux supprimés.
                  </AlertDescription>
                </Alert>

                {/* Participants actuels */}
                {currentParticipants.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">
                      Participants actuels
                    </Label>
                    <div className="space-y-2">
                      {currentParticipants.map((cp) => {
                        const participant = cp.participant;
                        return (
                          <Card key={cp.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-semibold">
                                    {participant.first_name} {participant.last_name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {participant.license_number && `Licence: ${participant.license_number}`}
                                    {cp.is_coxswain && " • Barreur"}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveCurrentParticipant(participant.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
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

                {/* Liste des nouveaux participants ajoutés */}
                {newParticipants.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">
                      Nouveaux participants ({newParticipants.length})
                    </Label>
                    <div className="space-y-2">
                      {newParticipants.map((np, index) => {
                        const participant = availableParticipants.find(p => p.id === np.participantId);
                        const isTemp = np.participantId.startsWith("temp-");
                        const tempData = isTemp ? np.newParticipantData : null;
                        
                        return (
                          <Card key={index}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  {participant ? (
                                    <>
                                      <div className="font-semibold">
                                        {participant.first_name} {participant.last_name}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {participant.license_number && `Licence: ${participant.license_number}`}
                                        {participant.club_name && ` • ${participant.club_name}`}
                                        {np.is_coxswain && " • Barreur"}
                                      </div>
                                    </>
                                  ) : tempData ? (
                                    <>
                                      <div className="font-semibold">
                                        {tempData.first_name} {tempData.last_name}
                                        <span className="text-xs text-muted-foreground ml-2">(à créer)</span>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {tempData.license_number && `Licence: ${tempData.license_number}`}
                                        {tempData.club_name && ` • ${tempData.club_name}`}
                                        {np.is_coxswain && " • Barreur"}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="font-semibold">
                                        Participant à sélectionner
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {np.is_coxswain && "Barreur"}
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={np.is_coxswain}
                                    onCheckedChange={(checked) =>
                                      handleParticipantChange(
                                        index,
                                        np.participantId,
                                        np.seat_position,
                                        checked as boolean
                                      )
                                    }
                                  />
                                  <Label className="text-sm">Barreur</Label>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveParticipantSlot(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : changeType === "category_change" && step === 3 ? (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Changement de catégorie</AlertTitle>
                  <AlertDescription>
                    Choisissez une nouvelle catégorie pour cet équipage. S'il est déjà présent dans des séries,
                    il sera retiré de celles-ci et vous pourrez l'affecter à une autre série disposant de lignes libres.
                  </AlertDescription>
                </Alert>

                {/* Sélection de la nouvelle catégorie */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Nouvelle catégorie</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Rechercher une catégorie par code ou label..."
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="border rounded-md max-h-56 overflow-y-auto">
                    {eventCategories
                      .filter((cat) => {
                        if (!categorySearchQuery.trim()) return true;
                        const q = categorySearchQuery.toLowerCase();
                        return (
                          cat.code.toLowerCase().includes(q) ||
                          cat.label.toLowerCase().includes(q)
                        );
                      })
                      .map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className={`w-full text-left px-3 py-2 border-b last:border-b-0 flex items-center justify-between hover:bg-slate-50 ${
                            selectedCategoryId === cat.id ? "bg-blue-50 border-blue-200" : ""
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{cat.label}</div>
                            <div className="text-xs text-muted-foreground">Code : {cat.code}</div>
                          </div>
                          {selectedCategoryId === cat.id && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      ))}
                    {eventCategories.length === 0 && (
                      <div className="p-3 text-sm text-muted-foreground">
                        Aucune catégorie n'est configurée pour cet événement.
                      </div>
                    )}
                  </div>
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

      {/* Étape 4: Replacer dans une série après changement de catégorie */}
      {step === 4 && selectedCrew && changeType === "category_change" && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 4 : Replacer l'équipage dans une série</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Équipage : <strong>{selectedCrew.club_name}</strong>
              {selectedCrew.category && ` - ${selectedCrew.category.label}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Séries actuelles (après retrait, il ne devrait plus y en avoir, mais on garde l'info si besoin) */}
            {crewRaceAssignments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Anciennes séries</Label>
                <ul className="text-sm list-disc pl-5 text-muted-foreground">
                  {crewRaceAssignments.map((a) => (
                    <li key={a.raceCrewId}>
                      {a.raceName} – Ligne {a.lane}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Choix d'une nouvelle série / course */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Sélectionner une série</Label>
              <div className="text-sm text-muted-foreground">
                Optionnel : sélectionnez une course qui dispose encore de lignes libres pour y replacer l'équipage.
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Rechercher une course par nom ou numéro..."
                  value={raceSearchQuery}
                  onChange={(e) => setRaceSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="border rounded-md max-h-56 overflow-y-auto">
                {availableRaces
                  .filter((race) => {
                    if (!raceSearchQuery.trim()) return true;
                    const q = raceSearchQuery.toLowerCase();
                    return (
                      (race.name || "").toLowerCase().includes(q) ||
                      String(race.race_number || "").includes(q)
                    );
                  })
                  .map((race) => {
                    const laneCount = race.lane_count || 0;
                    const takenLanes = new Set(
                      race.race_crews.map((rc) => rc.lane)
                    );
                    const availableLanes = Array.from({ length: laneCount }, (_, i) => i + 1).filter(
                      (lane) => !takenLanes.has(lane)
                    );

                    if (availableLanes.length === 0) return null;

                    const isSelected = selectedRaceId === race.id;

                    return (
                      <div
                        key={race.id}
                        className={`px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-slate-50 ${
                          isSelected ? "bg-blue-50 border-blue-200" : ""
                        }`}
                        onClick={() => {
                          setSelectedRaceId(race.id);
                          setSelectedLane(availableLanes[0] ?? null);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold">
                              {race.name || `Course ${race.race_number ?? ""}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Lignes libres : {availableLanes.join(", ")}
                            </div>
                          </div>
                        </div>

                        {isSelected && availableLanes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableLanes.map((lane) => (
                              <Button
                                key={lane}
                                type="button"
                                size="sm"
                                variant={selectedLane === lane ? "default" : "outline"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRaceId(race.id);
                                  setSelectedLane(lane);
                                }}
                              >
                                Ligne {lane}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {availableRaces.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">
                    Aucune course avec des lignes disponibles trouvée pour cet événement.
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleBackToStep1}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Terminer sans replacer
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedCrew || !eventId || !selectedRaceId || !selectedLane) {
                    toast({
                      title: "Erreur",
                      description: "Veuillez sélectionner une course et une ligne",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsSubmitting(true);
                  try {
                    await api.post("/race-crews", {
                      race_id: selectedRaceId,
                      crew_id: selectedCrew.id,
                      lane: selectedLane,
                    });
                    toast({
                      title: "Succès",
                      description: "Équipage replacé dans la série sélectionnée.",
                    });
                    handleBackToStep1();
                  } catch (err: any) {
                    console.error("Erreur lors de la réaffectation de l'équipage à une course:", err);
                    toast({
                      title: "Erreur",
                      description:
                        err?.response?.data?.message ||
                        "Impossible de replacer l'équipage dans la série sélectionnée",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting || !selectedRaceId || !selectedLane}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Repositionnement...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Replacer l'équipage
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

