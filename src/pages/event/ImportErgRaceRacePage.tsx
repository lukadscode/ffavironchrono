import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, AlertCircle, CheckCircle2, ArrowLeft, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";

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
  matchScore?: number;
}

export default function ImportErgRaceRacePage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Rediriger si pas admin
  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Accès refusé",
        description: "Cette fonctionnalité est réservée aux administrateurs.",
        variant: "destructive",
      });
      navigate(`/event/${eventId}/indoor`);
    }
  }, [isAdmin, eventId, navigate, toast]);

  const [step, setStep] = useState<"upload" | "map-crews" | "configure">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [rac2Data, setRac2Data] = useState<Rac2File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Configuration de la course
  const [raceName, setRaceName] = useState("");
  const [raceNumber, setRaceNumber] = useState(1);
  const [startTime, setStartTime] = useState("");
  const [selectedDistanceId, setSelectedDistanceId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");

  // Données disponibles
  const [distances, setDistances] = useState<Distance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [phases, setPhases] = useState<Array<{ id: string; name: string }>>([]);
  const [availableCrews, setAvailableCrews] = useState<Crew[]>([]);

  // Mapping des équipages
  const [boatMappings, setBoatMappings] = useState<BoatMapping[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [crewSearchQueries, setCrewSearchQueries] = useState<Record<number, string>>({});
  const [openSelects, setOpenSelects] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (eventId) {
      fetchDistances();
      fetchCategories();
      fetchPhases();
      fetchAvailableCrews();
    }
  }, [eventId]);

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
      
      // Enrichir chaque crew avec ses participants
      const crewsWithParticipants = await Promise.all(
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
      
      setAvailableCrews(crewsWithParticipants);
    } catch (err) {
      console.error("Erreur chargement équipages", err);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

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
        const matchingDistance = distances.find((d) => d.meters === duration);
        if (matchingDistance) {
          setSelectedDistanceId(matchingDistance.id);
        }
      } else if (durationType === "time") {
        const matchingDistance = distances.find(
          (d) => d.is_time_based && d.duration_seconds === duration
        );
        if (matchingDistance) {
          setSelectedDistanceId(matchingDistance.id);
        }
      }

      // Attendre que les équipages soient chargés avant de faire le matching
      let crewsToUse = availableCrews;
      if (crewsToUse.length === 0) {
        try {
          const res = await api.get(`/crews/event/${eventId}`);
          const crewsData = res.data.data || [];
          
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
          
          setAvailableCrews(crewsToUse);
        } catch (err) {
          console.error("Erreur chargement équipages", err);
        }
      }

      // Fonction pour normaliser un nom
      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      };

      // Fonction pour parser un nom ErgRace
      const parseErgRaceName = (name: string): { lastName: string; firstName: string } => {
        const normalized = normalizeName(name);
        if (normalized.includes(",")) {
          const parts = normalized.split(",").map((p) => p.trim());
          return {
            lastName: parts[0] || "",
            firstName: parts[1] || "",
          };
        }
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

        if (
          normalizedErgraceLast === normalizedCrewLast &&
          normalizedErgraceFirst === normalizedCrewFirst
        ) {
          return 100;
        }

        if (normalizedErgraceLast === normalizedCrewLast) {
          if (
            normalizedErgraceFirst &&
            normalizedCrewFirst &&
            (normalizedCrewFirst.startsWith(normalizedErgraceFirst) ||
              normalizedErgraceFirst.startsWith(normalizedCrewFirst))
          ) {
            return 80;
          }
          return 50;
        }

        if (
          normalizedErgraceLast === normalizedCrewFirst &&
          normalizedErgraceFirst === normalizedCrewLast
        ) {
          return 90;
        }

        if (
          normalizedCrewLast.includes(normalizedErgraceLast) ||
          normalizedErgraceLast.includes(normalizedCrewLast)
        ) {
          return 30;
        }

        return 0;
      };

      // Fonction pour extraire tous les noms possibles d'un boat ErgRace
      const extractBoatNames = (boat: any): string[] => {
        const names: string[] = [];
        
        if (boat.name && boat.name.trim()) {
          names.push(boat.name.trim());
        }
        
        if (boat.participants && Array.isArray(boat.participants)) {
          boat.participants.forEach((p: any) => {
            if (p.name && p.name.trim()) {
              names.push(p.name.trim());
            }
          });
        }
        
        return names;
      };

      // Fonction pour calculer le score de correspondance
      const calculateMatchScore = (boat: any, crew: Crew): number => {
        let score = 0;
        let criteriaMatched = 0;
        let perfectMatch = false;

        const boatNames = extractBoatNames(boat);
        
        if (boatNames.length === 0 || !crew.crew_participants || crew.crew_participants.length === 0) {
          return 0;
        }

        let bestNameMatch = 0;
        let nameMatches = 0;
        
        for (const boatName of boatNames) {
          const normalizedBoatName = normalizeName(boatName);
          
          for (const cp of crew.crew_participants) {
            const crewLastName = normalizeName(cp.participant.last_name);
            const crewFirstName = normalizeName(cp.participant.first_name);
            const crewFullName = normalizeName(`${cp.participant.first_name} ${cp.participant.last_name}`);
            const crewReversedName = normalizeName(`${cp.participant.last_name} ${cp.participant.first_name}`);
            
            const parsedBoatName = parseErgRaceName(boatName);
            const normalizedBoatLastName = normalizeName(parsedBoatName.lastName);
            const normalizedBoatFirstName = normalizeName(parsedBoatName.firstName);
            
            if (normalizedBoatLastName && normalizedBoatLastName === crewLastName) {
              if (normalizedBoatFirstName && normalizedBoatFirstName === crewFirstName) {
                bestNameMatch = Math.max(bestNameMatch, 100);
                perfectMatch = true;
                nameMatches++;
              } else if (!normalizedBoatFirstName || normalizedBoatFirstName === "") {
                bestNameMatch = Math.max(bestNameMatch, 80);
                perfectMatch = true;
                nameMatches++;
              } else {
                bestNameMatch = Math.max(bestNameMatch, 60);
                nameMatches++;
              }
            } else if (normalizedBoatLastName && (
              crewLastName.includes(normalizedBoatLastName) || 
              normalizedBoatLastName.includes(crewLastName)
            )) {
              bestNameMatch = Math.max(bestNameMatch, 50);
            } else if (
              normalizedBoatName === crewLastName ||
              normalizedBoatName === crewFullName ||
              normalizedBoatName === crewReversedName ||
              crewLastName.includes(normalizedBoatName) ||
              normalizedBoatName.includes(crewLastName)
            ) {
              bestNameMatch = Math.max(bestNameMatch, 70);
              perfectMatch = true;
              nameMatches++;
            }
          }
        }

        if (bestNameMatch > 0) {
          score = bestNameMatch;
          criteriaMatched++;
        } else {
          return 0;
        }

        if (boatNames.length > 1 && crew.crew_participants.length > 1) {
          if (nameMatches >= Math.min(boatNames.length, crew.crew_participants.length)) {
            score += 10;
          }
        }

        if (boat.affiliation && boat.affiliation.trim() && perfectMatch) {
          const boatAffiliation = normalizeName(boat.affiliation);
          const crewClubCode = normalizeName(crew.club_code || "");
          
          if (boatAffiliation === crewClubCode) {
            score += 10;
            criteriaMatched++;
          }
        }

        if (perfectMatch) {
          score = Math.min(score + 5, 100);
        }

        return Math.min(Math.round(score), 100);
      };

      // Initialiser les mappings
      const initialMappings: BoatMapping[] = parsed.race_definition.boats.map((boat: any) => ({
        ergraceBoat: boat,
        selectedCrewId: null,
      }));

      // Faire le matching
      initialMappings.forEach((mapping) => {
        const boat = mapping.ergraceBoat;
        const crewScores = crewsToUse.map((crew) => ({
          crew,
          score: calculateMatchScore(boat, crew),
        }));

        crewScores.sort((a, b) => b.score - a.score);
        const bestMatch = crewScores[0];
        const secondBest = crewScores[1];
        
        if (bestMatch && (
          bestMatch.score >= 40 || 
          (bestMatch.score >= 30 && (!secondBest || bestMatch.score - secondBest.score >= 20))
        )) {
          mapping.selectedCrewId = bestMatch.crew.id;
          mapping.crew = bestMatch.crew;
          mapping.matchScore = bestMatch.score;
        }
      });

      setBoatMappings(initialMappings);
      setStep("map-crews");
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
    } else if (step === "map-crews") {
      const mappedCount = boatMappings.filter((m) => m.selectedCrewId).length;
      if (mappedCount === 0) {
        toast({
          title: "Aucun équipage mappé",
          description: "Veuillez mapper au moins un équipage avant de continuer",
          variant: "destructive",
        });
        return;
      }
      setStep("configure");
    }
  };

  const handleBack = () => {
    if (step === "map-crews") {
      setStep("upload");
    } else if (step === "configure") {
      setStep("map-crews");
    }
  };

  const handleImport = async () => {
    if (!eventId || !rac2Data) return;

    const unmappedBoats = boatMappings.filter((m) => !m.selectedCrewId);
    if (unmappedBoats.length > 0) {
      toast({
        title: "Équipages manquants",
        description: `${unmappedBoats.length} équipage(s) n'ont pas été mappés. Veuillez les associer à des équipages existants.`,
        variant: "destructive",
      });
      return;
    }

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
    if (!phaseId) {
      toast({
        title: "Phase requise",
        description: "Veuillez sélectionner une phase",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const race_crews = boatMappings
        .filter((m) => m.selectedCrewId)
        .map((m) => ({
          lane: m.ergraceBoat.lane_number,
          crew_id: m.selectedCrewId!,
        }));

      const laneCount = Math.max(
        ...boatMappings.map((m) => m.ergraceBoat.lane_number),
        race_crews.length
      );

      const racePayload: any = {
        phase_id: phaseId,
        name: raceName,
        race_number: raceNumber,
        distance_id: selectedDistanceId,
        lane_count: laneCount,
        race_type: "course en ligne",
      };

      if (startTime) {
        racePayload.start_time = new Date(startTime).toISOString();
      }

      const raceRes = await api.post("/races", racePayload);
      const raceId = raceRes.data.data?.id || raceRes.data.id;

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

      navigate(`/event/${eventId}/indoor`);
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

  // Récupérer les catégories détectées
  const detectedCategoriesMap = new Map<string, { count: number; label: string; code: string }>();
  boatMappings.forEach((mapping) => {
    if (mapping.crew && mapping.crew.category) {
      const catId = mapping.crew.category.id;
      const existing = detectedCategoriesMap.get(catId);
      if (existing) {
        existing.count++;
      } else {
        detectedCategoriesMap.set(catId, {
          count: 1,
          label: mapping.crew.category.label,
          code: mapping.crew.category.code,
        });
      }
    }
  });
  const detectedCategoriesList = Array.from(detectedCategoriesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/event/${eventId}/indoor`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Importer une course ErgRace</h1>
              <p className="text-sm text-gray-500 mt-1">
                Importez une course créée dans ErgRace qui n'a pas été créée via le site
              </p>
            </div>
          </div>
        </div>

        {/* Étape 1: Upload */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>Étape 1/2 : Upload du fichier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <Label htmlFor="rac2-file" className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-700 font-medium text-lg">
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
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mr-3" />
                  <span className="text-lg">Lecture du fichier...</span>
                </div>
              )}

              {file && rac2Data && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Fichier chargé :</strong> {file.name}
                    <br />
                    {rac2Data.race_definition.boats?.length || 0} équipage(s) détecté(s)
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => navigate(`/event/${eventId}/indoor`)}>
                  Annuler
                </Button>
                <Button onClick={handleNext} disabled={!rac2Data || loading}>
                  Suivant →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Étape 2: Mapping des équipages */}
        {step === "map-crews" && rac2Data && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Étape 2/3 : Mapping des équipages</CardTitle>
                <div className="text-sm text-gray-500">
                  {boatMappings.filter((m) => m.selectedCrewId).length} / {boatMappings.length} équipage(s) mappé(s)
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {boatMappings.some((m) => m.matchScore !== undefined && m.matchScore >= 30) && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Affectation intelligente activée :</strong> Les équipages ont été automatiquement
                    affectés en comparant les noms du fichier ErgRace avec les noms des participants dans le système.
                    <strong> Vérifiez chaque suggestion et invalidez-la si ce n'est pas correct</strong> en cliquant sur "Supprimer la suggestion".
                    Vous pouvez aussi supprimer une ligne complète avec l'icône X.
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
                  className="max-w-md"
                />
              </div>

              <ScrollArea className="h-[calc(100vh-450px)] border rounded-lg p-4">
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
                            {mapping.matchScore !== undefined && mapping.matchScore >= 30 && (
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                mapping.matchScore >= 70 
                                  ? "bg-green-100 text-green-700" 
                                  : mapping.matchScore >= 50
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}>
                                Auto-affecté ({mapping.matchScore}%)
                                {mapping.matchScore >= 70 ? " ✓" : mapping.matchScore < 50 ? " ⚠️" : ""}
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
                            updated[index].matchScore = undefined;
                            setBoatMappings(updated);
                            // Fermer le select après sélection
                            setOpenSelects(prev => ({ ...prev, [index]: false }));
                            // Réinitialiser la recherche
                            setCrewSearchQueries(prev => ({ ...prev, [index]: "" }));
                          }}
                          open={openSelects[index] || false}
                          onOpenChange={(open) => {
                            setOpenSelects(prev => ({ ...prev, [index]: open }));
                            if (!open) {
                              // Réinitialiser la recherche quand on ferme
                              setCrewSearchQueries(prev => ({ ...prev, [index]: "" }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un équipage" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[500px] p-0">
                            {/* Zone de recherche */}
                            <div className="sticky top-0 z-10 bg-background border-b p-2">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Rechercher un équipage..."
                                  value={crewSearchQueries[index] || ""}
                                  onChange={(e) => {
                                    setCrewSearchQueries(prev => ({ ...prev, [index]: e.target.value }));
                                    if (!openSelects[index]) {
                                      setOpenSelects(prev => ({ ...prev, [index]: true }));
                                    }
                                  }}
                                  className="pl-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenSelects(prev => ({ ...prev, [index]: true }));
                                  }}
                                  onFocus={() => setOpenSelects(prev => ({ ...prev, [index]: true }))}
                                />
                              </div>
                            </div>
                            
                            {/* Liste filtrée */}
                            <ScrollArea className="max-h-[400px]">
                              {availableCrews
                                .filter((crew) => {
                                  const query = (crewSearchQueries[index] || "").toLowerCase();
                                  if (!query.trim()) return true;
                                  const crewName = crew.crew_participants
                                    .map((cp) => `${cp.participant.last_name} ${cp.participant.first_name}`)
                                    .join(" ")
                                    .toLowerCase();
                                  const clubName = (crew.club_name || "").toLowerCase();
                                  const categoryLabel = (crew.category?.label || "").toLowerCase();
                                  return crewName.includes(query) || clubName.includes(query) || categoryLabel.includes(query);
                                })
                                .map((crew) => (
                                  <SelectItem key={crew.id} value={crew.id}>
                                    {getCrewDisplayName(crew)}
                                  </SelectItem>
                                ))}
                              {availableCrews.filter((crew) => {
                                const query = (crewSearchQueries[index] || "").toLowerCase();
                                if (!query.trim()) return true;
                                const crewName = crew.crew_participants
                                  .map((cp) => `${cp.participant.last_name} ${cp.participant.first_name}`)
                                  .join(" ")
                                  .toLowerCase();
                                const clubName = (crew.club_name || "").toLowerCase();
                                const categoryLabel = (crew.category?.label || "").toLowerCase();
                                return crewName.includes(query) || clubName.includes(query) || categoryLabel.includes(query);
                              }).length === 0 && (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                  Aucun équipage trouvé
                                </div>
                              )}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                        {mapping.crew && (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md space-y-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-semibold text-green-800">Équipage sélectionné</span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {/* Club */}
                              <div>
                                <span className="font-medium text-gray-700">Club:</span>
                                <div className="mt-0.5">
                                  <span className="text-gray-800">{mapping.crew.club_name || "Non renseigné"}</span>
                                  {mapping.crew.club_code && (
                                    <span className="ml-1 text-gray-500">({mapping.crew.club_code})</span>
                                  )}
                                </div>
                              </div>

                              {/* Catégorie */}
                              {mapping.crew.category && (
                                <div>
                                  <span className="font-medium text-gray-700">Catégorie:</span>
                                  <div className="mt-0.5">
                                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                      {mapping.crew.category.label} ({mapping.crew.category.code})
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Nombre de participants */}
                              <div>
                                <span className="font-medium text-gray-700">Nombre de participants:</span>
                                <div className="mt-0.5 text-gray-800">
                                  {mapping.crew.crew_participants?.length || 0} participant{mapping.crew.crew_participants?.length !== 1 ? "s" : ""}
                                </div>
                              </div>

                              {/* Couloir assigné */}
                              <div>
                                <span className="font-medium text-gray-700">Couloir ErgRace:</span>
                                <div className="mt-0.5 text-gray-800 font-semibold">
                                  {mapping.ergraceBoat.lane_number}
                                </div>
                              </div>
                            </div>

                            {/* Participants détaillés */}
                            {mapping.crew.crew_participants && mapping.crew.crew_participants.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-green-200">
                                <span className="text-xs font-medium text-gray-700 mb-1.5 block">Participants:</span>
                                <div className="space-y-1">
                                  {mapping.crew.crew_participants
                                    .sort((a, b) => a.seat_position - b.seat_position)
                                    .map((cp, cpIndex) => (
                                      <div key={cpIndex} className="flex items-center gap-2 text-xs">
                                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-200 text-green-700 font-semibold text-xs">
                                          {cp.seat_position}
                                        </div>
                                        <span className="text-gray-700">
                                          <span className="font-medium">{cp.participant.last_name}</span>, {cp.participant.first_name}
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

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleBack} disabled={importing}>
                  ← Retour
                </Button>
                <Button onClick={handleNext} disabled={importing || boatMappings.filter((m) => m.selectedCrewId).length === 0}>
                  Suivant → Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Étape 3: Configuration */}
        {step === "configure" && rac2Data && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Étape 3/3 : Configuration de la course</CardTitle>
                <div className="text-sm text-gray-500">
                  {boatMappings.filter((m) => m.selectedCrewId).length} équipage(s) à importer
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Affichage informatif des catégories détectées */}
              {detectedCategoriesList.length > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>
                        <strong>Catégories détectées depuis les équipages matchés :</strong>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {detectedCategoriesList.map((cat) => (
                          <div
                            key={cat.id}
                            className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 border border-blue-300"
                          >
                            {cat.label} ({cat.code}) - {cat.count} équipage{cat.count > 1 ? "s" : ""}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Les catégories de la course seront automatiquement déterminées par les catégories des équipages participants.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

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

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleBack} disabled={importing}>
                  ← Retour
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

