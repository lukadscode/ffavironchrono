import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { initializeClubsCache, getClubByShortCode } from "@/api/clubs";
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
import { AlertTriangle, ArrowLeft, Loader2, Upload } from "lucide-react";

type Distance = {
  id: string;
  meters: number | null;
  is_time_based: boolean;
  duration_seconds: number | null;
  label: string;
};

type Phase = { id: string; name: string };

function distanceLabel(d: Distance): string {
  if (d.label) return d.label;
  if (d.is_time_based && d.duration_seconds != null)
    return `${d.duration_seconds}s`;
  if (!d.is_time_based && d.meters != null) return `${d.meters}m`;
  return "—";
}

type ErgRaceParticipant = Record<string, unknown> & {
  lane?: number;
  lane_number?: number;
  participant?: string;
  affiliation?: string;
  class?: string;
  score?: string | number;
  time?: string | number;
  distance?: number;
  splits?: unknown[];
};

type ErgRaceResultsPayload = {
  duration?: number;
  race_duration_type?: "distance" | "time";
  race_name?: string;
  race_file_name?: string;
  race_start_time?: string;
  participants: ErgRaceParticipant[];
  c2_race_id?: string;
  race_id?: string;
  [key: string]: unknown;
};

type EventParticipant = {
  id: string;
  first_name: string;
  last_name: string;
  club_name?: string;
  license_number?: string | null;
};

const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Format ErgRace habituel : « NOM, Prénom » (voir ImportErgRaceResultsWithRacePage) */
const parseErgRaceName = (
  name: string
): { lastName: string; firstName: string } => {
  const normalized = normalizeName(name);
  const parts = normalized.split(",").map((p) => p.trim());
  if (parts.length >= 2 && parts[0].length > 0) {
    return {
      lastName: parts[0],
      firstName: parts.slice(1).join(" "),
    };
  }
  const tokens = normalized.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return {
      lastName: tokens[0],
      firstName: tokens.slice(1).join(" "),
    };
  }
  return { lastName: normalized, firstName: "" };
};

const computeMatchScore = (
  ergraceName: string | undefined,
  ergraceAffiliation: string | undefined,
  p: EventParticipant
): number => {
  if (!ergraceName) return 0;
  const { lastName: ergLastRaw, firstName: ergFirstRaw } =
    parseErgRaceName(ergraceName);
  const ergLast = normalizeName(ergLastRaw);
  const ergFirst = normalizeName(ergFirstRaw);
  const pLast = normalizeName(p.last_name);
  const pFirst = normalizeName(p.first_name);

  let score = 0;
  if (ergLast === pLast && ergFirst === pFirst) score = 100;
  else if (ergLast === pLast) {
    if (
      ergFirst &&
      pFirst &&
      (pFirst.startsWith(ergFirst) || ergFirst.startsWith(pFirst))
    )
      score = 85;
    else score = 70;
  } else if (pLast.includes(ergLast) || ergLast.includes(pLast)) score = 50;
  else return 0;

  if (ergraceAffiliation && score >= 40) {
    const ac = normalizeName(ergraceAffiliation);
    const pc = normalizeName(p.club_name || "");
    if (ac && pc && (ac === pc || pc.includes(ac) || ac.includes(pc)))
      score = Math.min(100, score + 10);
  }
  return score;
};

/** Ex. 60F + 500 → 60F1I_500m ; classe « 60F PL » → 60F1I PL_500m */
function buildIndoorCategoryCode(
  ergClass: string | undefined,
  distanceMeters: number
): string {
  const raw = (ergClass ?? "").trim();
  const d = Math.round(Number(distanceMeters)) || 0;
  const hasPl = /\bPL\b/i.test(raw);
  const base = raw
    .replace(/\bPL\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (hasPl) return `${base}1I PL_${d}m`;
  return `${base}1I_${d}m`;
}

function normalizeParticipantsForBackend(
  participants: ErgRaceParticipant[]
): ErgRaceParticipant[] {
  return participants.map((participant, index) => {
    const normalized: ErgRaceParticipant = { ...participant };

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

    if (!normalized.id || String(normalized.id).trim().length === 0) {
      const laneValue =
        normalized.lane_number ?? normalized.lane ?? index + 1;
      normalized.id = `ergrace-${laneValue}-${index}`;
    }

    return normalized;
  });
}

const MATCH_MIN_SCORE = 68;

/** Couloir sans rameur (ErgRace) — à ignorer pour équipages / import */
function isErgRaceRowEmpty(row: ErgRaceParticipant): boolean {
  const name =
    row.participant != null ? String(row.participant).trim() : "";
  const cls = row.class != null ? String(row.class).trim() : "";
  if (cls.toUpperCase() === "EMPTY") return true;
  if (name.toUpperCase() === "EMPTY") return true;
  return false;
}

/** Distance course : priorité `results.duration`, sinon premier participant non-EMPTY avec distance > 0 */
function resolveErgDistanceMeters(
  results: ErgRaceResultsPayload
): number | null {
  if (typeof results.duration === "number" && results.duration > 0) {
    return results.duration;
  }
  for (const p of results.participants) {
    if (isErgRaceRowEmpty(p)) continue;
    const d = p.distance;
    if (typeof d === "number" && d > 0) return d;
  }
  return null;
}

function rowLaneNumber(
  row: ErgRaceParticipant,
  index: number
): number {
  if (typeof row.lane === "number" && row.lane > 0) return row.lane;
  if (typeof row.lane_number === "number" && row.lane_number > 0) {
    return row.lane_number;
  }
  return index + 1;
}

function resolveLicenseNumber(
  row: ErgRaceParticipant,
  ergName: string,
  index: number
): string {
  const rawFromRow =
    row.logbook_id != null ? String(row.logbook_id).trim() : "";
  if (rawFromRow.length > 0) return rawFromRow;

  const inParens = ergName.match(/\((\d{4,})\)/)?.[1];
  if (inParens) return inParens;

  const fromId = row.id != null ? String(row.id).match(/\d{4,}/)?.[0] : null;
  if (fromId) return fromId;

  const lane = rowLaneNumber(row, index);
  return `ERG-${Date.now()}-${lane}-${index + 1}`;
}

/**
 * API : Homme / Femme / Mixte — déduit depuis la classe ErgRace (ex. 60F, J16H, OPEN M).
 */
function inferGenderFromErgClass(
  ergClass: string | undefined
): "Homme" | "Femme" | "Mixte" {
  const raw = (ergClass ?? "").trim();
  if (!raw) return "Mixte";
  if (/FEMME|DAMES?|FÉMININ|FEMININ/i.test(raw)) return "Femme";
  if (/HOMME|MESSIEURS?|MASCULIN/i.test(raw)) return "Homme";

  let compact = raw.replace(/\s/g, "").toUpperCase();
  if (compact.endsWith("PL")) compact = compact.slice(0, -2);

  if (compact.endsWith("F")) return "Femme";
  if (compact.endsWith("H")) return "Homme";
  if (compact.endsWith("M")) return "Homme";

  return "Mixte";
}

/** Message API lisible (toast / debug) */
function formatAxiosError(err: unknown): string {
  if (err instanceof Error && !("response" in err)) {
    return err.message;
  }
  const ax = err as {
    response?: { data?: Record<string, unknown> };
  };
  const d = ax.response?.data;
  if (d && typeof d === "object") {
    if (typeof d.message === "string") return d.message;
    if (Array.isArray(d.errors)) {
      return (d.errors as unknown[])
        .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
        .filter(Boolean)
        .join("; ");
    }
    if (typeof d.error === "string") return d.error;
    try {
      const s = JSON.stringify(d);
      if (s && s !== "{}" && s.length < 800) return s;
    } catch {
      /* ignore */
    }
  }
  if (err instanceof Error) return err.message;
  return "Échec de l’import super admin.";
}

async function createParticipantWithApiCompatibility(
  eventId: string,
  payload: {
    first_name: string;
    last_name: string;
    license_number: string;
    gender: "Homme" | "Femme" | "Mixte";
    club_name?: string;
  }
) {
  try {
    return await api.post("/participants", {
      event_id: eventId,
      ...payload,
    });
  } catch (err: unknown) {
    const message = formatAxiosError(err).toLowerCase();
    if (message.includes('"event_id" is not allowed')) {
      return await api.post("/participants", payload);
    }
    throw err;
  }
}

export default function ImportErgRaceResultsSuperAdminPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const isSuperAdmin = user?.role === "superadmin";

  const [categories, setCategories] = useState<{ id: string; code: string }[]>(
    []
  );
  const [distances, setDistances] = useState<Distance[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);

  const [raceName, setRaceName] = useState("");
  const [raceNumber, setRaceNumber] = useState(1);
  const [startTime, setStartTime] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [selectedDistanceId, setSelectedDistanceId] = useState("");
  const [laneCount, setLaneCount] = useState<number | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [ergResults, setErgResults] = useState<ErgRaceResultsPayload | null>(
    null
  );
  const [importing, setImporting] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate(`/event/${eventId}/indoor`);
    }
  }, [isSuperAdmin, eventId, navigate]);

  const fetchNextRaceNumber = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const races = res.data?.data || [];
      if (Array.isArray(races) && races.length > 0) {
        const maxNumber = races.reduce(
          (max: number, r: { race_number?: number }) =>
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
      console.error(err);
    }
  }, [eventId]);

  const loadSetup = useCallback(async () => {
    if (!eventId) return;
    setLoadingSetup(true);
    try {
      await initializeClubsCache();
      const [catRes, distRes, phaseRes] = await Promise.all([
        api.get(`/categories/event/${eventId}/with-crews`),
        api.get(`/distances/event/${eventId}`),
        api.get(`/race-phases/${eventId}`),
      ]);
      const cats = catRes.data?.data || [];
      setCategories(
        cats.map((c: { id: string; code: string }) => ({
          id: c.id,
          code: c.code || "",
        }))
      );
      setDistances(distRes.data?.data || []);
      const ph = phaseRes.data?.data || [];
      setPhases(ph);
      if (ph.length === 1) {
        setPhaseId(ph[0].id);
      }
      await fetchNextRaceNumber();
    } catch (err) {
      console.error(err);
      toast({
        title: "Erreur",
        description: "Impossible de charger phases, distances ou catégories.",
        variant: "destructive",
      });
    } finally {
      setLoadingSetup(false);
    }
  }, [eventId, toast, fetchNextRaceNumber]);

  useEffect(() => {
    if (eventId && isSuperAdmin) loadSetup();
  }, [eventId, isSuperAdmin, loadSetup]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".json")) {
      toast({
        title: "Format",
        description: "Utilisez un fichier JSON ErgRace.",
        variant: "destructive",
      });
      return;
    }
    setFile(f);
    try {
      const parsed = JSON.parse(await f.text());
      let results: ErgRaceResultsPayload;
      if (parsed.results?.participants) {
        results = parsed.results as ErgRaceResultsPayload;
      } else if (parsed.participants) {
        results = parsed as ErgRaceResultsPayload;
      } else {
        throw new Error("participants manquants");
      }
      if (!Array.isArray(results.participants) || !results.participants.length) {
        throw new Error("aucun participant");
      }
      const realRows = results.participants.filter(
        (p) => !isErgRaceRowEmpty(p as ErgRaceParticipant)
      );
      if (realRows.length === 0) {
        toast({
          title: "Aucun résultat à importer",
          description:
            "Toutes les lignes sont des couloirs vides (EMPTY). Choisissez un autre fichier.",
          variant: "destructive",
        });
        setFile(null);
        setErgResults(null);
        return;
      }
      setErgResults(results);

      const nameFromFile =
        (typeof results.race_name === "string" && results.race_name) ||
        (typeof results.race_file_name === "string" && results.race_file_name) ||
        f.name.replace(/\.json$/i, "") ||
        "Course indoor";
      setRaceName(nameFromFile);

      if (results.race_start_time) {
        const dt = dayjs(results.race_start_time);
        if (dt.isValid()) setStartTime(dt.format("YYYY-MM-DDTHH:mm"));
      }

      const durType = results.race_duration_type ?? "distance";
      const dur = resolveErgDistanceMeters(results);

      if (dur != null && distances.length) {
        if (durType === "time") {
          const m = distances.find(
            (d) =>
              d.is_time_based &&
              d.duration_seconds != null &&
              Number(d.duration_seconds) === Number(dur)
          );
          if (m) setSelectedDistanceId(m.id);
        } else {
          const m = distances.find(
            (d) =>
              !d.is_time_based &&
              d.meters != null &&
              Number(d.meters) === Number(dur)
          );
          if (m) setSelectedDistanceId(m.id);
        }
      }

      const laneNums = results.participants
        .map((p) =>
          typeof p.lane === "number"
            ? p.lane
            : typeof p.lane_number === "number"
              ? p.lane_number
              : undefined
        )
        .filter((n): n is number => typeof n === "number" && n > 0);
      const lc =
        laneNums.length > 0
          ? Math.max(...laneNums)
          : results.participants.length;
      setLaneCount(lc);

      const emptyCount = results.participants.length - realRows.length;
      toast({
        title: "Fichier lu",
        description: `${realRows.length} ligne(s) à importer${
          emptyCount > 0
            ? ` (${emptyCount} couloir(s) EMPTY ignoré(s))`
            : ""
        }. Renseignez la phase et vérifiez la distance.`,
      });
    } catch {
      setFile(null);
      setErgResults(null);
      toast({
        title: "Fichier invalide",
        description: "JSON ErgRace résultats attendu.",
        variant: "destructive",
      });
    }
  };

  const runImport = async () => {
    if (!eventId || !ergResults) {
      toast({
        title: "Incomplet",
        description: "Chargez un fichier JSON ErgRace.",
        variant: "destructive",
      });
      return;
    }
    if (!raceName.trim()) {
      toast({
        title: "Nom requis",
        description: "Indiquez un nom pour la course.",
        variant: "destructive",
      });
      return;
    }
    if (!phaseId) {
      toast({
        title: "Phase requise",
        description: "Sélectionnez une phase de course.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedDistanceId) {
      toast({
        title: "Distance requise",
        description: "Sélectionnez la distance de la course.",
        variant: "destructive",
      });
      return;
    }

    const includedParticipants = ergResults.participants.filter(
      (p) => !isErgRaceRowEmpty(p)
    );
    if (includedParticipants.length === 0) {
      toast({
        title: "Aucun participant",
        description:
          "Toutes les lignes sont des couloirs vides (EMPTY). Import impossible.",
        variant: "destructive",
      });
      return;
    }

    const duration = resolveErgDistanceMeters(ergResults);

    if (duration == null || !Number.isFinite(duration) || duration <= 0) {
      toast({
        title: "Distance",
        description:
          'Impossible de déterminer la distance (champ "duration" ou "distance" participant).',
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const allLaneNums = ergResults.participants
        .map((p) =>
          typeof p.lane === "number"
            ? p.lane
            : typeof p.lane_number === "number"
              ? p.lane_number
              : undefined
        )
        .filter((n): n is number => typeof n === "number" && n > 0);
      const maxLaneAll =
        allLaneNums.length > 0 ? Math.max(...allLaneNums) : 0;

      const maxLaneIncluded = Math.max(
        0,
        ...includedParticipants.map((p, i) => rowLaneNumber(p, i))
      );

      /** Ne jamais sous-dimensionner : ErgRace peut avoir couloir 66 alors que le champ UI vaut 8 */
      const effectiveLaneCount = Math.max(
        laneCount ?? 0,
        maxLaneAll,
        maxLaneIncluded,
        includedParticipants.length,
        8
      );

      const racePayload: Record<string, unknown> = {
        phase_id: phaseId,
        name: raceName.trim(),
        race_number: raceNumber,
        distance_id: selectedDistanceId,
        lane_count: effectiveLaneCount,
        race_type: "course en ligne",
      };

      if (startTime) {
        racePayload.start_time = new Date(startTime).toISOString();
      } else if (ergResults.race_start_time) {
        const dt = dayjs(ergResults.race_start_time as string);
        if (dt.isValid()) {
          racePayload.start_time = dt.toDate().toISOString();
        }
      }

      const raceRes = await api.post("/races", racePayload);
      const selectedRaceId = String(
        raceRes.data?.data?.id || raceRes.data?.id
      );

      let participantCache: EventParticipant[] = [];
      const partRes = await api.get(`/participants/event/${eventId}`);
      participantCache = (partRes.data?.data || partRes.data || []).map(
        (p: Record<string, unknown>) => ({
          id: String(p.id),
          first_name: String(p.first_name ?? ""),
          last_name: String(p.last_name ?? ""),
          club_name: p.club_name ? String(p.club_name) : undefined,
          license_number: (p.license_number as string) ?? null,
        })
      );

      const laneToCrewId = new Map<number, string>();

      for (let index = 0; index < includedParticipants.length; index++) {
        const row = includedParticipants[index];
        const ergName = row.participant ? String(row.participant) : "";
        const affiliation = row.affiliation ? String(row.affiliation).trim() : "";
        const ergClass = row.class ? String(row.class) : "";
        const catCode = buildIndoorCategoryCode(ergClass, duration);
        const category = categories.find(
          (c) => c.code === catCode || c.code.toLowerCase() === catCode.toLowerCase()
        );
        if (!category) {
          throw new Error(
            `Catégorie introuvable pour le code « ${catCode} » (classe ErgRace « ${ergClass} », ${duration} m). Créez-la dans l’événement.`
          );
        }

        const club = affiliation ? await getClubByShortCode(affiliation) : null;

        let best: EventParticipant | null = null;
        let bestScore = 0;
        for (const p of participantCache) {
          const s = computeMatchScore(ergName, affiliation || undefined, p);
          if (s > bestScore) {
            bestScore = s;
            best = p;
          }
        }

        let participantId: string;
        if (best && bestScore >= MATCH_MIN_SCORE) {
          participantId = best.id;
        } else {
          const { lastName, firstName } = parseErgRaceName(ergName);
          const licenseNumber = resolveLicenseNumber(row, ergName, index);
          const gender = inferGenderFromErgClass(ergClass);
          const createRes = await createParticipantWithApiCompatibility(
            eventId,
            {
            first_name: (firstName || "").trim() || "Non renseigné",
            last_name: (lastName || "").trim() || "Non renseigné",
            license_number: licenseNumber,
            gender,
            club_name: club?.nom || affiliation || undefined,
            }
          );
          participantId = String(
            createRes.data?.data?.id || createRes.data?.id
          );
          const created: EventParticipant = {
            id: participantId,
            first_name: (firstName || "").trim() || "Non renseigné",
            last_name: (lastName || "").trim() || "Non renseigné",
            club_name: club?.nom || affiliation,
            license_number: licenseNumber,
          };
          participantCache.push(created);
        }

        const crewRes = await api.post("/crews", {
          event_id: eventId,
          category_id: category.id,
          ...(club?.code ? { club_code: club.code } : {}),
          club_name: club?.nom || affiliation || undefined,
        });
        const crewId = String(crewRes.data?.data?.id || crewRes.data?.id);

        await api.post("/crew-participants", {
          crew_id: crewId,
          participant_id: participantId,
          seat_position: 1,
          is_coxswain: false,
        });

        const laneNum = rowLaneNumber(row, index);

        await api.post("/race-crews", {
          race_id: selectedRaceId,
          crew_id: crewId,
          lane: laneNum,
        });

        laneToCrewId.set(laneNum, crewId);
      }

      const normalizedParticipants = normalizeParticipantsForBackend(
        includedParticipants
      ).map((np, index) => {
        const laneValue = rowLaneNumber(np, index);
        const crewId = laneToCrewId.get(laneValue);
        if (crewId) {
          return { ...np, crew_id: crewId, id: crewId };
        }
        return np;
      });

      const payload = {
        results: {
          ...ergResults,
          participants: normalizedParticipants,
          race_id:
            ergResults.race_id && String(ergResults.race_id).trim()
              ? ergResults.race_id
              : selectedRaceId,
          c2_race_id: selectedRaceId,
        },
      };

      const response = await api.post("/indoor-results/import", payload);

      try {
        await api.put(`/races/${selectedRaceId}`, { status: "non_official" });
      } catch (statusErr) {
        console.error(statusErr);
      }

      toast({
        title: "Import terminé",
        description: `${response.data?.data?.participants_count ?? includedParticipants.length} participant(s).`,
      });
      navigate(`/event/${eventId}/indoor/${selectedRaceId}`);
    } catch (err: unknown) {
      console.error(err);
      toast({
        title: "Erreur import",
        description: formatAxiosError(err),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  if (!isSuperAdmin) return null;

  if (loadingSetup) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/event/${eventId}/indoor`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Import résultats ErgRace (super admin)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Création d&apos;une <strong>nouvelle course</strong>, puis des
          équipages (catégorie{" "}
          <code className="text-xs">classe1I_distance</code>, club = code court
          FFA) et import des résultats. Réservé aux super administrateurs.
        </p>
      </div>

      <Alert className="border-amber-600 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <AlertDescription className="text-amber-900">
          Aucune course existante n&apos;est requise : elle est créée
          automatiquement avec les paramètres ci-dessous avant l&apos;import des
          lignes du fichier.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>1. Fichier JSON ErgRace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="json-sa">Résultats (.json)</Label>
            <InputLikeFile onChange={handleFile} disabled={importing} />
            {file && (
              <p className="text-xs text-muted-foreground">{file.name}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Nouvelle course</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="sa-race-name">Nom de la course *</Label>
              <Input
                id="sa-race-name"
                value={raceName}
                onChange={(e) => setRaceName(e.target.value)}
                placeholder="Ex. 60F 500m — série 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-race-num">Numéro de course *</Label>
              <Input
                id="sa-race-num"
                type="number"
                min={1}
                value={raceNumber}
                onChange={(e) =>
                  setRaceNumber(parseInt(e.target.value, 10) || 1)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-start">Heure de départ</Label>
              <Input
                id="sa-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phase *</Label>
              <Select value={phaseId} onValueChange={setPhaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {phases.length === 0 && (
                <p className="text-xs text-destructive">
                  Créez une phase dans l&apos;événement avant d&apos;importer.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Distance *</Label>
              <Select
                value={selectedDistanceId}
                onValueChange={setSelectedDistanceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Distance" />
                </SelectTrigger>
                <SelectContent>
                  {distances.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {distanceLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {distances.length === 0 && (
                <p className="text-xs text-destructive">
                  Créez les distances dans l&apos;événement.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-lanes">Nombre de couloirs</Label>
              <Input
                id="sa-lanes"
                type="number"
                min={1}
                value={laneCount ?? ""}
                placeholder="auto"
                onChange={(e) => {
                  const v = e.target.value;
                  setLaneCount(v === "" ? null : parseInt(v, 10) || 1);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Pré-rempli si le fichier contient des numéros de couloir.
              </p>
            </div>
          </div>

          <Button
            onClick={runImport}
            disabled={
              importing ||
              !ergResults ||
              !phaseId ||
              !selectedDistanceId ||
              !raceName.trim()
            }
            className="bg-amber-700 hover:bg-amber-800"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Création + import…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Créer la course et importer
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InputLikeFile({
  onChange,
  disabled,
}: {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="file"
      accept=".json,application/json"
      onChange={onChange}
      disabled={disabled}
      className="text-sm file:mr-3 file:rounded file:border file:bg-slate-50 file:px-3 file:py-1"
    />
  );
}
