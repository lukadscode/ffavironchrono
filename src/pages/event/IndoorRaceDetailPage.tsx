import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import dayjs from "dayjs";
import { ArrowLeft, Download, Upload, FileText, File, AlertTriangle, Save, Trophy, Clock, TrendingUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NotificationDisplay from "@/components/notifications/NotificationDisplay";
import { useAuth } from "@/context/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";

type Category = {
  id: string;
  code: string;
  label: string;
  age_group: string;
  gender: string;
  boat_seats: number;
  has_coxswain: boolean;
  distance_id?: string | null;
  distance?: {
    id: string;
    meters: number;
    is_relay?: boolean;
    relay_count?: number;
    label?: string;
  } | null;
};

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  gender: string;
  email: string | null;
  club_name: string | null;
};

type CrewParticipant = {
  id: string;
  crew_id: string;
  participant_id: string;
  is_coxswain: boolean;
  coxswain_weight: number | null;
  seat_position: number;
  participant: Participant;
};

type RaceCrew = {
  id: string;
  race_id: string;
  crew_id: string;
  lane: number;
  status: string | null;
  crew: {
    id: string;
    event_id: string;
    category_id: string;
    status: number;
    club_name: string;
    club_code: string;
    coach_name: string | null;
    category: Category;
    crew_participants: CrewParticipant[];
  };
};

type Distance = {
  id: string;
  meters: number;
  is_relay?: boolean | number;
  relay_count?: number;
  label?: string; // Label formaté depuis l'API (ex: "8x250m" ou "2000m")
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  lane_count?: number;
  distance_id?: string;
  distance?: Distance;
  race_phase?: {
    id: string;
    name: string;
  };
  race_crews: RaceCrew[];
};

type Event = {
  id: string;
  name: string;
};

type TimingPoint = {
  id: string;
  label: string;
  order_index: number;
  distance_m: number;
};

// Types pour les résultats indoor ErgRace
type IndoorParticipantResult = {
  id: string;
  place: number;
  time_display: string;
  time_ms: number;
  score: string;
  distance: number;
  avg_pace: string;
  spm: number;
  calories: number;
  machine_type: string;
  logged_time: string;
  ergrace_participant_id: string;
  crew_id?: string | null;
  crew?: {
    id: string;
    club_name: string;
    club_code: string;
    category?: {
      id: string;
      code: string;
      label: string;
    };
  } | null;
  splits_data?: any;
};

type IndoorRaceResult = {
  id: string;
  race_id: string;
  ergrace_race_id: string;
  race_start_time: string;
  race_end_time: string;
  duration: number;
  raw_data?: any; // JSON brut ErgRace
};

type IndoorResultsData = {
  race_result: IndoorRaceResult;
  participants: IndoorParticipantResult[];
};

export default function IndoorRaceDetailPage() {
  const { eventId, raceId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [race, setRace] = useState<Race | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [distance, setDistance] = useState<number>(500); // Par défaut 500m pour indoor
  const [raceDistance, setRaceDistance] = useState<Distance | null>(null);
  const [availableDistances, setAvailableDistances] = useState<Distance[]>([]);
  const [selectedDistanceId, setSelectedDistanceId] = useState<string>("");
  const [isSuggestedDistance, setIsSuggestedDistance] = useState(false); // Indique si la distance est suggérée automatiquement
  const [isSavingDistance, setIsSavingDistance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDraggingTxtJson, setIsDraggingTxtJson] = useState(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const fileInputTxtJsonRef = useRef<HTMLInputElement>(null);
  const fileInputPdfRef = useRef<HTMLInputElement>(null);
  const [indoorResults, setIndoorResults] = useState<IndoorResultsData | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [importingResults, setImportingResults] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false);

  useEffect(() => {
    if (raceId && eventId) {
      fetchEvent();
      // Charger d'abord les distances, puis la course pour pouvoir suggérer
      fetchDistances().then(() => {
        fetchRace();
      });
      // fetchDistance est appelé seulement comme fallback si la course n'a pas de distance_id
      // On le garde pour les anciennes courses qui n'ont pas de distance_id
      
      // Charger les résultats indoor s'ils existent
      fetchIndoorResults();
    }
  }, [raceId, eventId]);

  const fetchDistances = async () => {
    try {
      const res = await api.get(`/distances/event/${eventId}`);
      const distances = res.data.data || [];
      setAvailableDistances(distances);
      
      // Si la course est déjà chargée et n'a pas de distance, suggérer une
      if (race && !race.distance_id && !race.distance && race.race_crews.length > 0 && !selectedDistanceId) {
        const suggestedDistanceId = suggestDistanceFromCrews(race.race_crews, distances);
        if (suggestedDistanceId) {
          setSelectedDistanceId(suggestedDistanceId);
          setIsSuggestedDistance(true); // C'est une suggestion automatique
          console.log(`✅ Distance suggérée pré-sélectionnée (après chargement distances): ${suggestedDistanceId}`);
        } else {
          setIsSuggestedDistance(false); // Pas de suggestion trouvée
        }
      }
    } catch (err) {
      console.error("Erreur chargement distances", err);
    }
  };

  // Fonction pour suggérer une distance en fonction des équipages
  const suggestDistanceFromCrews = (raceCrews: RaceCrew[], availableDistances: Distance[]): string | null => {
    if (!raceCrews || raceCrews.length === 0 || !availableDistances || availableDistances.length === 0) {
      return null;
    }

    // Récupérer les distances des catégories des équipages
    const crewDistances: { distanceId: string | null; meters: number | null; isRelay: boolean; relayCount: number | null }[] = [];
    
    for (const raceCrew of raceCrews) {
      const crew = raceCrew.crew;
      // Vérifier si la catégorie a une distance
      if (crew.category?.distance_id || crew.category?.distance?.id) {
        const categoryDistanceId = crew.category.distance_id || crew.category.distance?.id;
        const categoryDistance = crew.category.distance;
        
        if (categoryDistance) {
          crewDistances.push({
            distanceId: categoryDistanceId || null,
            meters: categoryDistance.meters || null,
            isRelay: categoryDistance.is_relay === true || (typeof categoryDistance.is_relay === 'number' && categoryDistance.is_relay === 1),
            relayCount: categoryDistance.relay_count || null,
          });
        }
      }
    }

    if (crewDistances.length === 0) {
      return null;
    }

    // Compter les occurrences de chaque distance
    const distanceCounts = new Map<string, number>();
    
    for (const crewDist of crewDistances) {
      if (crewDist.distanceId) {
        distanceCounts.set(crewDist.distanceId, (distanceCounts.get(crewDist.distanceId) || 0) + 1);
      }
    }

    // Trouver la distance la plus fréquente
    let mostCommonDistanceId: string | null = null;
    let maxCount = 0;
    
    for (const [distanceId, count] of distanceCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDistanceId = distanceId;
      }
    }

    // Si on trouve une distance fréquente et qu'elle existe dans les distances disponibles
    if (mostCommonDistanceId && availableDistances.find(d => d.id === mostCommonDistanceId)) {
      console.log(`💡 Distance suggérée: ${mostCommonDistanceId} (trouvée dans ${maxCount} équipage(s))`);
      return mostCommonDistanceId;
    }

    // Sinon, essayer de trouver par correspondance de mètres et is_relay
    const firstCrewDist = crewDistances[0];
    if (firstCrewDist.meters !== null) {
      const matchingDistance = availableDistances.find(d => {
        const metersMatch = d.meters === firstCrewDist.meters;
        const relayMatch = (d.is_relay === true) === firstCrewDist.isRelay;
        const relayCountMatch = !firstCrewDist.isRelay || d.relay_count === firstCrewDist.relayCount;
        
        return metersMatch && relayMatch && relayCountMatch;
      });

      if (matchingDistance) {
        console.log(`💡 Distance suggérée par correspondance: ${matchingDistance.id} (${matchingDistance.meters}m, relay: ${matchingDistance.is_relay})`);
        return matchingDistance.id;
      }
    }

    return null;
  };

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      setEvent(res.data.data);
    } catch (err) {
      console.error("Erreur chargement événement", err);
    }
  };

  const fetchDistance = async () => {
    // Ne récupérer depuis les timing points que si aucune distance n'a été définie via la course
    // Cette fonction sert de fallback pour les anciennes courses
    if (raceDistance) {
      return; // La distance a déjà été récupérée depuis la course
    }
    try {
      const res = await api.get(`/timing-points/event/${eventId}`);
      const timingPoints = res.data.data || [];
      if (timingPoints.length > 0) {
        // Trier par order_index et prendre le dernier (finish)
        const sorted = timingPoints.sort((a: TimingPoint, b: TimingPoint) => 
          (b.order_index || 0) - (a.order_index || 0)
        );
        const lastPoint = sorted[0];
        if (lastPoint?.distance_m) {
          setDistance(lastPoint.distance_m);
        }
      }
    } catch (err) {
      console.error("Erreur chargement distance", err);
    }
  };

  const fetchRace = async () => {
    try {
      const raceRes = await api.get(`/races/${raceId}`);
      const raceData = raceRes.data.data;

      const raceCrewsRes = await api.get(`/race-crews/${raceId}`);
      const raceCrews = raceCrewsRes.data.data || [];

      // Récupérer la distance de la course si elle existe
      let distanceData: Distance | null = null;
      
      // Vérifier si la distance est déjà dans raceData.distance
      if (raceData.distance) {
        distanceData = raceData.distance;
      } else if (raceData.distance_id) {
        // Sinon, récupérer toutes les distances de l'événement et trouver celle correspondante
        try {
          const distancesRes = await api.get(`/distances/event/${eventId}`);
          const allDistances = distancesRes.data.data || [];
          distanceData = allDistances.find((d: Distance) => d.id === raceData.distance_id) || null;
          
          if (!distanceData) {
            console.warn(`Distance ${raceData.distance_id} non trouvée dans les distances de l'événement`);
          }
        } catch (err) {
          console.error("Erreur chargement distances", err);
        }
      }

      // Mettre à jour l'état de la distance
      if (distanceData) {
        console.log("📏 Distance récupérée:", distanceData);
        setRaceDistance(distanceData);
        // Utiliser la distance de la course au lieu des timing points
        // Vérifier is_relay (peut être 0/1 ou true/false selon l'API)
        const isRelay = distanceData.is_relay === true || (typeof distanceData.is_relay === 'number' && distanceData.is_relay === 1);
        if (isRelay && distanceData.relay_count) {
          // Pour un relais, la distance totale = meters * relay_count
          const totalDist = distanceData.meters * distanceData.relay_count;
          console.log(`🔄 Relais détecté: ${distanceData.relay_count}x${distanceData.meters}m = ${totalDist}m`);
          setDistance(totalDist);
        } else {
          console.log(`📏 Course normale: ${distanceData.meters}m`);
          setDistance(distanceData.meters);
        }
      } else {
        console.warn("⚠️ Aucune distance trouvée pour la course. distance_id:", raceData.distance_id);
        // Fallback : utiliser fetchDistance pour récupérer depuis les timing points
        fetchDistance();
      }

      setRace({
        ...raceData,
        distance: distanceData || raceData.distance,
        race_crews: raceCrews.sort((a: RaceCrew, b: RaceCrew) => a.lane - b.lane),
      });

      // Mettre à jour la distance sélectionnée dans le formulaire
      if (distanceData) {
        setSelectedDistanceId(distanceData.id);
        setIsSuggestedDistance(false); // Distance existante, pas une suggestion
      } else if (raceData.distance_id) {
        setSelectedDistanceId(raceData.distance_id);
        setIsSuggestedDistance(false); // Distance existante, pas une suggestion
      } else {
        // Suggérer une distance en fonction des équipages
        // Si availableDistances n'est pas encore chargé, attendre un peu et réessayer
        if (availableDistances.length > 0) {
          const suggestedDistanceId = suggestDistanceFromCrews(raceCrews, availableDistances);
          if (suggestedDistanceId) {
            setSelectedDistanceId(suggestedDistanceId);
            setIsSuggestedDistance(true); // C'est une suggestion automatique
            console.log(`✅ Distance suggérée pré-sélectionnée: ${suggestedDistanceId}`);
          } else {
            setSelectedDistanceId("");
            setIsSuggestedDistance(false); // Pas de suggestion trouvée
          }
        } else {
          // Si les distances ne sont pas encore chargées, la suggestion sera faite dans fetchDistances
          setSelectedDistanceId("");
          setIsSuggestedDistance(false);
        }
      }
    } catch (err) {
      console.error("Erreur chargement course", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDistance = async () => {
    if (!raceId || !selectedDistanceId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une distance",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingDistance(true);
      await api.put(`/races/${raceId}`, {
        distance_id: selectedDistanceId,
      });

      // Recharger les données de la course
      await fetchRace();
      await fetchDistances(); // Recharger aussi les distances au cas où

      toast({
        title: "Distance enregistrée",
        description: "La distance de la course a été mise à jour avec succès",
      });
    } catch (err: any) {
      console.error("Erreur sauvegarde distance", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de sauvegarder la distance",
        variant: "destructive",
      });
    } finally {
      setIsSavingDistance(false);
    }
  };

  // Charger les résultats indoor depuis l'API
  const fetchIndoorResults = async () => {
    if (!raceId) return;

    try {
      setLoadingResults(true);
      const response = await api.get(`/indoor-results/race/${raceId}`);
      setIndoorResults(response.data.data);
    } catch (err: any) {
      // 404 signifie qu'il n'y a pas encore de résultats, c'est normal
      if (err?.response?.status !== 404) {
        console.error("Erreur chargement résultats indoor:", err);
      }
      setIndoorResults(null);
    } finally {
      setLoadingResults(false);
    }
  };

  // Importer les résultats ErgRace depuis un fichier JSON
  const handleImportErgRaceResults = async (file: File) => {
    if (!raceId) {
      toast({
        title: "Erreur",
        description: "Impossible d'importer : course introuvable",
        variant: "destructive",
      });
      return;
    }

    try {
      setImportingResults(true);
      
      // Lire le contenu du fichier
      const fileContent = await file.text();
      let ergraceData: any;
      
      try {
        ergraceData = JSON.parse(fileContent);
      } catch (parseError) {
        toast({
          title: "Erreur de format",
          description: "Le fichier JSON n'est pas valide",
          variant: "destructive",
        });
        return;
      }

      // Vérifier que c'est bien un fichier ErgRace
      if (!ergraceData.results || !ergraceData.results.race_id) {
        toast({
          title: "Format invalide",
          description: "Le fichier ne semble pas être un fichier ErgRace valide",
          variant: "destructive",
        });
        return;
      }

      // Préparer le payload pour l'API
      const payload = {
        results: {
          ...ergraceData.results,
          c2_race_id: raceId, // ID de la course dans la plateforme
        },
      };

      const response = await api.post("/indoor-results/import", payload);

      // Mettre la course en statut "non_official" pour validation par les arbitres
      try {
        await api.put(`/races/${raceId}`, { status: "non_official" });
      } catch (statusErr: any) {
        console.error("Erreur mise à jour statut course:", statusErr);
        // Ne pas bloquer si la mise à jour du statut échoue
      }

      toast({
        title: "Résultats importés",
        description: `${response.data.data.participants_count} participant(s) importé(s) (${response.data.data.linked_crews_count} équipage(s) lié(s)). La course est en attente de validation par les arbitres.`,
      });

      // Recharger les résultats et la course
      await fetchIndoorResults();
      await fetchRace();
    } catch (err: any) {
      console.error("Erreur import résultats ErgRace:", err);
      const errorData = err?.response?.data;
      
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        toast({
          title: "Erreurs de validation",
          description: errorData.errors.join("\n"),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur lors de l'import",
          description: errorData?.message || err?.message || "Une erreur est survenue lors de l'import",
          variant: "destructive",
        });
      }
    } finally {
      setImportingResults(false);
    }
  };

  const handleFileUpload = async (file: File, type: "txtjson" | "pdf") => {
    if (!raceId) {
      toast({
        title: "Erreur",
        description: "ID de course manquant",
        variant: "destructive",
      });
      return;
    }

    // Si c'est un fichier JSON/TXT, essayer de l'importer comme ErgRace
    if (type === "txtjson") {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
      if (fileExtension === ".json" || file.type === "application/json") {
        // C'est probablement un fichier ErgRace
        await handleImportErgRaceResults(file);
        return;
      }
    }

    // Pour les autres fichiers (PDF, TXT non-JSON), utiliser l'ancienne méthode
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      // TODO: Remplacer par la route API appropriée
      const response = await api.post(`/races/${raceId}/upload-results`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast({
        title: "Fichier téléversé",
        description: `Le fichier ${file.name} a été téléversé avec succès`,
      });

      // Recharger les données de la course si nécessaire
      if (response.data.data) {
        fetchRace();
      }
    } catch (err: any) {
      console.error("Erreur upload fichier", err);
      toast({
        title: "Erreur",
        description: err.response?.data?.message || "Erreur lors du téléversement du fichier",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: "txtjson" | "pdf") => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, type);
    }
    // Réinitialiser l'input pour permettre de sélectionner le même fichier
    event.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent, type: "txtjson" | "pdf") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "txtjson") {
      setIsDraggingTxtJson(true);
    } else {
      setIsDraggingPdf(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent, type: "txtjson" | "pdf") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "txtjson") {
      setIsDraggingTxtJson(false);
    } else {
      setIsDraggingPdf(false);
    }
  };

  const handleDrop = (e: React.DragEvent, type: "txtjson" | "pdf") => {
    e.preventDefault();
    e.stopPropagation();

    if (type === "txtjson") {
      setIsDraggingTxtJson(false);
    } else {
      setIsDraggingPdf(false);
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (type === "txtjson") {
      const allowedTypes = ["text/plain", "application/json", "text/json"];
      const allowedExtensions = [".txt", ".json"];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

      if (
        !allowedTypes.includes(file.type) &&
        !allowedExtensions.includes(fileExtension)
      ) {
        toast({
          title: "Format invalide",
          description: "Veuillez déposer un fichier TXT ou JSON",
          variant: "destructive",
        });
        return;
      }
    } else if (type === "pdf") {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast({
          title: "Format invalide",
          description: "Veuillez déposer un fichier PDF",
          variant: "destructive",
        });
        return;
      }
    }

    handleFileUpload(file, type);
  };

  const generateRac2File = async () => {
    if (!race || !event) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le fichier : données manquantes",
        variant: "destructive",
      });
      return;
    }

    // Si la distance n'est pas encore chargée, essayer de la récupérer maintenant
    let finalRaceDistance = race.distance || raceDistance;
    if (!finalRaceDistance && race.distance_id && eventId) {
      try {
        // Récupérer toutes les distances de l'événement et trouver celle correspondante
        const distancesRes = await api.get(`/distances/event/${eventId}`);
        const allDistances = distancesRes.data.data || [];
        const distanceData = allDistances.find((d: Distance) => d.id === race.distance_id);
        
        if (distanceData) {
          finalRaceDistance = distanceData;
          setRaceDistance(distanceData);
          // Mettre à jour la distance si nécessaire
          if (distanceData.is_relay === true || (typeof distanceData.is_relay === 'number' && distanceData.is_relay === 1)) {
            if (distanceData.relay_count && distanceData.meters) {
              setDistance(distanceData.meters * distanceData.relay_count);
            }
          } else if (distanceData.meters) {
            setDistance(distanceData.meters);
          }
        }
      } catch (err) {
        console.error("Erreur lors de la récupération de la distance", err);
      }
    }

    // Récupérer le nombre total de couloirs (par défaut 64 pour indoor)
    const totalLanes = race.lane_count || 64;
    const laneCount = Math.max(totalLanes, race.race_crews.length > 0 
      ? Math.max(...race.race_crews.map(rc => rc.lane))
      : 0
    );

    // Créer un map des couloirs occupés
    const occupiedLanes = new Map<number, RaceCrew>();
    race.race_crews.forEach((rc) => {
      occupiedLanes.set(rc.lane, rc);
    });

    // Construire le tableau boats avec tous les couloirs
    const boats = [];
    for (let lane = 1; lane <= laneCount; lane++) {
      const raceCrew = occupiedLanes.get(lane);
      
      if (raceCrew) {
        // Couloir occupé
        const participants = raceCrew.crew.crew_participants
          .sort((a, b) => a.seat_position - b.seat_position)
          .map((cp) => cp.participant);

        // Formater le nom du participant (ou du bateau si plusieurs participants)
        let boatName = "";
        if (participants.length === 1) {
          // Individuel : format "NOM, Prénom"
          const p = participants[0];
          boatName = `${p.last_name.toUpperCase()}, ${p.first_name}`;
        } else {
          // Équipage : concaténer les noms
          boatName = participants
            .map((p) => `${p.last_name.toUpperCase()}, ${p.first_name}`)
            .join(" • ");
        }

        const categoryLabel = raceCrew.crew.category?.label || "";
        
        boats.push({
          class_name: categoryLabel || "Unknown",
          id: raceCrew.crew_id,
          lane_number: lane,
          name: boatName,
          participants: participants.map((p) => ({
            id: p.id,
            name: `${p.last_name.toUpperCase()}, ${p.first_name}`,
          })),
          affiliation: raceCrew.crew.club_code || "",
        });
      } else {
        // Couloir vide
        boats.push({
          class_name: "EMPTY",
          id: `Lane ${lane}`,
          lane_number: lane,
          name: "EMPTY",
          participants: [
            {
              id: `Lane ${lane}`,
              name: "Lane " + lane,
            },
          ],
          affiliation: "",
        });
      }
    }

    // Déterminer si c'est un relais - utiliser race.distance, raceDistance, ou finalRaceDistance
    const currentDistance = race.distance || raceDistance || finalRaceDistance;
    
    console.log("🔍 Génération .rac2 - Distance actuelle:", {
      raceDistance,
      "race.distance": race.distance,
      currentDistance,
      distance,
    });

    // Si aucune distance n'est trouvée, afficher un avertissement
    if (!currentDistance && !race.distance_id) {
      toast({
        title: "Attention",
        description: "Aucune distance trouvée pour cette course. Utilisation de la distance par défaut.",
        variant: "destructive",
      });
    }

    // Vérifier is_relay (peut être 0, false, ou absent)
    const isRelay = currentDistance?.is_relay === true || (typeof currentDistance?.is_relay === 'number' && currentDistance.is_relay === 1);
    const relayCount = currentDistance?.relay_count ? Number(currentDistance.relay_count) : null;
    const relayDistance = currentDistance?.meters ? Number(currentDistance.meters) : distance;
    
    console.log("🏁 Paramètres relais:", {
      isRelay,
      relayCount,
      relayDistance,
      currentDistance,
      "is_relay value": currentDistance?.is_relay,
    });
    
    // Pour un relais : duration = distance totale (meters * relay_count), split_value = distance d'un relais
    // Pour une course normale : duration = split_value = distance totale
    const totalDistance = isRelay && relayCount && relayDistance 
      ? relayDistance * relayCount 
      : distance;

    // Déterminer le type de course
    let raceType: string;
    if (isRelay) {
      raceType = "relay";
    } else {
      // Si tous les équipages ont 1 participant, c'est individual, sinon team
      const allParticipantsCounts = race.race_crews.map(rc => 
        rc.crew.crew_participants?.length || 0
      );
      const isIndividual = allParticipantsCounts.length > 0 && 
        allParticipantsCounts.every(count => count === 1);
      raceType = isIndividual ? "individual" : "team";
    }

    // Construire le nom long formaté pour les relais
    let nameLong = race.name;
    if (isRelay && currentDistance) {
      // Utiliser le label formaté de l'API (ex: "8x250m") ou construire
      const distanceLabel = currentDistance.label || 
        (relayCount && relayDistance ? `${relayCount}x${relayDistance}m` : race.name);
      
      // Ajouter la catégorie si disponible
      const firstCrew = race.race_crews[0];
      if (firstCrew?.crew?.category?.label) {
        nameLong = `${distanceLabel} ${firstCrew.crew.category.label}`;
      } else {
        nameLong = distanceLabel;
      }
    }

    // Valeurs finales pour le fichier .rac2
    // Pour un relais: duration = distance totale, split_value = distance d'un relais
    // Pour une course normale: duration = split_value = distance totale
    const finalDuration = isRelay && relayCount && relayDistance 
      ? relayDistance * relayCount 
      : totalDistance;
    const finalSplitValue = isRelay && relayDistance 
      ? relayDistance 
      : totalDistance;

    console.log("📐 Calculs finaux:", {
      isRelay,
      relayCount,
      relayDistance,
      finalDuration,
      finalSplitValue,
      totalDistance,
      distance,
    });

    // Construire l'objet rac2
    const rac2Data: any = {
      race_definition: {
        duration: finalDuration, // Distance totale (ex: 2000 pour 8x250m)
        duration_type: "meters",
        event_name: event.name.toUpperCase(),
        name_long: nameLong,
        name_short: race.id,
        race_id: race.id,
        race_type: raceType,
        boats: boats,
        split_type: "even",
        split_value: finalSplitValue, // Distance d'un relais pour les relais (ex: 250), distance totale sinon
        team_size: 1,
        handicap_enabled: false,
        time_cap: 0,
      },
    };

    // Ajouter les champs spécifiques aux relais
    if (isRelay) {
      rac2Data.race_definition.display_prompt_at_splits = true;
      rac2Data.race_definition.sound_horn_at_splits = true;
    }

    console.log("📋 Fichier .rac2 final:", {
      isRelay,
      relayCount,
      relayDistance,
      duration: rac2Data.race_definition.duration,
      split_value: rac2Data.race_definition.split_value,
      raceType: rac2Data.race_definition.race_type,
      name_long: rac2Data.race_definition.name_long,
      display_prompt: rac2Data.race_definition.display_prompt_at_splits,
      sound_horn: rac2Data.race_definition.sound_horn_at_splits,
    });

    // Convertir en JSON et télécharger
    const jsonContent = JSON.stringify(rac2Data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${race.name.replace(/\s+/g, "_")}_${race.id}.rac2`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Fichier généré",
      description: "Le fichier .rac2 a été téléchargé avec succès",
    });

    // Ouvrir la modal avec les instructions
    setShowInstructionsDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!race) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground mb-4">Course introuvable</p>
        <Button onClick={() => navigate(`/event/${eventId}/indoor`)}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  // Vérifier si la course a une distance (après chargement complet)
  const hasDistance = !loading && race && (race.distance || raceDistance || race.distance_id);
  
  return (
    <div className="space-y-6">
      {/* Message d'erreur et formulaire si pas de distance */}
      {!loading && race && !hasDistance && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-1">
                    Distance manquante
                  </h3>
                  <p className="text-sm text-red-800 mb-3">
                    Cette course n'a pas de distance sélectionnée. Vous devez sélectionner une distance 
                    et l'enregistrer pour pouvoir générer le fichier .rac2 correctement.
                  </p>
                </div>
              </div>
              
              {/* Formulaire de sélection rapide */}
              {availableDistances.length > 0 && (
                <div className="pt-4 border-t border-red-200">
                  {isSuggestedDistance && selectedDistanceId && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                      💡 Distance suggérée automatiquement en fonction des équipages de la course
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label htmlFor="distance-select" className="text-sm font-medium text-red-900 mb-2 block">
                        Sélectionner une distance
                      </Label>
                      <Select
                        value={selectedDistanceId}
                        onValueChange={(value) => {
                          setSelectedDistanceId(value);
                          setIsSuggestedDistance(false); // L'utilisateur a sélectionné manuellement, ce n'est plus une suggestion
                        }}
                      >
                        <SelectTrigger id="distance-select" className="w-full bg-white">
                          <SelectValue placeholder="Choisir une distance..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDistances.map((dist) => (
                            <SelectItem key={dist.id} value={dist.id}>
                              {dist.label || `${dist.meters}m`}
                              {dist.is_relay && dist.relay_count && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (Relais {dist.relay_count}x{dist.meters}m)
                                </span>
                              )}
                              {selectedDistanceId === dist.id && isSuggestedDistance && (
                                <span className="ml-2 text-xs text-blue-600 font-medium">
                                  (Suggérée)
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleSaveDistance}
                      disabled={!selectedDistanceId || isSavingDistance}
                      className="gap-2 bg-red-600 hover:bg-red-700"
                    >
                      {isSavingDistance ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {availableDistances.length === 0 && (
                <div className="pt-4 border-t border-red-200">
                  <p className="text-xs text-red-700">
                    Aucune distance disponible pour cet événement. 
                    Veuillez créer des distances dans la page de gestion des distances.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Notifications */}
      <NotificationDisplay eventId={eventId} raceId={raceId} />

      {/* Header avec retour */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/event/${eventId}/indoor`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Course {race.race_number} - {race.name}
            </h2>
            <div className="flex items-center gap-4 mt-1">
              {race.race_phase && (
                <p className="text-sm text-muted-foreground">
                  Phase: {race.race_phase.name} • {dayjs(race.start_time).format("DD/MM/YYYY à HH:mm")}
                </p>
              )}
              {(race.distance || raceDistance) && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-600">
                    Distance:
                  </span>
                  <span className="text-sm font-bold text-blue-800">
                    {(() => {
                      const currentDist = race.distance || raceDistance;
                      if (currentDist?.is_relay === true || (typeof currentDist?.is_relay === 'number' && currentDist.is_relay === 1)) {
                        if (currentDist?.relay_count) {
                          const totalDist = currentDist.meters * currentDist.relay_count;
                          const label = currentDist.label || `${currentDist.relay_count}x${currentDist.meters}m`;
                          return `${label} (${totalDist}m total)`;
                        }
                      }
                      return currentDist?.label || `${currentDist?.meters || distance}m`;
                    })()}
                  </span>
                  {((race.distance?.is_relay === true || (typeof race.distance?.is_relay === 'number' && race.distance.is_relay === 1)) || 
                    (raceDistance?.is_relay === true || (typeof raceDistance?.is_relay === 'number' && raceDistance.is_relay === 1))) && (
                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                      RELAIS
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <Button 
          onClick={generateRac2File} 
          className="gap-2"
          disabled={!hasDistance}
          title={!hasDistance ? "Veuillez sélectionner une distance pour la course" : ""}
        >
          <Download className="w-4 h-4" />
          Télécharger le fichier .rac2 (ErgRace)
        </Button>
      </div>

      {/* Zones de dépôt de fichiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Zone TXT/JSON */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Résultats TXT/JSON
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDraggingTxtJson
                  ? "border-primary bg-primary/10"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={(e) => handleDragOver(e, "txtjson")}
              onDragLeave={(e) => handleDragLeave(e, "txtjson")}
              onDrop={(e) => handleDrop(e, "txtjson")}
              onClick={() => fileInputTxtJsonRef.current?.click()}
            >
              {importingResults ? (
                <>
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                  <p className="text-sm font-medium mb-2">Import en cours...</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-2">
                    Glissez-déposez un fichier ErgRace JSON ici
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Format ErgRace (.json)
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">ou</p>
                  <Button variant="outline" size="sm" disabled={importingResults}>
                    Sélectionner un fichier
                  </Button>
                </>
              )}
              <input
                ref={fileInputTxtJsonRef}
                type="file"
                accept=".txt,.json"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "txtjson")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Zone PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <File className="w-5 h-5" />
              Résultats PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDraggingPdf
                  ? "border-primary bg-primary/10"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={(e) => handleDragOver(e, "pdf")}
              onDragLeave={(e) => handleDragLeave(e, "pdf")}
              onDrop={(e) => handleDrop(e, "pdf")}
              onClick={() => fileInputPdfRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Glissez-déposez un fichier PDF ici
              </p>
              <p className="text-xs text-muted-foreground mb-4">ou</p>
              <Button variant="outline" size="sm">
                Sélectionner un fichier
              </Button>
              <input
                ref={fileInputPdfRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "pdf")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des équipages par couloir */}
      <Card>
        <CardHeader>
          <CardTitle>Équipages par couloir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 font-semibold">Couloir</th>
                  <th className="text-left py-2 px-4 font-semibold">Code Club</th>
                  <th className="text-left py-2 px-4 font-semibold">Club</th>
                  <th className="text-left py-2 px-4 font-semibold">Catégorie</th>
                  <th className="text-left py-2 px-4 font-semibold">Participants</th>
                </tr>
              </thead>
              <tbody>
                {race.race_crews.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      Aucun équipage assigné à cette course
                    </td>
                  </tr>
                ) : (
                  race.race_crews.map((raceCrew) => {
                    const participants = raceCrew.crew.crew_participants
                      .sort((a, b) => a.seat_position - b.seat_position)
                      .map((cp) => cp.participant);

                    return (
                      <tr key={raceCrew.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-lg">{raceCrew.lane}</td>
                        <td className="py-3 px-4 font-semibold">{raceCrew.crew.club_code}</td>
                        <td className="py-3 px-4">{raceCrew.crew.club_name}</td>
                        <td className="py-3 px-4">
                          {raceCrew.crew.category ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {raceCrew.crew.category.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {participants.map((participant, idx) => {
                              const crewParticipant = raceCrew.crew.crew_participants.find(
                                (cp) => cp.participant_id === participant.id
                              );
                              const isCoxswain = crewParticipant?.is_coxswain || false;

                              return (
                                <div
                                  key={participant.id}
                                  className={`text-sm ${isCoxswain ? "font-bold" : ""}`}
                                >
                                  {participant.first_name} {participant.last_name}
                                  {isCoxswain && (
                                    <span className="text-muted-foreground ml-1 text-xs">(B)</span>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({participant.license_number})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Résultats Indoor ErgRace */}
      {loadingResults ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Chargement des résultats...</p>
          </CardContent>
        </Card>
      ) : indoorResults ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Résultats de la course
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>
                    {dayjs(indoorResults.race_result.race_start_time).format("HH:mm:ss")} - {dayjs(indoorResults.race_result.race_end_time).format("HH:mm:ss")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Durée: {Math.round(indoorResults.race_result.duration / 1000)}s</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-3 px-4 font-semibold">Place</th>
                    <th className="text-left py-3 px-4 font-semibold">Équipage</th>
                    <th className="text-left py-3 px-4 font-semibold">Temps</th>
                    <th className="text-left py-3 px-4 font-semibold">Distance</th>
                    <th className="text-left py-3 px-4 font-semibold">Allure</th>
                    <th className="text-left py-3 px-4 font-semibold">SPM</th>
                    <th className="text-left py-3 px-4 font-semibold">Calories</th>
                  </tr>
                </thead>
                <tbody>
                  {indoorResults.participants.map((participant, index) => {
                    const isPodium = participant.place <= 3;
                    return (
                      <tr
                        key={participant.id}
                        className={`border-b hover:bg-slate-50 ${
                          isPodium ? "bg-amber-50" : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isPodium && (
                              <Trophy
                                className={`w-4 h-4 ${
                                  participant.place === 1
                                    ? "text-amber-500"
                                    : participant.place === 2
                                    ? "text-gray-400"
                                    : "text-amber-700"
                                }`}
                              />
                            )}
                            <span className={`font-bold ${isPodium ? "text-lg" : ""}`}>
                              {participant.place}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {participant.crew ? (
                            <div>
                              <div className="font-semibold">{participant.crew.club_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {participant.crew.club_code}
                                {participant.crew.category && (
                                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                    {participant.crew.category.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground italic">
                              {participant.ergrace_participant_id}
                              <span className="ml-2 text-xs">(non identifié)</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">
                          {participant.time_display}
                        </td>
                        <td className="py-3 px-4">{participant.distance}m</td>
                        <td className="py-3 px-4 font-mono">{participant.avg_pace}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-muted-foreground" />
                            {participant.spm}
                          </div>
                        </td>
                        <td className="py-3 px-4">{participant.calories}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-medium text-muted-foreground">
              Aucun résultat importé pour cette course
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Importez un fichier ErgRace JSON pour afficher les résultats
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bloc JSON brut pour admins/superadmins */}
      {isAdmin && indoorResults?.race_result?.raw_data && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <FileText className="w-5 h-5" />
              Données JSON brutes (Admin uniquement)
            </CardTitle>
            <p className="text-sm text-amber-700 mt-1">
              Fichier JSON ErgRace complet importé - Visible uniquement pour les administrateurs
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full rounded-md border bg-white p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(indoorResults.race_result.raw_data, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Modal d'instructions pour lancer la course dans ErgRace */}
      <Dialog open={showInstructionsDialog} onOpenChange={setShowInstructionsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              Comment lancer la course dans ErgRace
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Suivez ces étapes pour lancer la course dans le logiciel ErgRace
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mt-0.5">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-1">Ouvrir le logiciel ErgRace</p>
                  <p className="text-sm text-blue-700">Lancez l'application ErgRace sur votre ordinateur</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mt-0.5">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-1">Dans le menu, cliquer sur "Lancer la course"</p>
                  <p className="text-sm text-blue-700">Accédez au menu principal et sélectionnez l'option "Lancer la course"</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mt-0.5">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-1">Ouvrir un fichier course</p>
                  <p className="text-sm text-blue-700">Sélectionnez le fichier .rac2 que vous venez de télécharger</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mt-0.5">
                  4
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-1">Vérifier les informations</p>
                  <p className="text-sm text-blue-700">Vérifiez que toutes les informations de la course sont correctes (équipages, couloirs, distance, etc.)</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 mb-1">⚠️ Attention : Ne pas modifier le "Race Name"</p>
                  <p className="text-sm text-amber-700">Le nom de la course doit rester identique pour permettre la liaison automatique des résultats</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mt-0.5">
                  5
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-1">Cliquer sur le bouton "Save & Load Race"</p>
                  <p className="text-sm text-blue-700">Enregistrez et chargez la course dans ErgRace</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 mb-1">⚠️ Attention : Ne pas changer le nom du fichier</p>
                  <p className="text-sm text-amber-700">Conservez le nom du fichier tel quel pour assurer la compatibilité avec l'import des résultats</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm mt-0.5">
                  6
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-green-900 mb-1">Faire la course</p>
                  <p className="text-sm text-green-700">Lancez la course dans ErgRace. Une fois terminée, vous pourrez importer les résultats JSON depuis cette page.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowInstructionsDialog(false)} className="w-full sm:w-auto">
              J'ai compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

