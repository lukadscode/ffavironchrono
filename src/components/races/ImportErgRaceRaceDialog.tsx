import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";

interface ImportErgRaceRaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Rac2File {
  race_definition: {
    name_long?: string;
    name_short?: string;
    race_id?: string;
    duration: number;
    duration_type: "meters" | "time";
    race_type: "individual" | "team" | "relay";
    boats: Array<{
      id: string;
      lane_number: number;
      name: string;
      class_name: string;
      affiliation?: string;
      participants: Array<{
        id: string;
        name: string;
      }>;
    }>;
  };
}

interface Distance {
  id: string;
  meters: number | null;
  is_time_based: boolean;
  duration_seconds: number | null;
  label: string;
  is_relay?: boolean;
  relay_count?: number | null;
}

interface Category {
  id: string;
  code: string;
  label: string;
}

interface Crew {
  id: string;
  club_code?: string;
  club_name?: string;
  category?: {
    id: string;
    code: string;
    label: string;
  };
  crew_participants: Array<{
    seat_position: number;
    participant: {
      id: string;
      first_name: string;
      last_name: string;
    };
  }>;
}

interface BoatMapping {
  ergraceBoat: Rac2File["race_definition"]["boats"][0];
  selectedCrewId: string | null;
  crew?: Crew;
  matchScore?: number; // Score de correspondance pour l'auto-matching
}

export default function ImportErgRaceRaceDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportErgRaceRaceDialogProps) {
  const { eventId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Si l'utilisateur n'est pas admin, fermer le dialog et afficher une erreur
  useEffect(() => {
    if (open && !isAdmin) {
      onOpenChange(false);
      toast({
        title: "Accès refusé",
        description: "Cette fonctionnalité est réservée aux administrateurs.",
        variant: "destructive",
      });
    }
  }, [open, isAdmin, onOpenChange, toast]);

  const [step, setStep] = useState<"upload" | "configure" | "map-crews">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [rac2Data, setRac2Data] = useState<Rac2File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Configuration de la course
  const [raceName, setRaceName] = useState("");
  const [raceNumber, setRaceNumber] = useState(1);
  const [startTime, setStartTime] = useState("");
  const [selectedDistanceId, setSelectedDistanceId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");

  // Données disponibles
  const [distances, setDistances] = useState<Distance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [phases, setPhases] = useState<Array<{ id: string; name: string }>>([]);
  const [availableCrews, setAvailableCrews] = useState<Crew[]>([]);

  // Mapping des équipages
  const [boatMappings, setBoatMappings] = useState<BoatMapping[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open && eventId) {
      fetchDistances();
      fetchCategories();
      fetchPhases();
      fetchAvailableCrews();
    }
  }, [open, eventId]);

  const fetchDistances = async () => {
    try {
      const res = await api.get(`/distances/event/${eventId}`);
      setDistances(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement distances", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get(`/categories/event/${eventId}/with-crews`);
      const categoriesData = res.data.data || [];
      setCategories(categoriesData);
    } catch (err) {
      console.error("Erreur chargement catégories", err);
    }
  };

  const fetchPhases = async () => {
    try {
      const res = await api.get(`/race-phases/${eventId}`);
      setPhases(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement phases", err);
    }
  };

  const fetchAvailableCrews = async () => {
    try {
      const res = await api.get(`/crews/event/${eventId}`);
      const crewsData = res.data.data || [];
      
      // Enrichir chaque crew avec ses participants (comme dans RacePhaseDetailPage)
      const crewsWithParticipants = await Promise.all(
        crewsData.map(async (crew: any) => {
          try {
            // Récupérer les détails complets du crew (incluant les participants)
            const crewDetailRes = await api.get(`/crews/${crew.id}`);
            const crewDetail = crewDetailRes.data.data || crewDetailRes.data;
            
            return {
              ...crew,
              crew_participants: crewDetail.crew_participants || 
                               crewDetail.CrewParticipants || 
                               crewDetail.crewParticipants || 
                               crew.crew_participants || 
                               [],
            };
          } catch (err) {
            console.error(`Erreur chargement participants pour crew ${crew.id}:`, err);
            return {
              ...crew,
              crew_participants: crew.crew_participants || [],
            };
          }
        })
      );
      
      setAvailableCrews(crewsWithParticipants);
    } catch (err) {
      console.error("Erreur chargement équipages", err);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Vérifier l'extension
    if (!selectedFile.name.endsWith(".rac2") && !selectedFile.name.endsWith(".json")) {
      toast({
        title: "Format invalide",
        description: "Le fichier doit être un fichier .rac2 ou .json",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const fileContent = await selectedFile.text();
      const parsed = JSON.parse(fileContent);

      if (!parsed.race_definition) {
        throw new Error("Format de fichier invalide : race_definition manquant");
      }

      setRac2Data(parsed);

      // Pré-remplir les champs
      if (parsed.race_definition.name_long) {
        setRaceName(parsed.race_definition.name_long);
      } else if (parsed.race_definition.name_short) {
        setRaceName(parsed.race_definition.name_short);
      }

      // Essayer de détecter la distance automatiquement
      const duration = parsed.race_definition.duration;
      const durationType = parsed.race_definition.duration_type;

      if (durationType === "meters") {
        // Chercher une distance correspondante
        const matchingDistance = distances.find((d) => d.meters === duration);
        if (matchingDistance) {
          setSelectedDistanceId(matchingDistance.id);
        }
      } else if (durationType === "time") {
        // Chercher une distance basée sur le temps
        const matchingDistance = distances.find(
          (d) => d.is_time_based && d.duration_seconds === duration
        );
        if (matchingDistance) {
          setSelectedDistanceId(matchingDistance.id);
        }
      }

      // Essayer de détecter la catégorie depuis les boats
      if (parsed.race_definition.boats && parsed.race_definition.boats.length > 0) {
        const firstBoat = parsed.race_definition.boats[0];
        if (firstBoat.class_name) {
          const matchingCategory = categories.find(
            (c) => c.label === firstBoat.class_name || c.code === firstBoat.class_name
          );
          if (matchingCategory) {
            setSelectedCategoryId(matchingCategory.id);
          }
        }
      }

      // Attendre que les équipages soient chargés avant de faire le matching
      // Si les équipages ne sont pas encore chargés, on les charge maintenant
      let crewsToUse = availableCrews;
      if (crewsToUse.length === 0) {
        // Charger les équipages maintenant
        try {
          const res = await api.get(`/crews/event/${eventId}`);
          const crewsData = res.data.data || [];
          
          // Enrichir chaque crew avec ses participants
          crewsToUse = await Promise.all(
            crewsData.map(async (crew: any) => {
              try {
                const crewDetailRes = await api.get(`/crews/${crew.id}`);
                const crewDetail = crewDetailRes.data.data || crewDetailRes.data;
                return {
                  ...crew,
                  crew_participants: crewDetail.crew_participants || 
                                   crewDetail.CrewParticipants || 
                                   crewDetail.crewParticipants || 
                                   crew.crew_participants || 
                                   [],
                };
              } catch (err) {
                console.error(`Erreur chargement participants pour crew ${crew.id}:`, err);
                return {
                  ...crew,
                  crew_participants: crew.crew_participants || [],
                };
              }
            })
          );
          
          // Mettre à jour l'état pour les prochaines fois
          setAvailableCrews(crewsToUse);
        } catch (err) {
          console.error("Erreur chargement équipages", err);
        }
      }

      // Fonction pour normaliser un nom (enlever accents, espaces multiples, etc.)
      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
          .replace(/\s+/g, " ") // Remplacer les espaces multiples par un seul
          .trim();
      };

      // Fonction pour parser un nom ErgRace (format "NOM, Prénom" ou "NOM Prénom")
      const parseErgRaceName = (name: string): { lastName: string; firstName: string } => {
        const normalized = normalizeName(name);
        // Essayer le format "nom, prenom"
        if (normalized.includes(",")) {
          const parts = normalized.split(",").map((p) => p.trim());
          return {
            lastName: parts[0] || "",
            firstName: parts[1] || "",
          };
        }
        // Sinon, essayer de séparer par le dernier espace (supposant "Prénom NOM")
        const parts = normalized.split(" ");
        if (parts.length >= 2) {
          return {
            lastName: parts[parts.length - 1] || "",
            firstName: parts.slice(0, -1).join(" ") || "",
          };
        }
        return { lastName: normalized, firstName: "" };
      };

      // Fonction pour comparer deux participants
      const compareParticipants = (
        ergraceName: string,
        crewLastName: string,
        crewFirstName: string
      ): number => {
        const ergraceParsed = parseErgRaceName(ergraceName);
        const normalizedErgraceLast = normalizeName(ergraceParsed.lastName);
        const normalizedErgraceFirst = normalizeName(ergraceParsed.firstName);
        const normalizedCrewLast = normalizeName(crewLastName);
        const normalizedCrewFirst = normalizeName(crewFirstName);

        // Correspondance exacte
        if (
          normalizedErgraceLast === normalizedCrewLast &&
          normalizedErgraceFirst === normalizedCrewFirst
        ) {
          return 100;
        }

        // Correspondance partielle (nom de famille exact)
        if (normalizedErgraceLast === normalizedCrewLast) {
          // Vérifier si le prénom commence par les mêmes lettres
          if (
            normalizedErgraceFirst &&
            normalizedCrewFirst &&
            (normalizedCrewFirst.startsWith(normalizedErgraceFirst) ||
              normalizedErgraceFirst.startsWith(normalizedCrewFirst))
          ) {
            return 80;
          }
          return 50; // Nom de famille correspond mais pas le prénom
        }

        // Vérifier si les noms sont inversés (prénom/nom)
        if (
          normalizedErgraceLast === normalizedCrewFirst &&
          normalizedErgraceFirst === normalizedCrewLast
        ) {
          return 90;
        }

        // Correspondance partielle sur le nom de famille (contient)
        if (
          normalizedCrewLast.includes(normalizedErgraceLast) ||
          normalizedErgraceLast.includes(normalizedCrewLast)
        ) {
          return 30;
        }

        return 0;
      };

      // Fonction pour calculer le score de correspondance entre un boat ErgRace et un crew
      const calculateMatchScore = (boat: any, crew: Crew): number => {
        let score = 0;
        let criteriaMatched = 0;
        let totalCriteria = 0;

        // Critère 1: Nom du boat vs nom(s) des participants
        if (boat.name && boat.name.trim()) {
          totalCriteria++;
          const boatName = normalizeName(boat.name);
          
          // Pour les courses individuelles, comparer avec le nom de famille du participant
          if (crew.crew_participants && crew.crew_participants.length > 0) {
            const crewParticipant = crew.crew_participants[0]; // Premier participant pour course individuelle
            const crewLastName = normalizeName(crewParticipant.participant.last_name);
            
            if (boatName === crewLastName) {
              score += 50;
              criteriaMatched++;
            } else if (crewLastName.includes(boatName) || boatName.includes(crewLastName)) {
              score += 30;
            }
          }
          
          // Vérifier aussi dans tous les participants pour les équipages
          if (crew.crew_participants && crew.crew_participants.length > 1) {
            const hasMatch = crew.crew_participants.some((cp) => {
              const lastName = normalizeName(cp.participant.last_name);
              return lastName === boatName || lastName.includes(boatName) || boatName.includes(lastName);
            });
            if (hasMatch) {
              score = Math.max(score, 40);
            }
          }
        }

        // Critère 2: Affiliation (code club) vs code club du crew
        if (boat.affiliation && boat.affiliation.trim()) {
          totalCriteria++;
          const boatAffiliation = normalizeName(boat.affiliation);
          const crewClubCode = normalizeName(crew.club_code || "");
          
          if (boatAffiliation === crewClubCode) {
            score += 30;
            criteriaMatched++;
          } else if (crewClubCode && (crewClubCode.includes(boatAffiliation) || boatAffiliation.includes(crewClubCode))) {
            score += 15;
          }
        }

        // Critère 3: Class name (catégorie) vs catégorie du crew
        if (boat.class_name && boat.class_name.trim()) {
          totalCriteria++;
          const boatCategory = normalizeName(boat.class_name);
          const crewCategoryLabel = normalizeName(crew.category?.label || "");
          const crewCategoryCode = normalizeName(crew.category?.code || "");
          
          if (
            boatCategory === crewCategoryLabel ||
            boatCategory === crewCategoryCode ||
            (crewCategoryLabel && crewCategoryLabel.includes(boatCategory)) ||
            (crewCategoryCode && crewCategoryCode.includes(boatCategory))
          ) {
            score += 20;
            criteriaMatched++;
          }
        }

        // Critère 4: Participants (si disponibles)
        if (boat.participants && boat.participants.length > 0 && boat.participants.some((p: any) => p.name && p.name.trim())) {
          totalCriteria++;
          if (!crew.crew_participants || crew.crew_participants.length === 0) {
            return 0; // Pas de participants dans le crew, score faible
          }

          // Si le nombre de participants ne correspond pas, score faible
          if (boat.participants.length !== crew.crew_participants.length) {
            return Math.min(score, 40); // Score réduit si nombre différent
          }

          // Comparer chaque participant
          const boatParticipants = boat.participants
            .filter((p: any) => p.name && p.name.trim())
            .map((p: any) => parseErgRaceName(p.name));
          
          if (boatParticipants.length === 0) {
            return score; // Pas de noms dans les participants, utiliser les autres critères
          }

          const crewParticipants = crew.crew_participants
            .sort((a, b) => a.seat_position - b.seat_position)
            .map((cp) => ({
              lastName: cp.participant.last_name,
              firstName: cp.participant.first_name,
            }));

          const scores: number[] = [];
          for (let i = 0; i < boatParticipants.length; i++) {
            let bestParticipantScore = 0;
            for (const crewPart of crewParticipants) {
              const ergraceFullName = `${boatParticipants[i].lastName}, ${boatParticipants[i].firstName}`;
              const participantScore = compareParticipants(
                ergraceFullName,
                crewPart.lastName,
                crewPart.firstName
              );
              bestParticipantScore = Math.max(bestParticipantScore, participantScore);
            }
            scores.push(bestParticipantScore);
          }

          if (scores.length > 0) {
            const avgParticipantScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            score += (avgParticipantScore * 0.5); // Poids de 50% pour les participants
            if (avgParticipantScore >= 80) {
              criteriaMatched++;
            }
          }
        }

        // Bonus si plusieurs critères correspondent
        if (criteriaMatched >= 2) {
          score += 10;
        }
        if (criteriaMatched === totalCriteria && totalCriteria > 0) {
          score += 20; // Bonus parfait match
        }

        return Math.min(Math.round(score), 100);
      };

      // Initialiser les mappings des équipages
      const initialMappings: BoatMapping[] = parsed.race_definition.boats.map((boat: any) => ({
        ergraceBoat: boat,
        selectedCrewId: null,
      }));

      // Détecter les catégories depuis les boats pour proposer une catégorie pour la course
      const detectedCategories = new Map<string, number>();
      if (parsed.race_definition.boats) {
        parsed.race_definition.boats.forEach((boat: any) => {
          if (boat.class_name && boat.class_name.trim()) {
            const catName = boat.class_name.trim();
            detectedCategories.set(catName, (detectedCategories.get(catName) || 0) + 1);
          }
        });
      }
      
      // Si une seule catégorie est majoritaire, la proposer
      if (detectedCategories.size > 0) {
        const sortedCategories = Array.from(detectedCategories.entries()).sort((a, b) => b[1] - a[1]);
        const mostCommonCategory = sortedCategories[0];
        if (mostCommonCategory[1] >= parsed.race_definition.boats.length * 0.5) {
          // Chercher une catégorie correspondante
          const matchingCategory = categories.find(
            (c) => 
              normalizeName(c.label) === normalizeName(mostCommonCategory[0]) ||
              normalizeName(c.code) === normalizeName(mostCommonCategory[0]) ||
              normalizeName(c.label).includes(normalizeName(mostCommonCategory[0])) ||
              normalizeName(mostCommonCategory[0]).includes(normalizeName(c.label))
          );
          if (matchingCategory && !selectedCategoryId) {
            setSelectedCategoryId(matchingCategory.id);
          }
        }
      }

      // Essayer de faire un auto-matching amélioré
      initialMappings.forEach((mapping) => {
        const boat = mapping.ergraceBoat;

        // Calculer le score pour chaque équipage disponible
        const crewScores = crewsToUse.map((crew) => ({
          crew,
          score: calculateMatchScore(boat, crew),
        }));

        // Trier par score décroissant
        crewScores.sort((a, b) => b.score - a.score);

        // Prendre le meilleur match si le score est >= 50 (seuil abaissé car on a plus de critères)
        const bestMatch = crewScores[0];
        if (bestMatch && bestMatch.score >= 50) {
          mapping.selectedCrewId = bestMatch.crew.id;
          mapping.crew = bestMatch.crew;
          mapping.matchScore = bestMatch.score;
        }
      });

      setBoatMappings(initialMappings);
      setStep("configure");
    } catch (err: any) {
      console.error("Erreur parsing fichier", err);
      toast({
        title: "Erreur de lecture",
        description: err.message || "Impossible de lire le fichier .rac2",
        variant: "destructive",
      });
      setFile(null);
      setRac2Data(null);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === "upload") {
      if (!rac2Data) {
        toast({
          title: "Fichier requis",
          description: "Veuillez d'abord sélectionner un fichier .rac2",
          variant: "destructive",
        });
        return;
      }
      setStep("configure");
    } else if (step === "configure") {
      // Valider la configuration
      if (!raceName.trim()) {
        toast({
          title: "Nom requis",
          description: "Veuillez saisir un nom pour la course",
          variant: "destructive",
        });
        return;
      }
      if (!selectedDistanceId) {
        toast({
          title: "Distance requise",
          description: "Veuillez sélectionner une distance",
          variant: "destructive",
        });
        return;
      }
      if (!selectedCategoryId) {
        toast({
          title: "Catégorie requise",
          description: "Veuillez sélectionner une catégorie",
          variant: "destructive",
        });
        return;
      }
      if (!phaseId) {
        toast({
          title: "Phase requise",
          description: "Veuillez sélectionner une phase",
          variant: "destructive",
        });
        return;
      }
      setStep("map-crews");
    }
  };

  const handleBack = () => {
    if (step === "configure") {
      setStep("upload");
    } else if (step === "map-crews") {
      setStep("configure");
    }
  };

  const handleImport = async () => {
    if (!eventId || !rac2Data) return;

    // Valider que tous les équipages sont mappés
    const unmappedBoats = boatMappings.filter((m) => !m.selectedCrewId);
    if (unmappedBoats.length > 0) {
      toast({
        title: "Équipages manquants",
        description: `${unmappedBoats.length} équipage(s) n'ont pas été mappés. Veuillez les associer à des équipages existants.`,
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      // Préparer les race_crews
      const race_crews = boatMappings
        .filter((m) => m.selectedCrewId)
        .map((m) => ({
          lane: m.ergraceBoat.lane_number,
          crew_id: m.selectedCrewId!,
        }));

      // Déterminer le nombre de couloirs
      const laneCount = Math.max(
        ...boatMappings.map((m) => m.ergraceBoat.lane_number),
        race_crews.length
      );

      // Créer la course
      const racePayload: any = {
        phase_id: phaseId,
        name: raceName,
        race_number: raceNumber,
        distance_id: selectedDistanceId,
        lane_count: laneCount,
        race_type: "course en ligne", // Par défaut pour indoor
      };

      // Ajouter start_time seulement s'il est défini
      if (startTime) {
        racePayload.start_time = new Date(startTime).toISOString();
      }

      const raceRes = await api.post("/races", racePayload);
      const raceId = raceRes.data.data?.id || raceRes.data.id;

      // Créer les race_crews un par un
      if (race_crews.length > 0) {
        await Promise.all(
          race_crews.map((rc) =>
            api.post("/race-crews", {
              race_id: raceId,
              crew_id: rc.crew_id,
              lane: rc.lane,
            })
          )
        );
      }

      toast({
        title: "Course importée",
        description: `La course "${raceName}" a été importée avec succès avec ${race_crews.length} équipage(s).`,
      });

      // Réinitialiser
      handleClose();
      onSuccess();
    } catch (err: any) {
      console.error("Erreur import course", err);
      toast({
        title: "Erreur lors de l'import",
        description: err?.response?.data?.message || err?.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setRac2Data(null);
    setRaceName("");
    setRaceNumber(1);
    setStartTime("");
    setSelectedDistanceId("");
    setSelectedCategoryId("");
    setPhaseId("");
    setBoatMappings([]);
    setSearchQuery("");
    onOpenChange(false);
  };

  const filteredCrews = availableCrews.filter((crew) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const crewName = crew.crew_participants
      .map((cp) => `${cp.participant.last_name} ${cp.participant.first_name}`)
      .join(" ")
      .toLowerCase();
    const clubName = (crew.club_name || "").toLowerCase();
    const categoryLabel = (crew.category?.label || "").toLowerCase();
    return crewName.includes(query) || clubName.includes(query) || categoryLabel.includes(query);
  });

  const getCrewDisplayName = (crew: Crew) => {
    const participants = crew.crew_participants
      .sort((a, b) => a.seat_position - b.seat_position)
      .map((cp) => `${cp.participant.last_name}, ${cp.participant.first_name}`);
    
    const participantsStr = participants.length === 1
      ? participants[0]
      : participants.join(" • ");
    
    const categoryStr = crew.category ? ` (${crew.category.label})` : "";
    const clubStr = crew.club_name ? ` - ${crew.club_name}` : "";
    
    return `${participantsStr}${categoryStr}${clubStr}`;
  };

  // Ne pas afficher le contenu si l'utilisateur n'est pas admin
  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer une course ErgRace</DialogTitle>
          <DialogDescription>
            Importez une course créée dans ErgRace qui n'a pas été créée via le site
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <Label htmlFor="rac2-file" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-700 font-medium">
                  Cliquez pour sélectionner un fichier .rac2
                </span>
                <Input
                  id="rac2-file"
                  type="file"
                  accept=".rac2,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </Label>
              <p className="text-sm text-gray-500 mt-2">
                Format accepté : .rac2 ou .json
              </p>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Lecture du fichier...</span>
              </div>
            )}

            {file && rac2Data && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Fichier chargé : {file.name}
                  <br />
                  {rac2Data.race_definition.boats?.length || 0} équipage(s) détecté(s)
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleNext} disabled={!rac2Data || loading}>
                Suivant
              </Button>
            </div>
          </div>
        )}

        {step === "configure" && rac2Data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="race-name">Nom de la course *</Label>
                <Input
                  id="race-name"
                  value={raceName}
                  onChange={(e) => setRaceName(e.target.value)}
                  placeholder="Ex: Course 1 - 2000m Senior"
                />
              </div>

              <div>
                <Label htmlFor="race-number">Numéro de course *</Label>
                <Input
                  id="race-number"
                  type="number"
                  min="1"
                  value={raceNumber}
                  onChange={(e) => setRaceNumber(parseInt(e.target.value) || 1)}
                />
              </div>

              <div>
                <Label htmlFor="start-time">Heure de départ</Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="phase">Phase *</Label>
                <Select value={phaseId} onValueChange={setPhaseId}>
                  <SelectTrigger id="phase">
                    <SelectValue placeholder="Sélectionner une phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map((phase) => (
                      <SelectItem key={phase.id} value={phase.id}>
                        {phase.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="distance">Distance *</Label>
                <Select value={selectedDistanceId} onValueChange={setSelectedDistanceId}>
                  <SelectTrigger id="distance">
                    <SelectValue placeholder="Sélectionner une distance" />
                  </SelectTrigger>
                  <SelectContent>
                    {distances.map((distance) => (
                      <SelectItem key={distance.id} value={distance.id}>
                        {distance.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Catégorie *</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label} ({category.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Distance détectée depuis le fichier :{" "}
                {rac2Data.race_definition.duration_type === "meters"
                  ? `${rac2Data.race_definition.duration}m`
                  : `${rac2Data.race_definition.duration}s`}
                {selectedDistanceId && (
                  <>
                    {" "}
                    → Distance sélectionnée :{" "}
                    {distances.find((d) => d.id === selectedDistanceId)?.label}
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleBack}>
                Retour
              </Button>
              <Button onClick={handleNext}>Suivant</Button>
            </div>
          </div>
        )}

        {step === "map-crews" && rac2Data && (
          <div className="space-y-4">
            {boatMappings.some((m) => m.matchScore !== undefined && m.matchScore >= 50) && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Détection automatique activée :</strong> Certains équipages ont été automatiquement
                  détectés en comparant le nom du boat, le code club (affiliation), la catégorie et les noms des participants.
                  Vous pouvez supprimer une suggestion en cliquant sur "Supprimer la suggestion" ou supprimer une ligne complète avec l'icône X.
                  Vérifiez que les correspondances sont correctes avant de valider l'import.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="search-crews">Rechercher un équipage</Label>
              <Input
                id="search-crews"
                placeholder="Nom, club, catégorie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-4">
                {boatMappings.map((mapping, index) => (
                  <Card key={index} className={mapping.selectedCrewId ? "border-green-200 bg-green-50/30" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm">
                            Couloir {mapping.ergraceBoat.lane_number} - {mapping.ergraceBoat.name || "Sans nom"}
                          </CardTitle>
                          {mapping.ergraceBoat.affiliation && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">
                              {mapping.ergraceBoat.affiliation}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {mapping.matchScore !== undefined && mapping.matchScore >= 50 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                              Auto-détecté ({mapping.matchScore}%)
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = [...boatMappings];
                              updated.splice(index, 1);
                              setBoatMappings(updated);
                            }}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {mapping.ergraceBoat.class_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          Catégorie ErgRace: {mapping.ergraceBoat.class_name}
                        </p>
                      )}
                      {mapping.ergraceBoat.participants && mapping.ergraceBoat.participants.length > 0 && mapping.ergraceBoat.participants.some((p: any) => p.name && p.name.trim()) && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Participants ErgRace:</p>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            {mapping.ergraceBoat.participants
                              .filter((p: any) => p.name && p.name.trim())
                              .map((p: any, pIndex: number) => (
                                <div key={pIndex} className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                  <span>{p.name}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      {(!mapping.ergraceBoat.participants || mapping.ergraceBoat.participants.length === 0 || !mapping.ergraceBoat.participants.some((p: any) => p.name && p.name.trim())) && (
                        <p className="text-xs text-gray-500 mt-1">
                          Nom boat: {mapping.ergraceBoat.name || "N/A"}
                          {mapping.ergraceBoat.affiliation && ` • Club: ${mapping.ergraceBoat.affiliation}`}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Associer à un équipage existant *</Label>
                        {mapping.selectedCrewId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = [...boatMappings];
                              updated[index].selectedCrewId = null;
                              updated[index].crew = undefined;
                              updated[index].matchScore = undefined;
                              setBoatMappings(updated);
                            }}
                            className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Supprimer la suggestion
                          </Button>
                        )}
                      </div>
                      <Select
                        value={mapping.selectedCrewId || ""}
                        onValueChange={(value) => {
                          const updated = [...boatMappings];
                          updated[index].selectedCrewId = value;
                          updated[index].crew = availableCrews.find((c) => c.id === value);
                          updated[index].matchScore = undefined; // Réinitialiser le score si sélection manuelle
                          setBoatMappings(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un équipage" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCrews.map((crew) => (
                            <SelectItem key={crew.id} value={crew.id}>
                              {getCrewDisplayName(crew)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mapping.crew && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-green-600 font-medium">
                            ✓ Équipage sélectionné : {getCrewDisplayName(mapping.crew)}
                          </div>
                          {mapping.crew.crew_participants && mapping.crew.crew_participants.length > 0 && (
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Participants système:</span>
                              <div className="mt-0.5 space-y-0.5">
                                {mapping.crew.crew_participants
                                  .sort((a, b) => a.seat_position - b.seat_position)
                                  .map((cp, cpIndex) => (
                                    <div key={cpIndex} className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                      <span>
                                        {cp.participant.last_name}, {cp.participant.first_name}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {boatMappings.filter((m) => !m.selectedCrewId).length} équipage(s) non mappé(s) sur{" "}
                {boatMappings.length} total
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleBack} disabled={importing}>
                Retour
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  "Importer la course"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

