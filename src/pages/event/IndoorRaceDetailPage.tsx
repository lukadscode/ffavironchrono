import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import dayjs from "dayjs";
import { ArrowLeft, Download, Upload, FileText, File, AlertTriangle, Save, Trophy, Clock, TrendingUp, Loader2, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";
import { formatTempsPronostique } from "@/utils/formatTime";
import { useToast } from "@/hooks/use-toast";
import NotificationDisplay from "@/components/notifications/NotificationDisplay";
import { useAuth } from "@/context/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { initializeClubsCache, getClubShortCode, getClubShortCodeSync } from "@/api/clubs";

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
    meters: number | null;
    is_relay?: boolean;
    relay_count?: number | null;
    is_time_based: boolean;
    duration_seconds: number | null;
    label: string;
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
    status: string;
    club_name: string;
    club_code: string;
    coach_name: string | null;
    temps_pronostique: number | null;
    category: Category;
    crew_participants: CrewParticipant[];
  };
};

type Distance = {
  id: string;
  meters: number | null;
  is_relay?: boolean | number;
  relay_count?: number | null;
  is_time_based: boolean;
  duration_seconds: number | null;
  label: string; // Label formaté depuis l'API (ex: "8x250m", "2000m", "2min", "2min 30s")
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
    temps_pronostique?: number | null;
    category?: {
      id: string;
      code: string;
      label: string;
    };
  } | null;
  splits_data?: Array<{
    distance?: number;
    time_ms?: number;
    time_display?: string;
    pace?: string;
    split_distance?: number;
    split_time_ms?: number;
    split_time_display?: string;
    split_time?: string;
    split_avg_pace?: string;
    split_stroke_rate?: number;
  }> | null;
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
  const [selectedParticipantForChart, setSelectedParticipantForChart] = useState<IndoorParticipantResult | null>(null);
  const [showAddResultDialog, setShowAddResultDialog] = useState(false);
  const [selectedRaceCrew, setSelectedRaceCrew] = useState<any | null>(null);
  const [manualResultTime, setManualResultTime] = useState("");
  const [manualResultDistance, setManualResultDistance] = useState("");
  const [manualResultPace, setManualResultPace] = useState("");
  const [manualResultSpm, setManualResultSpm] = useState("");
  const [manualResultCalories, setManualResultCalories] = useState("");
  const [isSavingManualResult, setIsSavingManualResult] = useState(false);

  useEffect(() => {
    if (raceId && eventId) {
      fetchEvent();
      // Initialiser le cache des clubs
      initializeClubsCache();
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
        // Vérifier si c'est une distance basée sur le temps
        if (distanceData.is_time_based && distanceData.duration_seconds) {
          // Pour une course basée sur le temps, on ne peut pas utiliser setDistance (qui est en mètres)
          // On garde juste la distance par défaut pour l'affichage, mais le fichier .rac2 utilisera duration_seconds
          console.log(`⏱️ Course basée sur le temps: ${distanceData.duration_seconds}s (${distanceData.label})`);
          setDistance(500); // Valeur par défaut pour l'affichage, ne sera pas utilisée pour .rac2
        } else {
          // Vérifier is_relay (peut être 0/1 ou true/false selon l'API)
          const isRelay = distanceData.is_relay === true || (typeof distanceData.is_relay === 'number' && distanceData.is_relay === 1);
          if (isRelay && distanceData.relay_count && distanceData.meters) {
            // Pour un relais, la distance totale = meters * relay_count
            const totalDist = distanceData.meters * distanceData.relay_count;
            console.log(`🔄 Relais détecté: ${distanceData.relay_count}x${distanceData.meters}m = ${totalDist}m`);
            setDistance(totalDist);
          } else if (distanceData.meters) {
            console.log(`📏 Course normale: ${distanceData.meters}m`);
            setDistance(distanceData.meters);
          }
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

      // Normaliser les données pour supporter les deux formats :
      // Format 1 : { results: { race_id, participants, ... } }
      // Format 2 : { race_id, participants, ... } (données directement à la racine)
      let normalizedResults: any;
      
      if (ergraceData.results) {
        // Format avec encapsulation dans "results"
        normalizedResults = ergraceData.results;
      } else if (ergraceData.race_id || ergraceData.participants) {
        // Format sans encapsulation (données à la racine)
        normalizedResults = ergraceData;
      } else {
        toast({
          title: "Format invalide",
          description: "Le fichier ne semble pas être un fichier ErgRace valide",
          variant: "destructive",
        });
        return;
      }

      // Vérifier que les données essentielles sont présentes
      if (!normalizedResults.participants || !Array.isArray(normalizedResults.participants)) {
        toast({
          title: "Format invalide",
          description: "Le fichier ne contient pas de participants valides",
          variant: "destructive",
        });
        return;
      }

      // Normaliser les participants pour gérer les différences entre formats
      // Dans le nouveau format, le temps est dans "time" (string) et "score" contient la distance (number)
      // Le backend attend que "score" soit une string contenant le temps
      const normalizedParticipants = normalizedResults.participants.map((participant: any) => {
        const normalized: any = { ...participant };
        
        // Dans le nouveau format, "score" contient la distance (number) et "time" contient le temps (string)
        // Le backend attend que "score" soit une string contenant le temps
        // Donc on utilise toujours "time" pour remplacer "score" si "time" existe
        if (normalized.time) {
          if (typeof normalized.time === 'string') {
            // Le temps est dans "time" au format "MM:SS.m" (ex: "11:31.0")
            // On remplace "score" par "time" car le backend attend le temps dans "score"
            normalized.score = normalized.time;
          } else if (typeof normalized.time === 'number') {
            // Si "time" est un nombre (millisecondes), on le convertit en string
            normalized.score = normalized.time.toString();
          }
        } else if (normalized.score && typeof normalized.score !== 'string') {
          // Si "score" existe mais n'est pas une string (c'est la distance dans le nouveau format)
          // et qu'il n'y a pas de "time", on convertit en string pour l'ancien format
          normalized.score = normalized.score.toString();
        }
        
        // S'assurer que score est toujours une string (requis par le backend)
        if (!normalized.score || typeof normalized.score !== 'string') {
          // Si on n'a toujours pas de score valide, utiliser une valeur par défaut
          normalized.score = "0:00.0";
        }
        
        // S'assurer que lane_number existe (peut être "lane" dans certains formats)
        if (normalized.lane && !normalized.lane_number) {
          normalized.lane_number = normalized.lane;
        }
        
        return normalized;
      });

      // Préparer le payload pour l'API avec les données normalisées
      const payload = {
        results: {
          ...normalizedResults,
          participants: normalizedParticipants,
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

  // Fonction pour formater le temps en millisecondes
  const formatTime = (ms: string | number) => {
    const msStr = ms.toString();
    
    // Si c'est déjà formaté (contient ':'), retourner tel quel
    if (msStr.includes(':')) {
      return msStr;
    }
    
    const diffMs = parseInt(msStr, 10);
    if (isNaN(diffMs) || diffMs < 0) return "-";
    
    // Si le temps est trop grand (probablement un timestamp absolu), retourner N/A
    if (diffMs > 1800000) {
      return "-";
    }
    
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = diffMs % 1000;
    
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  };

  // Fonction pour formater le split_time (en centièmes de seconde, ex: 625 = 62.5s = 1:02.5)
  const formatSplitTime = (splitTime: string | number | null | undefined): string => {
    if (!splitTime && splitTime !== 0) return "-";
    
    // Si c'est déjà formaté (contient ':'), retourner tel quel
    const str = splitTime.toString();
    if (str.includes(':')) {
      return str;
    }
    
    // Convertir en nombre (centièmes de seconde)
    const centiseconds = typeof splitTime === 'string' ? parseFloat(splitTime) : splitTime;
    if (isNaN(centiseconds) || centiseconds < 0) return "-";
    
    // Convertir centièmes en secondes totales
    const totalSeconds = centiseconds / 10;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((centiseconds % 10));
    
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  };

  // Fonction pour parser le temps au format MM:SS.SS ou MM:SS.S en millisecondes
  const parseTimeToMs = (timeString: string | null | undefined): number => {
    try {
      if (!timeString || typeof timeString !== 'string') return 0;
      
      const trimmed = timeString.trim();
      if (!trimmed) return 0;
      
      // Format attendu: MM:SS.SS ou MM:SS.S
      const parts = trimmed.split(':');
      if (parts.length !== 2 || !parts[0] || !parts[1]) return 0;
      
      const minutes = parseInt(parts[0], 10);
      if (isNaN(minutes) || minutes < 0) return 0;
      
      const secondsPart = parts[1].trim();
      if (!secondsPart) return 0;
      
      // Séparer les secondes et les centièmes/dixièmes
      const secondsSplit = secondsPart.split('.');
      if (secondsSplit.length === 0 || !secondsSplit[0]) return 0;
      
      const seconds = parseInt(secondsSplit[0], 10);
      if (isNaN(seconds) || seconds < 0) return 0;
      
      let milliseconds = 0;
      if (secondsSplit.length > 1 && secondsSplit[1]) {
        // Support des formats : SS.S (dixièmes) ou SS.SS (centièmes)
        // Exemple: "23.9" = 23 secondes et 9 dixièmes = 900ms
        //          "23.09" = 23 secondes et 9 centièmes = 90ms
        const fractionStr = secondsSplit[1];
        const fractionDigits = fractionStr.length;
        
        if (fractionDigits === 1) {
          // 1 chiffre = dixièmes (× 100 pour convertir en millisecondes)
          milliseconds = parseInt(fractionStr, 10) * 100;
        } else if (fractionDigits === 2) {
          // 2 chiffres = centièmes (× 10 pour convertir en millisecondes)
          milliseconds = parseInt(fractionStr, 10) * 10;
        } else if (fractionDigits >= 3) {
          // 3+ chiffres = millisecondes directs (on prend les 3 premiers)
          milliseconds = parseInt(fractionStr.substring(0, 3), 10);
        }
      }
      
      return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
    } catch (error) {
      console.error("Erreur parsing temps:", error, timeString);
      return 0;
    }
  };

  // Fonction pour calculer l'allure moyenne à partir du temps et de la distance
  const calculatePace = (timeMs: number, distance: number): string => {
    if (!distance || distance === 0 || !timeMs || timeMs === 0) return "0:00.0";
    
    // Allure en secondes par 500m
    const secondsPer500m = (timeMs / 1000) / (distance / 500);
    const minutes = Math.floor(secondsPer500m / 60);
    const seconds = Math.floor(secondsPer500m % 60);
    const tenths = Math.floor((secondsPer500m % 1) * 10);
    
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  };

  // Fonction pour ouvrir le dialogue d'ajout de résultat
  const handleOpenAddResultDialog = (raceCrew: any) => {
    setSelectedRaceCrew(raceCrew);
    setManualResultTime("");
    setManualResultDistance(raceDistance?.meters?.toString() || distance.toString());
    setManualResultPace("");
    setManualResultSpm("");
    setManualResultCalories("");
    setShowAddResultDialog(true);
  };

  // Fonction pour soumettre un résultat manuel
  const handleSaveManualResult = async () => {
    if (!raceId || !selectedRaceCrew || !manualResultTime || !manualResultDistance) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir au moins le temps et la distance",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingManualResult(true);

      const timeMs = parseTimeToMs(manualResultTime);
      const distanceNum = parseFloat(manualResultDistance) || 0;
      
      if (timeMs === 0 || distanceNum === 0) {
        toast({
          title: "Erreur",
          description: "Le temps et la distance doivent être valides",
          variant: "destructive",
        });
        return;
      }

      // Calculer l'allure si elle n'est pas fournie
      let avgPace = manualResultPace?.trim() || calculatePace(timeMs, distanceNum);
      // S'assurer que avgPace est toujours une string valide
      if (!avgPace || typeof avgPace !== 'string') {
        avgPace = calculatePace(timeMs, distanceNum);
      }
      if (!avgPace || avgPace.trim().length === 0) {
        avgPace = "0:00.0"; // Valeur par défaut si le calcul échoue
      }
      
      // Utiliser le format de temps saisi par l'utilisateur (format MM:SS.S ou MM:SS.SS)
      // Si ce n'est pas dans le bon format, utiliser formatTime
      let timeDisplay = manualResultTime.trim();
      // S'assurer que le format est correct (au moins MM:SS.S)
      if (!timeDisplay.match(/^\d+:\d{2}\.\d{1,2}$/)) {
        timeDisplay = formatTime(timeMs);
      }
      // S'assurer que timeDisplay est toujours une string valide
      if (!timeDisplay || typeof timeDisplay !== 'string' || timeDisplay.trim().length === 0) {
        timeDisplay = "0:00.0";
      }

      // Utiliser l'endpoint d'import avec un format compatible ErgRace
      // Le format doit correspondre exactement à ce que l'API attend
      // S'assurer que id et score sont non vides (requis par l'API)
      const crewId = selectedRaceCrew.crew.id;
      if (!crewId || String(crewId).trim().length === 0) {
        toast({
          title: "Erreur",
          description: "ID d'équipage invalide",
          variant: "destructive",
        });
        return;
      }

      // S'assurer que tous les champs string sont bien des strings non vides
      const participantName = selectedRaceCrew.crew.club_name 
        ? `${selectedRaceCrew.crew.club_name} - Couloir ${selectedRaceCrew.lane}`
        : `Équipage - Couloir ${selectedRaceCrew.lane}`;
      const affiliation = selectedRaceCrew.crew.club_code || "";
      const classCode = selectedRaceCrew.crew.category?.code || "";

      const participant: any = {
        id: String(crewId), // L'API exige un champ "id" non vide
        lane: selectedRaceCrew.lane,
        lane_number: selectedRaceCrew.lane,
        participant: participantName,
        affiliation: affiliation,
        class: classCode,
        score: String(timeDisplay), // Le backend attend score comme string avec le temps
        time: String(timeDisplay),  // Pour compatibilité avec ErgRace
        distance: distanceNum,
        avg_pace: String(avgPace), // S'assurer que c'est toujours une string
        spm: manualResultSpm ? parseInt(manualResultSpm, 10) : 0,
        calories: manualResultCalories ? parseInt(manualResultCalories, 10) : 0,
        machine_type: "Rameur",
        logged_time: new Date().toISOString(),
        // Ajouter crew_id pour que le backend puisse lier le résultat à l'équipage
        crew_id: String(crewId),
      };

      // Vérifier que raceId est valide
      if (!raceId || String(raceId).trim().length === 0) {
        toast({
          title: "Erreur",
          description: "ID de course invalide",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        results: {
          race_id: raceId,
          c2_race_id: raceId, // ID de la course dans la plateforme
          race_name: race?.name || "Course indoor",
          race_type: "individual",
          race_duration_type: "distance",
          duration: distanceNum,
          race_start_time: race?.start_time || new Date().toISOString(),
          race_end_time: new Date().toISOString(),
          participants: [participant],
        },
      };

      console.log("Payload envoyé:", JSON.stringify(payload, null, 2));
      
      const response = await api.post("/indoor-results/import", payload);

      toast({
        title: "Résultat ajouté",
        description: `Résultat manuel ajouté pour ${selectedRaceCrew.crew.club_name}`,
      });

      // Recharger les résultats et la course
      await fetchIndoorResults();
      await fetchRace();
      
      setShowAddResultDialog(false);
    } catch (err: any) {
      console.error("Erreur ajout résultat manuel:", err);
      console.error("Réponse du serveur:", err?.response?.data);
      const errorData = err?.response?.data;
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        toast({
          title: "Erreurs de validation",
          description: errorData.errors.join("\n"),
          variant: "destructive",
        });
      } else {
        const errorMessage = errorData?.message || errorData?.error || err?.message || "Impossible d'ajouter le résultat";
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsSavingManualResult(false);
    }
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
          if (distanceData.is_time_based && distanceData.duration_seconds) {
            // Course basée sur le temps - on garde la distance par défaut
            console.log(`⏱️ Course basée sur le temps: ${distanceData.duration_seconds}s (${distanceData.label})`);
            setDistance(500); // Valeur par défaut
          } else if (distanceData.is_relay === true || (typeof distanceData.is_relay === 'number' && distanceData.is_relay === 1)) {
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
        
        // Récupérer le code court du club (ou le code par défaut)
        const clubCode = raceCrew.crew.club_code || "";
        const clubShortCode = await getClubShortCode(clubCode);
        
        boats.push({
          class_name: categoryLabel || "Unknown",
          id: raceCrew.crew_id,
          lane_number: lane,
          name: boatName,
          participants: participants.map((p) => ({
            id: p.id,
            name: `${p.last_name.toUpperCase()}, ${p.first_name}`,
          })),
          affiliation: clubShortCode || "",
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

    // Vérifier si c'est une distance basée sur le temps
    const isTimeBased = currentDistance?.is_time_based === true;
    const durationSeconds = currentDistance?.duration_seconds ? Number(currentDistance.duration_seconds) : null;
    
    // Vérifier is_relay (peut être 0, false, ou absent) - les courses basées sur le temps ne peuvent pas être des relais
    const isRelay = !isTimeBased && (currentDistance?.is_relay === true || (typeof currentDistance?.is_relay === 'number' && currentDistance.is_relay === 1));
    const relayCount = currentDistance?.relay_count ? Number(currentDistance.relay_count) : null;
    const relayDistance = currentDistance?.meters ? Number(currentDistance.meters) : distance;
    
    console.log("🏁 Paramètres course:", {
      isTimeBased,
      durationSeconds,
      isRelay,
      relayCount,
      relayDistance,
      currentDistance,
    });
    
    // Pour un relais : duration = distance totale (meters * relay_count), split_value = distance d'un relais
    // Pour une course normale basée sur distance : duration = split_value = distance totale
    // Pour une course basée sur le temps : duration = durée en secondes, duration_type = "seconds"
    const totalDistance = isRelay && relayCount && relayDistance 
      ? relayDistance * relayCount 
      : (currentDistance?.meters ? Number(currentDistance.meters) : distance);

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

    // Construire le nom long formaté
    let nameLong = race.name;
    if (currentDistance) {
      // Utiliser le label formaté de l'API
      const distanceLabel = currentDistance.label || race.name;
      
      // Ajouter la catégorie si disponible
      const firstCrew = race.race_crews[0];
      if (firstCrew?.crew?.category?.label) {
        nameLong = `${distanceLabel} ${firstCrew.crew.category.label}`;
      } else {
        nameLong = distanceLabel;
      }
    }

    // Valeurs finales pour le fichier .rac2
    // Pour une course basée sur le temps : duration = durée en secondes, duration_type = "time"
    // Pour un relais: duration = distance totale, split_value = 250m
    // Pour une course normale basée sur distance : duration = distance totale, split_value dépend de la distance
    const finalDuration = isTimeBased && durationSeconds
      ? durationSeconds
      : (isRelay && relayCount && relayDistance 
        ? relayDistance * relayCount 
        : totalDistance);
    // Pour les courses indoor :
    // - Course temps : split_value = 30s
    // - Relais : split_value = 250m
    // - Course normale : split_value = 250m si distance < 750m, sinon 500m
    const finalSplitValue = isTimeBased 
      ? 30 
      : (isRelay 
        ? 250 
        : (totalDistance < 750 ? 250 : 500));
    const finalDurationType = isTimeBased ? "time" : "meters";

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
        duration: finalDuration, // Distance totale (mètres) ou durée en secondes
        duration_type: finalDurationType, // "meters" ou "time"
        event_name: event.name.toUpperCase(),
        name_long: nameLong,
        name_short: race.id,
        race_id: race.id,
        race_type: raceType,
        boats: boats,
        split_type: "even",
        split_value: finalSplitValue, // 250m pour les relais, 500m pour les courses normales
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
                          {availableDistances
                            .filter((d) => !d.is_time_based)
                            .map((dist) => (
                              <SelectItem key={dist.id} value={dist.id}>
                                {dist.label}
                                {selectedDistanceId === dist.id && isSuggestedDistance && (
                                  <span className="ml-2 text-xs text-blue-600 font-medium">
                                    (Suggérée)
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          {availableDistances.some((d) => d.is_time_based) && availableDistances.some((d) => !d.is_time_based) && (
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t">
                              Durées (temps)
                            </div>
                          )}
                          {availableDistances
                            .filter((d) => d.is_time_based)
                            .map((dist) => (
                              <SelectItem key={dist.id} value={dist.id}>
                                {dist.label}
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
                      if (!currentDist) return `${distance}m`;
                      
                      // Utiliser le label du backend qui est toujours formaté correctement
                      if (currentDist.label) {
                        return currentDist.label;
                      }
                      
                      // Fallback pour les anciennes distances sans label
                      if (currentDist.is_relay === true || (typeof currentDist.is_relay === 'number' && currentDist.is_relay === 1)) {
                        if (currentDist.relay_count && currentDist.meters) {
                          const totalDist = currentDist.meters * currentDist.relay_count;
                          return `${currentDist.relay_count}x${currentDist.meters}m (${totalDist}m total)`;
                        }
                      }
                      return currentDist.meters ? `${currentDist.meters}m` : `${distance}m`;
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
                  <th className="text-left py-2 px-4 font-semibold">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {race.race_crews.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      Aucun équipage assigné à cette course
                    </td>
                  </tr>
                ) : (
                  race.race_crews.map((raceCrew) => {
                    const participants = raceCrew.crew.crew_participants
                      .sort((a, b) => a.seat_position - b.seat_position)
                      .map((cp) => cp.participant);

                    // Vérifier si un résultat existe déjà pour cet équipage
                    const existingResult = indoorResults?.participants?.find(
                      (p) => p.crew_id === raceCrew.crew.id
                    );

                    return (
                      <tr 
                        key={raceCrew.id} 
                        className={`border-b hover:bg-slate-100 cursor-pointer transition-colors ${
                          existingResult ? 'bg-green-50' : ''
                        }`}
                        onClick={() => handleOpenAddResultDialog(raceCrew)}
                      >
                        <td className="py-3 px-4 font-bold text-lg">{raceCrew.lane}</td>
                        <td className="py-3 px-4 font-semibold">{getClubShortCodeSync(raceCrew.crew.club_code)}</td>
                        <td className="py-3 px-4">
                          <div>
                            <div>{raceCrew.crew.club_name}</div>
                            {raceCrew.crew.temps_pronostique && (
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Temps pronostique: {formatTempsPronostique(raceCrew.crew.temps_pronostique)}</span>
                              </div>
                            )}
                          </div>
                        </td>
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
                        <td className="py-3 px-4">
                          {existingResult ? (
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-blue-600">{existingResult.time_display}</span>
                              {existingResult.avg_pace && (
                                <span className="text-xs text-muted-foreground">Allure: {existingResult.avg_pace}</span>
                              )}
                              {existingResult.distance && (
                                <span className="text-xs text-muted-foreground">Distance: {existingResult.distance}m</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">Cliquez pour ajouter</span>
                          )}
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
                    {indoorResults.participants.some(p => p.splits_data && p.splits_data.length > 0) && (
                      <th className="text-left py-3 px-4 font-semibold">Splits</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {indoorResults.participants.map((participant, index) => {
                    const isPodium = participant.place <= 3;
                    const hasSplits = participant.splits_data && participant.splits_data.length > 0;
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
                                {getClubShortCodeSync(participant.crew.club_code)}
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
                        {indoorResults.participants.some(p => p.splits_data && p.splits_data.length > 0) && (
                          <td className="py-3 px-4">
                            {hasSplits ? (
                              <div>
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-mono">
                                  {participant.splits_data!.map((split: any, idx: number) => {
                                    const splitTime = split.split_time 
                                      ? formatSplitTime(split.split_time)
                                      : (split.split_time_display || split.time_display || 
                                        (split.split_time_ms ? formatTime(split.split_time_ms) : 
                                        (split.time_ms ? formatTime(split.time_ms) : "-")));
                                    const splitDist = split.split_distance || split.distance || "";
                                    return (
                                      <span key={idx} className="whitespace-nowrap">
                                        {splitDist ? `${splitDist}m: ` : ""}{splitTime}
                                      </span>
                                    );
                                  })}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-1 h-6 text-xs"
                                  onClick={() => setSelectedParticipantForChart(participant)}
                                >
                                  <BarChart3 className="w-3 h-3 mr-1" />
                                  Graphique
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </td>
                        )}
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

      {/* Modal avec graphique des splits */}
      <Dialog open={!!selectedParticipantForChart} onOpenChange={(open) => !open && setSelectedParticipantForChart(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Graphique des splits - {selectedParticipantForChart?.crew?.club_name || selectedParticipantForChart?.ergrace_participant_id || "Participant"}
            </DialogTitle>
          </DialogHeader>
          {selectedParticipantForChart && selectedParticipantForChart.splits_data && selectedParticipantForChart.splits_data.length > 0 && (
            <div className="space-y-6 mt-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedParticipantForChart.splits_data.map((split: any, idx: number) => {
                    // Convertir split_time (centièmes de seconde) en secondes pour le graphique
                    // Exemple: 625 centièmes = 62.5 secondes
                    let splitTimeInSeconds = 0;
                    if (split.split_time !== undefined && split.split_time !== null) {
                      const centiseconds = typeof split.split_time === 'string' ? parseFloat(split.split_time) : split.split_time;
                      if (!isNaN(centiseconds)) {
                        splitTimeInSeconds = centiseconds / 10; // Convertir centièmes en secondes (625 -> 62.5)
                      }
                    } else if (split.split_time_ms) {
                      splitTimeInSeconds = split.split_time_ms / 1000; // Convertir ms en secondes
                    } else if (split.time_ms) {
                      splitTimeInSeconds = split.time_ms / 1000;
                    }
                    
                    return {
                      split: `Split ${idx + 1}`,
                      distance: split.split_distance || split.distance || 0,
                      split_time_seconds: splitTimeInSeconds,
                      split_avg_pace: split.split_avg_pace ? parseFloat(String(split.split_avg_pace).replace(/[^\d.]/g, '')) : 0,
                      split_stroke_rate: split.split_stroke_rate || 0,
                    };
                  })}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="split" />
                    <YAxis yAxisId="left" label={{ value: 'Temps (secondes)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Allure / SPM', angle: 90, position: 'insideRight' }} />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'split_time_seconds') {
                          const minutes = Math.floor(value / 60);
                          const seconds = (value % 60).toFixed(1);
                          return [`${minutes}:${seconds.padStart(4, '0')}`, 'Temps'];
                        }
                        if (name === 'split_avg_pace') {
                          return [value.toFixed(2) + ' s/500m', 'Allure'];
                        }
                        if (name === 'split_stroke_rate') {
                          return [value + ' SPM', 'Cadence'];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="split_time_seconds" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Temps"
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="split_avg_pace" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Allure (s/500m)"
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="split_stroke_rate" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      name="Cadence (SPM)"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Distance totale: {selectedParticipantForChart.distance}m</p>
                <p>Temps total: {selectedParticipantForChart.time_display}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogue pour ajouter un résultat manuel */}
      <Dialog open={showAddResultDialog} onOpenChange={setShowAddResultDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un résultat manuel</DialogTitle>
            <DialogDescription>
              {selectedRaceCrew && (
                <>
                  Équipage: {selectedRaceCrew.crew.club_name} - Couloir {selectedRaceCrew.lane}
                  {selectedRaceCrew.crew.category && ` (${selectedRaceCrew.crew.category.label})`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="time">Temps * (format: MM:SS.SS)</Label>
                <Input
                  id="time"
                  placeholder="Ex: 2:21.0"
                  value={manualResultTime}
                  onChange={(e) => {
                    setManualResultTime(e.target.value);
                    // Calculer automatiquement l'allure si distance et temps sont remplis
                    if (e.target.value && manualResultDistance) {
                      const timeMs = parseTimeToMs(e.target.value);
                      const distanceNum = parseFloat(manualResultDistance);
                      if (timeMs > 0 && distanceNum > 0) {
                        setManualResultPace(calculatePace(timeMs, distanceNum));
                      }
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: Minutes:Secondes.Centièmes (ex: 2:21.0 pour 2 minutes 21 secondes)
                </p>
              </div>
              
              <div>
                <Label htmlFor="distance">Distance * (mètres)</Label>
                <Input
                  id="distance"
                  type="number"
                  placeholder="Ex: 500"
                  value={manualResultDistance}
                  onChange={(e) => {
                    setManualResultDistance(e.target.value);
                    // Calculer automatiquement l'allure si temps et distance sont remplis
                    if (manualResultTime && e.target.value) {
                      const timeMs = parseTimeToMs(manualResultTime);
                      const distanceNum = parseFloat(e.target.value);
                      if (timeMs > 0 && distanceNum > 0) {
                        setManualResultPace(calculatePace(timeMs, distanceNum));
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="pace">Allure moyenne (MM:SS.S)</Label>
                <Input
                  id="pace"
                  placeholder="Ex: 2:21.0"
                  value={manualResultPace}
                  onChange={(e) => setManualResultPace(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Calculée automatiquement si vide
                </p>
              </div>
              
              <div>
                <Label htmlFor="spm">SPM (strokes/min)</Label>
                <Input
                  id="spm"
                  type="number"
                  placeholder="Ex: 30"
                  value={manualResultSpm}
                  onChange={(e) => setManualResultSpm(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="calories">Calories</Label>
                <Input
                  id="calories"
                  type="number"
                  placeholder="Ex: 150"
                  value={manualResultCalories}
                  onChange={(e) => setManualResultCalories(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddResultDialog(false)}
              disabled={isSavingManualResult}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveManualResult}
              disabled={isSavingManualResult || !manualResultTime || !manualResultDistance}
            >
              {isSavingManualResult ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

