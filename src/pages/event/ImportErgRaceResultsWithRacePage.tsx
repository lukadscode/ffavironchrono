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

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Upload,
} from "lucide-react";

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
      const total = results.participants.length;
      const nonEmpty = results.participants.filter(
        (p) => p.participant && p.participant !== "EMPTY"
      ).length;
      const laneNumbers = results.participants
        .map((p) => (p.lane_number ?? p.lane) as number | undefined)
        .filter((lane): lane is number => typeof lane === "number" && lane > 0);
      const computedLaneCount =
        laneNumbers.length > 0 ? Math.max(...laneNumbers) : total;

      setParticipantsCount(total);
      setNonEmptyParticipantsCount(nonEmpty);
      setLaneCount(computedLaneCount);

      setErgResults(results);
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
    return participants.map((participant: ErgRaceParticipant) => {
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

      return normalized;
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

      // 2) Importer les résultats indoor via l'endpoint existant
      const normalizedParticipants = normalizeParticipantsForBackend(
        ergResults.participants
      );

      const payload = {
        results: {
          ...ergResults,
          participants: normalizedParticipants,
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
                      {distances.find((d) => d.id === selectedDistanceId)?.label}
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <div>
                <Label>Résumé des participants</Label>
                <ScrollArea className="h-48 border rounded-md p-3 mt-1 text-xs">
                  <div className="space-y-1">
                    {ergResults.participants.slice(0, 30).map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between border-b pb-1 last:border-b-0"
                      >
                        <span>
                          Couloir{" "}
                          {p.lane_number ?? p.lane ?? "?"} –{" "}
                          {p.participant || "EMPTY"}
                        </span>
                        <span className="text-muted-foreground">
                          {p.score || p.time || ""}
                        </span>
                      </div>
                    ))}
                    {ergResults.participants.length > 30 && (
                      <div className="text-center text-muted-foreground mt-2">
                        + {ergResults.participants.length - 30} lignes
                        supplémentaires...
                      </div>
                    )}
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


