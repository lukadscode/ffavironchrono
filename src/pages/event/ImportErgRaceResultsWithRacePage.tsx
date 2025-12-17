import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Upload, X, Search } from "lucide-react";

interface Distance {
  id: string;
  meters: number | null;
  is_time_based: boolean;
  duration_seconds: number | null;
  label: string;
  is_relay?: boolean;
  relay_count?: number | null;
}

interface Phase {
  id: string;
  name: string;
}

type Step = "upload" | "configure";

// Interface minimale pour le JSON ErgRace résultats (on reste permissif)
interface ErgRaceParticipant {
  lane?: number;
  lane_number?: number;
  participant?: string;
  affiliation?: string;
  class?: string;
  score?: string | number;
  time?: string | number;
  distance?: number;
  avg_pace?: string;
  spm?: number;
  calories?: number;
  splits?: any[];
  [key: string]: any;
}

interface ErgRaceResultsPayload {
  duration?: number;
  race_duration_type?: "distance" | "time";
  race_end_time?: string;
  race_event_site?: string;
  race_file_name?: string;
  race_id?: string;
  race_name?: string;
  race_start_time?: string;
  race_type?: string;
  time_cap?: number;
  c2_race_id?: string;
  participants: ErgRaceParticipant[];
  [key: string]: any;
}

interface EventParticipant {
  id: string;
  first_name: string;
  last_name: string;
  club_name?: string;
  license_number?: string;
  crews?: { id: string }[];
}

const getDistanceLabel = (distance: Distance): string => {
  // Si un label existe et que ce n'est pas un relais, on le retourne tel quel
  // Pour les relais, on va construire un label plus explicite
  if (distance.label && !distance.is_relay) return distance.label;
  
  // Gestion des relais
  if (distance.is_relay && distance.relay_count && distance.relay_count > 0) {
    if (distance.is_time_based && distance.duration_seconds != null) {
      return `${distance.relay_count}x${distance.duration_seconds}s`;
    }
    if (!distance.is_time_based && distance.meters != null) {
      return `${distance.relay_count}x${distance.meters}m`;
    }
  }
  
  // Affichage standard (non-relais)
  if (distance.is_time_based && distance.duration_seconds != null) {
    return `${distance.duration_seconds}s`;
  }
  if (!distance.is_time_based && distance.meters != null) {
    return `${distance.meters}m`;
  }
  
  // Si label existe même pour un relais, on l'utilise comme fallback
  if (distance.label) return distance.label;
  
  return "Distance inconnue";
};

// Helpers pour matching de noms (inspirés de ImportErgRaceRacePage)
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const parseErgRaceName = (name: string): { lastName: string; firstName: string; licenseNumber?: string } => {
  const normalized = normalizeName(name);
  
  // Extraire le numéro de licence entre parenthèses si présent
  const licenseMatch = normalized.match(/\((\d+)\)/);
  let licenseNumber = licenseMatch ? licenseMatch[1] : undefined;
  
  // Retirer le numéro de licence et les parties de catégorie (comme "jeune j11", "senior", etc.)
  let cleaned = normalized
    .replace(/\(\d+\)/g, "") // Retirer (613571)
    .replace(/\b(jeune|junior|senior|cadet|minime|benjamin|poussin|espoir)\s*\w*\b/gi, "") // Retirer catégories
    .trim();
  
  // Nettoyer les espaces multiples
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // Détecter si le premier mot est un nombre (format "362 LACOFFRETTE EMMA")
  // ATTENTION: ce nombre n'est PAS un numéro de licence (qui doit avoir 6 chiffres)
  // C'est probablement un numéro de couloir ou autre identifiant, on le retire juste pour parser le nom
  const parts = cleaned.split(" ").filter(p => p.length > 0);
  let hasLeadingNumber = false;
  if (parts.length > 0) {
    const firstPart = parts[0];
    // Vérifier si c'est un nombre (ex: "362") mais PAS un numéro de licence (6 chiffres)
    if (/^\d+$/.test(firstPart) && firstPart.length !== 6) {
      // C'est un numéro au début (mais pas une licence), on le retire simplement
      // On ne le garde PAS comme numéro de licence
      parts.shift();
      cleaned = parts.join(" ");
      hasLeadingNumber = true;
    }
  }
  
  // Nettoyer à nouveau après retrait du numéro
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",").map((p) => p.trim());
    return {
      lastName: parts[0] || "",
      firstName: parts[1] || "",
      licenseNumber,
    };
  }
  
  const finalParts = cleaned.split(" ").filter(p => p.length > 0);
  if (finalParts.length >= 2) {
    if (hasLeadingNumber) {
      // Format "362 NOM PRENOM" : le premier mot après le numéro = nom, le reste = prénom
      return {
        lastName: finalParts[0] || "",
        firstName: finalParts.slice(1).join(" ") || "",
        licenseNumber, // Pas de numéro de licence dans ce format
      };
    } else {
      // Format classique : le dernier mot = nom, le reste = prénom
      return {
        lastName: finalParts[finalParts.length - 1] || "",
        firstName: finalParts.slice(0, -1).join(" ") || "",
        licenseNumber,
      };
    }
  }
  
  return { lastName: cleaned, firstName: "", licenseNumber };
};

const computeMatchScore = (
  ergraceName: string | undefined,
  ergraceAffiliation: string | undefined,
  participant: EventParticipant
): number => {
  if (! ergraceName) return 0;

  const parsed = parseErgRaceName(ergraceName);
  const ergLast = normalizeName(parsed.lastName);
  const ergFirst = normalizeName(parsed.firstName);
  const ergLicense = parsed.licenseNumber;

  const pLast = normalizeName(participant.last_name);
  const pFirst = normalizeName(participant.first_name);
  const pLicense = normalizeName(participant.license_number || "");

  let score = 0;

  // Si le numéro de licence correspond exactement, c'est une correspondance parfaite
  if (ergLicense && pLicense && ergLicense === pLicense) {
    score = 100;
    // Vérifier quand même si le nom correspond aussi pour confirmer
    if (ergLast === pLast && ergFirst === pFirst) {
      return 100; // Parfait match nom + licence
    } else if (ergLast === pLast) {
      // Nom correspond avec licence
      return 95;
    } else {
      // Licence correspond mais nom diffère un peu (peut arriver avec erreurs de saisie)
      return 90;
    }
  }

  // Sinon, on continue avec la correspondance par nom
  // Nom + prénom exacts
  if (ergLast === pLast && ergFirst === pFirst) {
    score = 100;
    // Bonus si la licence correspond aussi
    if (ergLicense && pLicense && ergLicense === pLicense) {
      score = 100;
    }
  } else if (ergLast === pLast) {
    // Nom exact, prénom proche ou partiel
    if (
      ergFirst &&
      pFirst &&
      (pFirst.startsWith(ergFirst) || ergFirst.startsWith(pFirst))
    ) {
      score = 85; // Augmenté de 80 à 85 pour être plus permissif
      // Bonus si la licence correspond
      if (ergLicense && pLicense && ergLicense === pLicense) {
        score = 95;
      }
    } else if (ergFirst && pFirst && (pFirst.includes(ergFirst) || ergFirst.includes(pFirst))) {
      // Prénom partiellement inclus (ex: "EMMA" vs "EMMANUELLE")
      score = 75; // Nouveau cas pour prénom partiel
      // Bonus si la licence correspond
      if (ergLicense && pLicense && ergLicense === pLicense) {
        score = 90;
      }
    } else {
      score = 70; // Augmenté de 60 à 70 pour nom exact sans prénom correspondant
      // Bonus si la licence correspond
      if (ergLicense && pLicense && ergLicense === pLicense) {
        score = 85;
      }
    }
  } else if (
    pLast.includes(ergLast) ||
    ergLast.includes(pLast)
  ) {
    // Nom partiellement inclus (ex: "LACOFFRETTE" vs "LACOFFRET")
    score = 50; // Augmenté de 40 à 50 pour être plus permissif
    // Bonus si la licence correspond
    if (ergLicense && pLicense && ergLicense === pLicense) {
      score = 75;
    }
  } else {
    // Sans correspondance de nom, on ne va pas plus loin
    score = 0;
  }

  // Bonus club si fourni
  if (ergraceAffiliation && score >= 40) {
    const ergClub = normalizeName(ergraceAffiliation);
    const pClub = normalizeName(participant.club_name || "");
    if (ergClub && pClub && (ergClub === pClub || pClub.includes(ergClub) || ergClub.includes(pClub))) {
      score = Math.min(100, score + 10);
    }
  }

  return score;
};

// Helper pour vérifier la cohérence distance/catégorie d'un équipage
const isCrewCompatibleWithDistance = (
  crew: any,
  targetDistance: Distance | undefined
): boolean => {
  if (!targetDistance) return true; // si on n'a pas de distance définie, ne filtre pas

  if (!crew || !crew.category) return true;

  const catDist = crew.category.distance || null;
  const catDistanceId =
    crew.category.distance_id || (catDist && catDist.id) || null;

  // 1) distance_id strictement identique
  if (catDistanceId && catDistanceId === targetDistance.id) {
    return true;
  }

  if (!catDist) return false;

  // 2) Sinon, comparer les caractéristiques brutes (mètres / temps)
  const t = targetDistance;
  // Courses distance (non temps)
  if (!t.is_time_based && !catDist.is_time_based) {
    if (t.meters != null && catDist.meters != null) {
      return Number(t.meters) === Number(catDist.meters);
    }
  }

  // Courses temps
  if (t.is_time_based && catDist.is_time_based) {
    if (
      t.duration_seconds != null &&
      catDist.duration_seconds != null
    ) {
      return (
        Number(t.duration_seconds) === Number(catDist.duration_seconds)
      );
    }
  }

  return false;
};

export default function ImportErgRaceResultsWithRacePage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);

  const [ergResults, setErgResults] = useState<ErgRaceResultsPayload | null>(
    null
  );

  const [distances, setDistances] = useState<Distance[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);

  // Configuration de la course créée côté plateforme
  const [raceName, setRaceName] = useState("");
  const [raceNumber, setRaceNumber] = useState(1);
  const [startTime, setStartTime] = useState("");
  const [selectedDistanceId, setSelectedDistanceId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");

  // Infos dérivées du fichier
  const [participantsCount, setParticipantsCount] = useState(0);
  const [nonEmptyParticipantsCount, setNonEmptyParticipantsCount] = useState(0);
  const [laneCount, setLaneCount] = useState<number | null>(null);

  // Participants de l'événement pour mapping
  const [eventParticipants, setEventParticipants] = useState<EventParticipant[]>([]);
  const [mappingLoaded, setMappingLoaded] = useState(false);
  // Recherche / ouverture par ligne pour le select de participants
  const [participantSearchQueries, setParticipantSearchQueries] = useState<Record<number, string>>({});
  const [openParticipantSelects, setOpenParticipantSelects] = useState<Record<number, boolean>>({});

  // Équipages de l'événement (avec participants) pour pouvoir retrouver l'équipage d'un participant
  const [eventCrews, setEventCrews] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Accès refusé",
        description: "Cette fonctionnalité est réservée aux administrateurs.",
        variant: "destructive",
      });
      if (eventId) {
        navigate(`/event/${eventId}/indoor`);
      } else {
        navigate("/");
      }
    }
  }, [isAdmin, eventId, navigate, toast]);

  useEffect(() => {
    if (eventId) {
      fetchDistances();
      fetchPhases();
      fetchNextRaceNumber();
      fetchEventParticipants();
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

  const fetchPhases = async () => {
    try {
      const res = await api.get(`/race-phases/${eventId}`);
      setPhases(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement phases", err);
    }
  };

  // Récupérer un numéro de course proposé (max existant + 1)
  const fetchNextRaceNumber = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const races = res.data.data || [];
      if (Array.isArray(races) && races.length > 0) {
        const maxNumber = races.reduce(
          (max: number, r: any) =>
            typeof r.race_number === "number"
              ? Math.max(max, r.race_number)
              : max,
          0
        );
        setRaceNumber(maxNumber + 1);
      } else {
        setRaceNumber(1);
      }
    } catch (err) {
      console.error("Erreur chargement courses pour numéro proposé", err);
    }
  };

  const fetchEventParticipants = async () => {
    try {
      // Récupérer d'abord les équipages avec leurs participants
      const crewsRes = await api.get(`/crews/event/${eventId}`);
      const crewsData = crewsRes.data.data || [];

      // Enrichir chaque équipage avec ses participants détaillés
      const crewsWithParticipants = await Promise.all(
        crewsData.map(async (crew: any) => {
          try {
            const crewDetailRes = await api.get(`/crews/${crew.id}`);
            const crewDetail = crewDetailRes.data.data || crewDetailRes.data;
            return {
              ...crew,
              crew_participants: crewDetail.crew_participants || [],
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

      setEventCrews(crewsWithParticipants);

      // Construire une map participant -> liste d'équipages
      const participantMap = new Map<string, { id: string }[]>();
      crewsWithParticipants.forEach((crew: any) => {
        (crew.crew_participants || []).forEach((cp: any) => {
          const pid = cp.participant?.id;
          if (!pid) return;
          if (!participantMap.has(pid)) {
            participantMap.set(pid, []);
          }
          participantMap.get(pid)!.push({ id: crew.id });
        });
      });

      // Récupérer les participants de l'événement
      const res = await api.get(`/participants/event/${eventId}`);
      const data = res.data.data || [];
      const normalized: EventParticipant[] = data.map((p: any) => {
        const pid = String(p.id);
        return {
          id: pid,
          first_name: p.first_name,
          last_name: p.last_name,
          club_name: p.club_name,
          license_number: p.license_number,
          crews: participantMap.get(pid) || [],
        };
      });

      setEventParticipants(normalized);
      return { participants: normalized, crews: crewsWithParticipants };
    } catch (err) {
      console.error("Erreur chargement participants événement", err);
      setEventParticipants([]);
    } finally {
      setMappingLoaded(true);
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (
      !selectedFile.name.toLowerCase().endsWith(".json") &&
      !selectedFile.name.toLowerCase().endsWith(".txt")
    ) {
      toast({
        title: "Format invalide",
        description: "Le fichier doit être un JSON ou TXT exporté depuis ErgRace.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setLoadingFile(true);

    try {
      const fileContent = await selectedFile.text();
      let parsed: any;

      try {
        parsed = JSON.parse(fileContent);
      } catch (e) {
        toast({
          title: "Erreur de lecture",
          description: "Le fichier JSON n'est pas valide.",
          variant: "destructive",
        });
        setFile(null);
        setErgResults(null);
        return;
      }

      // Supporter à la fois { results: { ... } } et { ... } à la racine
      let results: ErgRaceResultsPayload;
      if (parsed.results && parsed.results.participants) {
        results = parsed.results as ErgRaceResultsPayload;
      } else if (parsed.participants) {
        results = parsed as ErgRaceResultsPayload;
      } else {
        toast({
          title: "Format invalide",
          description: "Le fichier ne contient pas de résultats ErgRace valides.",
          variant: "destructive",
        });
        setFile(null);
        setErgResults(null);
        return;
      }

      if (!Array.isArray(results.participants) || results.participants.length === 0) {
        toast({
          title: "Aucun participant",
          description: "Le fichier ne contient aucun participant.",
          variant: "destructive",
        });
        setFile(null);
        setErgResults(null);
        return;
      }

      // Pré-remplir les champs de course
      const nameFromFile =
        results.race_name || results.race_file_name || "Course indoor";
      setRaceName(nameFromFile);

      if (results.race_start_time) {
        const dt = dayjs(results.race_start_time);
        if (dt.isValid()) {
          setStartTime(dt.format("YYYY-MM-DDTHH:mm"));
        }
      }

      // Détecter la distance
      if (results.duration && results.race_duration_type && distances.length > 0) {
        if (results.race_duration_type === "distance") {
          const matching = distances.find(
            (d) => d.meters && d.meters === results.duration
          );
          if (matching) {
            setSelectedDistanceId(matching.id);
          }
        } else if (results.race_duration_type === "time") {
          const matching = distances.find(
            (d) =>
              d.is_time_based &&
              d.duration_seconds &&
              Number(d.duration_seconds) === Number(results.duration)
          );
          if (matching) {
            setSelectedDistanceId(matching.id);
          }
        }
      }

      // Statistiques sur les participants / couloirs
      // S'assurer que les participants d'événement sont chargés pour l'auto-matching
      let participantsForMatching = eventParticipants;
      if (!participantsForMatching || participantsForMatching.length === 0) {
        try {
          const loaded = await fetchEventParticipants();
          if (loaded?.participants) {
            participantsForMatching = loaded.participants;
          }
        } catch (e) {
          console.error("Erreur chargement participants pour matching:", e);
        }
      }

      // On ajoute des champs internes :
      // - "__include" pour exclure certaines lignes
      // - "__mapped_participant_id" pour lier à un participant de la base
      // - "id" généré si absent (l'API le requiert)
      const participantsWithInclude = results.participants.map(
        (p: ErgRaceParticipant, index: number) => {
          const include = p.participant && p.participant !== "EMPTY";
          const laneValue = p.lane_number ?? p.lane ?? index + 1;

          let mappedId: string | undefined = undefined;
          let matchScore: number | undefined = undefined;

          if (include && participantsForMatching.length > 0 && p.participant) {
            // Calculer un score pour chaque participant événement
            const scored = participantsForMatching.map((ep) => ({
              participant: ep,
              score: computeMatchScore(p.participant!, p.affiliation, ep),
            }));

            // Trier par score décroissant
            scored.sort((a, b) => b.score - a.score);

            const best = scored[0];
            const second = scored[1];

            if (best && best.score > 0) {
              // Logique proche de l'import ErgRace des équipages :
              // on accepte si:
              // - score >= 60 (baissé de 70 pour être plus permissif), ou
              // - score >= 40 et nettement meilleur que le second (écart >= 15, baissé de 20)
              const accept =
                best.score >= 60 ||
                (best.score >= 40 &&
                  (!second || best.score - second.score >= 15));

              if (accept) {
                mappedId = String(best.participant.id);
                matchScore = best.score;
              }
            }
          }

          return {
            id:
              (p as any).id && String((p as any).id).trim().length > 0
                ? (p as any).id
                : `ergrace-${laneValue}-${index}`,
            ...p,
            __include: include,
            __mapped_participant_id: mappedId,
            __match_score: matchScore,
          } as any;
        }
      );

      const total = participantsWithInclude.length;
      const nonEmpty = participantsWithInclude.filter(
        (p: any) => p.__include
      ).length;
      const laneNumbers = results.participants
        .map((p) => (p.lane_number ?? p.lane) as number | undefined)
        .filter((lane): lane is number => typeof lane === "number" && lane > 0);
      const computedLaneCount =
        laneNumbers.length > 0 ? Math.max(...laneNumbers) : total;

      setParticipantsCount(total);
      setNonEmptyParticipantsCount(nonEmpty);
      setLaneCount(computedLaneCount);

      setErgResults({
        ...results,
        participants: participantsWithInclude,
      });
      setStep("configure");
    } finally {
      setLoadingFile(false);
    }
  };

  const handleBack = () => {
    if (step === "configure") {
      setStep("upload");
    } else {
      navigate(`/event/${eventId}/indoor`);
    }
  };

  const normalizeParticipantsForBackend = (
    participants: ErgRaceParticipant[]
  ): ErgRaceParticipant[] => {
    return participants.map((participant: ErgRaceParticipant, index: number) => {
      const normalized: ErgRaceParticipant = { ...participant };

      // Copié de la logique de IndoorRaceDetailPage :
      // utiliser toujours "time" comme temps et le placer dans "score" au format string.
      if (normalized.time !== undefined && normalized.time !== null) {
        if (typeof normalized.time === "string") {
          normalized.score = normalized.time;
        } else if (typeof normalized.time === "number") {
          normalized.score = normalized.time.toString();
        }
      } else if (
        normalized.score !== undefined &&
        normalized.score !== null &&
        typeof normalized.score !== "string"
      ) {
        normalized.score = String(normalized.score);
      }

      if (!normalized.score || typeof normalized.score !== "string") {
        normalized.score = "0:00.0";
      }

      if (normalized.lane && !normalized.lane_number) {
        normalized.lane_number = normalized.lane;
      }

      // L'API exige un champ "id" non vide sur chaque participant
      if (!normalized.id || String(normalized.id).trim().length === 0) {
        const laneValue = normalized.lane_number ?? normalized.lane ?? index + 1;
        normalized.id = `ergrace-${laneValue}-${index}`;
      }

      return normalized as any;
    });
  };

  const handleImport = async () => {
    if (!eventId || !ergResults) return;

    if (!raceName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez saisir un nom pour la course.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedDistanceId) {
      toast({
        title: "Distance requise",
        description: "Veuillez sélectionner une distance.",
        variant: "destructive",
      });
      return;
    }
    if (!phaseId) {
      toast({
        title: "Phase requise",
        description: "Veuillez sélectionner une phase.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      // 1) Créer la course
      const racePayload: any = {
        phase_id: phaseId,
        name: raceName,
        race_number: raceNumber,
        distance_id: selectedDistanceId,
        lane_count: laneCount || participantsCount || 8,
        race_type: "course en ligne",
      };

      if (startTime) {
        racePayload.start_time = new Date(startTime).toISOString();
      } else if (ergResults.race_start_time) {
        const dt = dayjs(ergResults.race_start_time);
        if (dt.isValid()) {
          racePayload.start_time = dt.toDate().toISOString();
        }
      }

      const raceRes = await api.post("/races", racePayload);
      const raceId = raceRes.data.data?.id || raceRes.data.id;

      // Distance cible de la course (pour filtrer les équipages incompatibles)
      const targetDistance = distances.find((d) => d.id === selectedDistanceId);

      // 2) Créer les race_crews en fonction de l'affectation des participants
      //    On ne conserve que les lignes marquées comme incluses (__include !== false)
      const includedParticipants = ergResults.participants.filter(
        (p: any) => p.__include !== false
      );

      // Pour chaque ligne avec un participant FFA mappé, essayer de retrouver son équipage
      const laneCrewPairs: Array<{ lane: number; crew_id: string }> = [];

      includedParticipants.forEach((p: any, index: number) => {
        const mappedId: string | undefined = p.__mapped_participant_id;
        if (!mappedId) return;

        const ep = eventParticipants.find((e) => e.id === mappedId);
        const laneValue = p.lane_number ?? p.lane ?? index + 1;
        if (!ep || !ep.crews || ep.crews.length === 0) return;

        // Si un équipage a été choisi explicitement pour cette ligne, on l'utilise toujours
        const explicitCrewId: string | undefined = p.__mapped_crew_id;
        if (explicitCrewId) {
          // Vérifier que l'équipage sélectionné appartient bien au participant
          const explicitCrew = eventCrews.find((ec) => ec.id === explicitCrewId);
          const crewBelongsToParticipant = ep.crews.some((c) => c.id === explicitCrewId);
          if (explicitCrew && crewBelongsToParticipant) {
            laneCrewPairs.push({ lane: laneValue, crew_id: explicitCrewId });
            return;
          }
        }

        // Sinon, filtrer les équipages du participant en fonction de la distance de la course
        const compatibleCrewIds = ep.crews
          .map((c) => {
            const crew = eventCrews.find((ec) => ec.id === c.id);
            return crew;
          })
          .filter((crew) => crew && isCrewCompatibleWithDistance(crew, targetDistance))
          .map((crew) => crew!.id);
        if (compatibleCrewIds.length === 0) {
          // Aucun équipage cohérent avec la distance => on n'affecte pas
          return;
        }

        // Fallback sur le premier équipage compatible
        const crewIdToUse = compatibleCrewIds[0];
        if (!crewIdToUse) return;

        laneCrewPairs.push({ lane: laneValue, crew_id: crewIdToUse });
      });

      // Créer les race_crews (en évitant les doublons sur (lane, crew_id))
      if (laneCrewPairs.length > 0) {
        const seen = new Set<string>();
        const uniquePairs = laneCrewPairs.filter((p) => {
          const key = `${p.lane}-${p.crew_id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        await Promise.all(
          uniquePairs.map((rc) =>
            api.post("/race-crews", {
              race_id: raceId,
              crew_id: rc.crew_id,
              lane: rc.lane,
            })
          )
        );
      }

      // Petit retour utilisateur avant l'import des résultats
      toast({
        title: "Course créée",
        description:
          "La course et les équipages ont été créés. Import des résultats ErgRace en cours...",
      });

      // 3) Importer les résultats indoor via l'endpoint existant
      //    → on attache aussi crew_id à chaque participant en fonction du couloir
      const laneToCrew = new Map<number, string>();
      laneCrewPairs.forEach(({ lane, crew_id }) => {
        if (!laneToCrew.has(lane)) {
          laneToCrew.set(lane, crew_id);
        }
      });

      const normalizedParticipants = normalizeParticipantsForBackend(
        includedParticipants
      ).map((np: any, index: number) => {
        const laneValue =
          np.lane_number ?? np.lane ?? (includedParticipants[index] as any)?.lane_number ??
          (includedParticipants[index] as any)?.lane ??
          index + 1;
        const crewId = laneToCrew.get(laneValue);
        if (crewId) {
          return {
            ...np,
            // On aligne ergrace_participant_id côté backend sur l'équipage,
            // en utilisant crew_id comme identifiant principal du participant indoor.
            crew_id: crewId,
            id: crewId,
          };
        }
        return np;
      });

      // Certains fichiers ErgRace ont race_id vide,
      // l'API attend cependant une valeur non vide.
      const backendRaceId =
        (ergResults as any).race_id &&
        String((ergResults as any).race_id).trim().length > 0
          ? (ergResults as any).race_id
          : raceId;

      const payload = {
        results: {
          ...ergResults,
          participants: normalizedParticipants,
          race_id: backendRaceId,
          c2_race_id: raceId,
        },
      };

      const response = await api.post("/indoor-results/import", payload);

      // Mettre la course en statut "non_official" pour validation
      try {
        await api.put(`/races/${raceId}`, { status: "non_official" });
      } catch (statusErr: any) {
        console.error("Erreur mise à jour statut course:", statusErr);
      }

      toast({
        title: "Course et résultats importés",
        description: `${response.data.data.participants_count} participant(s) importé(s) (${response.data.data.linked_crews_count} équipage(s) lié(s)). La course est en attente de validation par les arbitres.`,
      });

      navigate(`/event/${eventId}/indoor`);
    } catch (err: any) {
      console.error("Erreur import course + résultats ErgRace:", err);
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
          description:
            errorData?.message ||
            err?.message ||
            "Une erreur est survenue lors de l'import",
          variant: "destructive",
        });
      }
    } finally {
      setImporting(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="space-y-6">
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
              <h1 className="text-3xl font-bold text-slate-900">
                Importer une course ErgRace avec résultats
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Importez un fichier de résultats ErgRace (JSON/TXT) pour créer
                automatiquement la course et ses résultats indoor.
              </p>
            </div>
          </div>
        </div>

        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>Étape 1/2 : Sélection du fichier de résultats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <Label htmlFor="ergrace-results-file" className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-700 font-medium text-lg">
                    Cliquez pour sélectionner un fichier JSON ErgRace
                  </span>
                  <Input
                    id="ergrace-results-file"
                    type="file"
                    accept=".json,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </Label>
                <p className="text-sm text-gray-500 mt-2">
                  Formats acceptés : JSON / TXT exportés depuis ErgRace
                </p>
              </div>

              {loadingFile && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mr-3" />
                  <span className="text-lg">Lecture du fichier...</span>
                </div>
              )}

              {file && ergResults && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Fichier chargé :</strong> {file.name}
                    <br />
                    {participantsCount} ligne(s) de participant(s) détectée(s) dont{" "}
                    {nonEmptyParticipantsCount} réelle(s).
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Le fichier doit être un export de résultats ErgRace (comme
                  l&apos;exemple que vous avez fourni) avec les champs
                  <code className="px-1 mx-1 rounded bg-muted text-xs">
                    participants
                  </code>
                  ,
                  <code className="px-1 mx-1 rounded bg-muted text-xs">
                    lane
                  </code>{" "}
                  et{" "}
                  <code className="px-1 mx-1 rounded bg-muted text-xs">
                    time/score
                  </code>
                  .
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => navigate(`/event/${eventId}/indoor`)}>
                  Annuler
                </Button>
                <Button
                  onClick={() => setStep("configure")}
                  disabled={!ergResults || loadingFile}
                >
                  Suivant →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "configure" && ergResults && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Étape 2/2 : Configuration de la course</CardTitle>
                <div className="text-sm text-gray-500">
                  {nonEmptyParticipantsCount} participant(s) réel(s) sur{" "}
                  {participantsCount} lignes - couloirs estimés :{" "}
                  {laneCount ?? "?"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  La course sera créée dans l&apos;événement, puis les résultats
                  seront importés automatiquement via le même mécanisme que la
                  page de détail indoor. Vous pourrez ensuite vérifier et
                  valider les résultats.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="race-name">Nom de la course *</Label>
                  <Input
                    id="race-name"
                    value={raceName}
                    onChange={(e) => setRaceName(e.target.value)}
                    placeholder="Ex: S1 - 2000m Senior A"
                  />
                </div>

                <div>
                  <Label htmlFor="race-number">Numéro de course *</Label>
                  <Input
                    id="race-number"
                    type="number"
                    min={1}
                    value={raceNumber}
                    onChange={(e) =>
                      setRaceNumber(parseInt(e.target.value, 10) || 1)
                    }
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
                  <Select
                    value={selectedDistanceId}
                    onValueChange={setSelectedDistanceId}
                  >
                    <SelectTrigger id="distance">
                      <SelectValue placeholder="Sélectionner une distance" />
                    </SelectTrigger>
                    <SelectContent>
                      {distances.map((distance) => (
                        <SelectItem key={distance.id} value={distance.id}>
                          {getDistanceLabel(distance)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Distance ErgRace détectée :{" "}
                  {ergResults.race_duration_type === "distance"
                    ? `${ergResults.duration}m`
                    : ergResults.race_duration_type === "time"
                    ? `${ergResults.duration}s`
                    : "inconnue"}
                  {selectedDistanceId && (
                    <>
                      {" "}
                      → Distance sélectionnée :{" "}
                      {getDistanceLabel(
                        distances.find((d) => d.id === selectedDistanceId)!
                      )}
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Résumé des participants (et affectation)
                </Label>
                <ScrollArea className="h-[600px] border-2 rounded-lg p-4 mt-2 bg-gray-50/50">
                  <div className="space-y-3">
                    {ergResults.participants.map((p: any, idx: number) => {
                      if (p.__include === false) return null;

                      const mapped = eventParticipants.find(
                        (ep) => ep.id === p.__mapped_participant_id
                      );
                      const targetDistance = selectedDistanceId
                        ? distances.find((d) => d.id === selectedDistanceId)
                        : undefined;
                      // Récupérer tous les équipages du participant
                      const allParticipantCrews =
                        mapped && mapped.crews && mapped.crews.length > 0
                          ? mapped.crews
                              .map((c) =>
                                eventCrews.find((ec) => ec.id === c.id)
                              )
                              .filter(Boolean)
                          : [];
                      // Filtrer par distance, mais inclure toujours l'équipage déjà sélectionné
                      const selectedCrewId = p.__mapped_crew_id;
                      const participantCrews = allParticipantCrews.filter((crew: any) => {
                        // Toujours inclure l'équipage déjà sélectionné
                        if (selectedCrewId && crew.id === selectedCrewId) {
                          return true;
                        }
                        // Sinon, filtrer par compatibilité de distance
                        return isCrewCompatibleWithDistance(crew, targetDistance);
                      });
                      const score: number | undefined = p.__match_score;
                      const searchQuery =
                        participantSearchQueries[idx] || "";

                      return (
                          <div
                            key={idx}
                            className="flex flex-col gap-3 border-2 border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 overflow-hidden">
                                <div className="flex items-center gap-3">
                                  <span className="text-base font-semibold text-gray-900">
                                    Couloir {p.lane_number ?? p.lane ?? "?"}
                                  </span>
                                  <span className="text-base font-medium text-gray-800">
                                    {p.participant || "EMPTY"}
                                  </span>
                                  {p.score || p.time ? (
                                    <span className="text-base font-bold text-blue-600">
                                      {p.score || p.time}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              {typeof score === "number" && score > 0 ? (
                                <span
                                  className={`text-sm px-3 py-1.5 rounded-full font-semibold whitespace-nowrap ${
                                    score >= 80
                                      ? "bg-green-100 text-green-800 border border-green-300"
                                      : score >= 60
                                      ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                                      : "bg-orange-100 text-orange-800 border border-orange-300"
                                  }`}
                                >
                                  Auto-affecté ({score}%)
                                </span>
                              ) : (
                                <span className="text-sm px-3 py-1.5 rounded-full font-semibold bg-red-100 text-red-800 border border-red-300 whitespace-nowrap">
                                  Non affecté
                                </span>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                onClick={() => {
                                  if (!ergResults) return;
                                  const updated = ergResults.participants.map(
                                    (pp: any, i: number) =>
                                      i === idx
                                        ? { ...pp, __include: false }
                                        : pp
                                  );
                                  setErgResults({
                                    ...ergResults,
                                    participants: updated,
                                  });
                                  setNonEmptyParticipantsCount(
                                    updated.filter(
                                      (pp: any) => pp.__include
                                    ).length
                                  );
                                }}
                                title="Exclure cette ligne de l'import"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                Affecté à :
                              </span>
                              <Select
                                value={p.__mapped_participant_id || "__none__"}
                                open={openParticipantSelects[idx] || false}
                                onOpenChange={(open) => {
                                  setOpenParticipantSelects((prev) => ({
                                    ...prev,
                                    [idx]: open,
                                  }));
                                  if (!open) {
                                    setParticipantSearchQueries((prev) => ({
                                      ...prev,
                                      [idx]: "",
                                    }));
                                  }
                                }}
                                onValueChange={(value) => {
                                  if (!ergResults) return;
                                  const updated =
                                    ergResults.participants.map(
                                      (pp: any, i: number) =>
                                        i === idx
                                          ? {
                                              ...pp,
                                              __mapped_participant_id:
                                                value === "__none__"
                                                  ? undefined
                                                  : value,
                                              __mapped_crew_id: undefined,
                                            }
                                          : pp
                                    );
                                  setErgResults({
                                    ...ergResults,
                                    participants: updated,
                                  });
                                  setOpenParticipantSelects((prev) => ({
                                    ...prev,
                                    [idx]: false,
                                  }));
                                  setParticipantSearchQueries((prev) => ({
                                    ...prev,
                                    [idx]: "",
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-10 px-3 py-2 text-sm font-medium">
                                  <SelectValue placeholder="Aucun participant lié" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64 p-0">
                                  {/* Barre de recherche participants */}
                                  <div className="sticky top-0 z-10 bg-background border-b p-3">
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                      <Input
                                        placeholder="Rechercher un participant..."
                                        className="h-10 pl-10 pr-3 text-sm"
                                        value={searchQuery}
                                        onChange={(e) => {
                                          const q = e.target.value;
                                          setParticipantSearchQueries((prev) => ({
                                            ...prev,
                                            [idx]: q,
                                          }));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  </div>
                                  <ScrollArea className="max-h-56">
                                    <SelectItem value="__none__">
                                      Aucun participant lié
                                    </SelectItem>
                                    {eventParticipants
                                      .filter((ep) => {
                                        const q = searchQuery
                                          .toLowerCase()
                                          .trim();
                                        if (!q) return true;
                                        const fullName = `${ep.last_name} ${ep.first_name}`
                                          .toLowerCase()
                                          .trim();
                                        const club = (
                                          ep.club_name || ""
                                        ).toLowerCase();
                                        const license = (
                                          ep.license_number || ""
                                        ).toLowerCase();
                                        return (
                                          fullName.includes(q) ||
                                          club.includes(q) ||
                                          license.includes(q)
                                        );
                                      })
                                      .map((ep) => (
                                        <SelectItem key={ep.id} value={ep.id} className="text-sm py-2">
                                          {ep.last_name.toUpperCase()}{" "}
                                          {ep.first_name}
                                          {ep.club_name
                                            ? ` – ${ep.club_name}`
                                            : ""}
                                          {ep.license_number
                                            ? ` (${ep.license_number})`
                                            : ""}
                                        </SelectItem>
                                      ))}
                                  </ScrollArea>
                                </SelectContent>
                              </Select>
                            </div>
                            {mapped && (
                              <div className="flex flex-col gap-2 text-sm text-gray-600 bg-gray-50 rounded-md p-3 border border-gray-200">
                                <div>
                                  <span className="font-semibold text-gray-700">Lié à :</span>{" "}
                                  <span className="font-semibold text-gray-900">
                                    {mapped.last_name.toUpperCase()}{" "}
                                    {mapped.first_name}
                                  </span>
                                  {mapped.club_name && (
                                    <span className="text-gray-600"> – {mapped.club_name}</span>
                                  )}
                                </div>
                                {participantCrews.length > 0 && (
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-gray-700 whitespace-nowrap">Équipage :</span>
                                    <Select
                                      value={
                                        p.__mapped_crew_id ||
                                        (participantCrews[0] as any).id
                                      }
                                      onValueChange={(value) => {
                                        if (!ergResults) return;
                                        const updated =
                                          ergResults.participants.map(
                                            (pp: any, i: number) =>
                                              i === idx
                                                ? {
                                                    ...pp,
                                                    __mapped_crew_id: value,
                                                  }
                                                : pp
                                          );
                                        setErgResults({
                                          ...ergResults,
                                          participants: updated,
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="h-10 px-3 py-2 text-sm font-medium">
                                        <SelectValue placeholder="Choisir un équipage" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-64 p-0">
                                        {/* Barre de recherche */}
                                        <div className="sticky top-0 z-10 bg-background border-b p-3">
                                          <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                              placeholder="Rechercher un équipage..."
                                              className="h-10 pl-10 pr-3 text-sm"
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => {
                                                const q = e.target.value
                                                  .toLowerCase()
                                                  .trim();
                                                const filtered = participantCrews.filter(
                                                  (crew: any) => {
                                                    const label = (
                                                      crew.category?.label ||
                                                      crew.category?.code ||
                                                      ""
                                                    )
                                                      .toString()
                                                      .toLowerCase();
                                                    const club = (
                                                      crew.club_name || ""
                                                    )
                                                      .toString()
                                                      .toLowerCase();
                                                    const participantsLabel = (
                                                      crew.crew_participants ||
                                                      []
                                                    )
                                                      .map(
                                                        (cp: any) =>
                                                          `${cp.participant?.last_name || ""} ${cp.participant?.first_name || ""}`
                                                      )
                                                      .join(" ")
                                                      .toLowerCase();
                                                    return (
                                                      !q ||
                                                      label.includes(q) ||
                                                      club.includes(q) ||
                                                      participantsLabel.includes(
                                                        q
                                                      )
                                                    );
                                                  }
                                                );
                                                // On remplace temporairement la liste affichée
                                                // en modifiant participantCrews localement n'est pas possible,
                                                // on filtrera plutôt directement dans le rendu ci-dessous
                                                (participantCrews as any)._filter =
                                                  q;
                                              }}
                                            />
                                          </div>
                                        </div>
                                        {/* Liste filtrée */}
                                        <ScrollArea className="max-h-56">
                                          {participantCrews.map((crew: any) => {
                                            const labelCat =
                                              crew.category?.label ||
                                              crew.category?.code ||
                                              "Équipage";
                                            const clubLabel =
                                              crew.club_name || "Club ?";
                                            const participantsLabel = (
                                              crew.crew_participants || []
                                            )
                                              .map((cp: any) =>
                                                cp.participant
                                                  ? `${cp.participant.last_name.toUpperCase()} ${cp.participant.first_name}`
                                                  : ""
                                              )
                                              .filter(Boolean)
                                              .join(" • ");
                                            return (
                                              <SelectItem
                                                key={crew.id}
                                                value={crew.id}
                                                className="text-sm py-2"
                                              >
                                                {labelCat} – {clubLabel}
                                                {participantsLabel && (
                                                  <span className="text-xs text-muted-foreground ml-2">
                                                    ({participantsLabel})
                                                  </span>
                                                )}
                                              </SelectItem>
                                            );
                                          })}
                                        </ScrollArea>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                    })}
                  </div>
                </ScrollArea>
              </div>

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
                    "Créer la course et importer les résultats"
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


