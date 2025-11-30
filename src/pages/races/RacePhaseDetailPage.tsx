import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  useDroppable,
  useDraggable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { X, Search, Pencil, Check, XCircle, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import RaceFormDialog from "@/components/races/RaceFormDialog";
import PhaseResultsPanel from "@/components/races/PhaseResultsPanel";

// === Config par défaut ===
const DEFAULT_SLOT_MINUTES = 8;

interface Participant {
  id: string;
  first_name: string;
  last_name: string;
  license_number?: string;
}

interface CrewParticipant {
  id: string;
  participant_id: string;
  is_coxswain: boolean;
  seat_position: number;
  participant: Participant;
}

interface Category {
  id: string;
  label?: string;
  distance_id?: string;
  distance?: {
    id: string;
    meters: number | null;
    is_time_based: boolean;
    duration_seconds: number | null;
    label: string;
  };
}

interface Crew {
  id: string;
  club_name: string;
  club_code: string;
  category_id: string;
  category_label?: string;
  category?: Category;
  status?: string;
  crew_participants?: CrewParticipant[];
}

interface RaceCrew {
  id: string; // race_crews.id (affectation)
  lane: number;
  crew: Crew;
}

interface Race {
  id: string;
  name: string;
  race_type: string;
  lane_count?: number;
  status?: string;
  start_time?: string; // ISO UTC
  race_number?: number; // ordre
  distance_id?: string;
  distance?: {
    id: string;
    meters: number | null;
    is_relay?: boolean;
    relay_count?: number | null;
    is_time_based: boolean;
    duration_seconds: number | null;
    label: string; // Label formaté depuis l'API (ex: "8x250m", "2000m", "2min", "2min 30s")
  };
  crews: RaceCrew[];
}

type DragPreview =
  | { type: "crew"; label: string }
  | { type: "raceCrew"; label: string }
  | { type: "race"; label: string }
  | null;

/** ================== Helper téléchargement (robuste) ================== */
async function downloadPdfSafely(opts: {
  url: string; // ex: "/exports/startlist/phase/123"
  filename?: string;
  onError: (title: string, description?: string) => void;
}) {
  const { url, filename, onError } = opts;
  try {
    const res = await api.get(url, { responseType: "blob", validateStatus: () => true });

    if (res.status < 200 || res.status >= 300) {
      let msg = `HTTP ${res.status}`;
      try {
        const text = await (res.data as any).text?.();
        if (text) {
          try {
            const j = JSON.parse(text);
            if (j?.message) msg = `${msg} — ${j.message}`;
            else if (j?.error) msg = `${msg} — ${j.error}`;
            else msg = `${msg} — ${text}`;
          } catch {
            msg = `${msg} — ${text}`;
          }
        }
      } catch {}
      onError("Export PDF échoué", msg);
      return;
    }

    const ctype = (res.headers?.["content-type"] || "").toLowerCase();
    if (!ctype.includes("pdf")) {
      try {
        const text = await (res.data as any).text?.();
        onError("Export PDF invalide", text || "Le serveur n’a pas renvoyé un PDF.");
      } catch {
        onError("Export PDF invalide", "Le serveur n’a pas renvoyé un PDF.");
      }
      return;
    }

    const dispo = res.headers?.["content-disposition"] || "";
    let suggested = filename || "export.pdf";
    const m = /filename\*?=(?:UTF-8''|")?([^;"\n]+)/i.exec(dispo);
    if (m && m[1]) {
      suggested = decodeURIComponent(m[1].replace(/"/g, ""));
    }

    const blob = new Blob([res.data], { type: "application/pdf" });
    const urlObject = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlObject;
    a.download = suggested;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(urlObject), 2000);
  } catch (e: any) {
    onError("Export PDF échoué", e?.message || "Erreur réseau");
  }
}
/** ===================================================================== */

interface RacePhase {
  id: string;
  name: string;
  order_index: number;
}

// Fonction pour obtenir la distance d'un crew (via catégorie ou course)
// Note: Ces fonctions sont définies après les interfaces pour être utilisées à la fois dans le composant principal et dans TimelineRace
function getCrewDistance(crew: Crew, race?: Race): number | null {
  // Pour les distances basées sur le temps, retourner null car on ne peut pas les utiliser pour le tri par distance
  // Priorité 1: distance via la catégorie du crew
  if (crew.category?.distance?.is_time_based) {
    return null;
  }
  if (crew.category?.distance?.meters) {
    return crew.category.distance.meters;
  }
  if (crew.category?.distance_id && crew.category?.distance?.meters) {
    return crew.category.distance.meters;
  }
  // Priorité 2: distance via la course
  if (race?.distance?.is_time_based) {
    return null;
  }
  if (race?.distance?.meters) {
    return race.distance.meters;
  }
  if (race?.distance_id && race?.distance?.meters) {
    return race.distance.meters;
  }
  return null;
}

// Fonction pour vérifier que tous les crews ont la même distance
function validateRaceDistances(race: Race): { isValid: boolean; distance: number | null; error: string | null } {
  const crewsWithDistance = race.crews
    .map(rc => ({ crew: rc.crew, distance: getCrewDistance(rc.crew, race) }))
    .filter(item => item.distance !== null);

  if (crewsWithDistance.length === 0) {
    return { isValid: true, distance: null, error: null };
  }

  const uniqueDistances = new Set(crewsWithDistance.map(item => item.distance));
  
  if (uniqueDistances.size > 1) {
    const distances = Array.from(uniqueDistances).sort((a, b) => (a || 0) - (b || 0));
    return {
      isValid: false,
      distance: null,
      error: `⚠️ Erreur: Cette course regroupe des équipages avec des distances différentes (${distances.join("m, ")}m). Tous les équipages doivent avoir la même distance.`
    };
  }

  return { isValid: true, distance: crewsWithDistance[0].distance, error: null };
}

// Fonction pour générer le nom de course avec toutes les catégories
function generateRaceNameWithCategories(race: Race, originalName: string): string {
  const categoryLabels = new Set<string>();
  race.crews.forEach(rc => {
    const label = rc.crew.category?.label || rc.crew.category_label;
    if (label) {
      categoryLabels.add(label);
    }
  });

  if (categoryLabels.size === 0) {
    return originalName;
  }

  const categoriesList = Array.from(categoryLabels).sort().join(", ");
  
  // Si le nom original ne contient pas déjà toutes les catégories, on les ajoute
  if (categoryLabels.size > 1 || !originalName.includes(categoriesList)) {
    return `${originalName} [${categoriesList}]`;
  }

  return originalName;
}

export default function RacePhaseDetailPage() {
  const { eventId, phaseId } = useParams();
  const { toast } = useToast();

  const [crews, setCrews] = useState<Crew[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [dragPreview, setDragPreview] = useState<DragPreview>(null);
  const [exporting, setExporting] = useState<{ start?: boolean; weigh?: boolean }>({});
  const [phases, setPhases] = useState<RacePhase[]>([]);
  const [currentPhase, setCurrentPhase] = useState<RacePhase | null>(null);
  const [unassignedSearchQuery, setUnassignedSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [showAllCrews, setShowAllCrews] = useState<boolean>(true);
  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set());

  // === Nouveaux états pour la timeline + gaps dynamiques ===
  const [slotMinutes, setSlotMinutes] = useState<number>(DEFAULT_SLOT_MINUTES);
  const [firstStartLocal, setFirstStartLocal] = useState<string>(""); // "YYYY-MM-DDTHH:mm"
  // minutes entre une course et la suivante: key = race.id
  const [gapsByRaceId, setGapsByRaceId] = useState<Record<string, number>>({});

  const fetchPhases = async () => {
    try {
      const res = await api.get(`/race-phases/${eventId}`);
      const allPhases = res.data.data.sort((a: RacePhase, b: RacePhase) => a.order_index - b.order_index);
      setPhases(allPhases);
      const current = allPhases.find((p: RacePhase) => p.id === phaseId);
      setCurrentPhase(current || null);
    } catch {
      toast({ title: "Erreur chargement phases", variant: "destructive" });
    }
  };

  const fetchCrews = async () => {
    try {
      const res = await api.get(`/crews/event/${eventId}`);
      const crewsData = res.data.data || [];
      
      // Enrichir chaque crew avec ses participants
      const crewsWithParticipants = await Promise.all(
        crewsData.map(async (crew: any) => {
          try {
            // Récupérer les détails complets du crew (incluant les participants)
            const crewDetailRes = await api.get(`/crews/${crew.id}`);
            const crewDetail = crewDetailRes.data.data || crewDetailRes.data;
            
            // Retourner le crew avec ses participants
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
            // Si erreur, retourner le crew sans participants
            return {
              ...crew,
              crew_participants: crew.crew_participants || [],
            };
          }
        })
      );
      
      setCrews(crewsWithParticipants);
    } catch {
      toast({ title: "Erreur chargement équipages", variant: "destructive" });
    }
  };

  const fetchRaces = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const phaseRaces: Race[] = res.data.data.filter((r: any) => r.phase_id === phaseId);

      const racesWithCrews: Race[] = await Promise.all(
        phaseRaces.map(async (race: any) => {
          const crewRes = await api.get(`/race-crews/${race.id}`);
          return { ...race, crews: crewRes.data.data } as Race;
        })
      );

      const sorted = racesWithCrews.sort((a,b) => (a.race_number||0) - (b.race_number||0));

      // Restaurer l'intervalle par défaut depuis localStorage ou utiliser la valeur par défaut
      const savedSlotMinutes = localStorage.getItem(`phase_${phaseId}_slotMinutes`);
      if (savedSlotMinutes) {
        setSlotMinutes(Number(savedSlotMinutes));
      }

      // Pré-remplir l'heure de départ initiale depuis les courses existantes
      const existing = sorted
        .map(r => r.start_time ? new Date(r.start_time) : null)
        .filter((d): d is Date => !!d)
        .sort((a,b) => a.getTime() - b.getTime());
      if (existing.length) {
        setFirstStartLocal(toLocalInputValue(existing[0]));
      } else {
        // Restaurer depuis localStorage ou utiliser la valeur par défaut
        const savedFirstStart = localStorage.getItem(`phase_${phaseId}_firstStartLocal`);
        if (savedFirstStart) {
          setFirstStartLocal(savedFirstStart);
        } else {
          const d = new Date(); d.setHours(9,0,0,0); 
          setFirstStartLocal(toLocalInputValue(d));
        }
      }

      // Calculer les gaps réels entre les courses depuis les start_time
      const calculatedGaps: Record<string, number> = {};
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (current.start_time && next.start_time) {
          const currentTime = new Date(current.start_time).getTime();
          const nextTime = new Date(next.start_time).getTime();
          const diffMinutes = Math.round((nextTime - currentTime) / (1000 * 60));
          if (diffMinutes > 0) {
            calculatedGaps[current.id] = diffMinutes;
          }
        }
      }

      // Restaurer les gaps depuis localStorage s'ils existent, sinon utiliser les gaps calculés ou l'intervalle par défaut
      const savedGaps = localStorage.getItem(`phase_${phaseId}_gaps`);
      let finalGaps: Record<string, number> = {};
      
      if (savedGaps) {
        try {
          const parsed = JSON.parse(savedGaps);
          // Vérifier que les gaps sauvegardés correspondent aux courses actuelles
          sorted.forEach((r, idx) => {
            if (idx < sorted.length - 1) {
              // Utiliser le gap sauvegardé s'il existe pour cette course, sinon le gap calculé, sinon l'intervalle par défaut
              finalGaps[r.id] = parsed[r.id] || calculatedGaps[r.id] || (savedSlotMinutes ? Number(savedSlotMinutes) : DEFAULT_SLOT_MINUTES);
            }
          });
        } catch {
          // Si erreur de parsing, utiliser les gaps calculés
          const defaultSlot = savedSlotMinutes ? Number(savedSlotMinutes) : DEFAULT_SLOT_MINUTES;
          sorted.forEach((r, idx) => {
            if (idx < sorted.length - 1) {
              finalGaps[r.id] = calculatedGaps[r.id] || defaultSlot;
            }
          });
        }
      } else {
        // Pas de gaps sauvegardés, utiliser les gaps calculés ou l'intervalle par défaut
        const defaultSlot = savedSlotMinutes ? Number(savedSlotMinutes) : DEFAULT_SLOT_MINUTES;
        sorted.forEach((r, idx) => {
          if (idx < sorted.length - 1) {
            finalGaps[r.id] = calculatedGaps[r.id] || defaultSlot;
          }
        });
      }
      setGapsByRaceId(finalGaps);

      setRaces(sorted);
    } catch {
      toast({ title: "Erreur chargement courses", variant: "destructive" });
    }
  };

  const getAllCrewIdsInRaces = () => {
    const ids = races.flatMap((race) => (race.crews ?? []).map((c) => c.crew?.id)).filter((id): id is string => Boolean(id));
    return ids;
  };

  const unassignedCrews = useMemo(() => 
    crews.filter((c) => 
      !getAllCrewIdsInRaces().includes(c.id) && 
      c.status === "registered" // Uniquement les équipages participants
    ), 
    [crews, races]
  );

  // Filtrer les équipages non affectés selon la recherche
  const filteredUnassignedCrews = useMemo(() => {
    if (!unassignedSearchQuery.trim()) {
      return unassignedCrews;
    }
    const query = unassignedSearchQuery.toLowerCase().trim();
    return unassignedCrews.filter((crew) => {
      // Recherche dans le nom du club
      if (crew.club_name?.toLowerCase().includes(query)) return true;
      // Recherche dans le code du club
      if (crew.club_code?.toLowerCase().includes(query)) return true;
      // Recherche dans la catégorie
      if (crew.category?.label?.toLowerCase().includes(query)) return true;
      if (crew.category_label?.toLowerCase().includes(query)) return true;
      // Recherche dans les noms des participants
      if (crew.crew_participants) {
        return crew.crew_participants.some(
          (cp) =>
            cp.participant?.first_name?.toLowerCase().includes(query) ||
            cp.participant?.last_name?.toLowerCase().includes(query) ||
            cp.participant?.license_number?.toLowerCase().includes(query)
        );
      }
      return false;
    });
  }, [unassignedCrews, unassignedSearchQuery]);

  // ---------- Helpers planning & renommage ----------
  const addMinutes = (date: Date, minutes: number) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + minutes);
    return d;
  };

  // IMPORTANT: on stocke en UTC correctement (pas de double correction)
  const toIsoUtc = (d: Date) => d.toISOString();

  const toLocalInputValue = (d: Date) => {
    const pad = (n: number) => `${n}`.padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  const parseLocalInput = (v: string) => {
    const d = new Date(v);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0);
  };

  const renumberSeriesNames = (ordered: Race[]): Race[] => {
    const rx = /(.*?)(?:\s*[-–—]?\s*(?:S[ée]rie|Heat)\s*)(\d+)\s*$/i;
    const rxHash = /(.*?)(?:\s*#\s*)(\d+)\s*$/i;

    const groups = new Map<string, { idxs: number[]; matcher: "rx" | "hash" | null }>();
    ordered.forEach((r, i) => {
      const m = r.name.match(rx);
      const mh = r.name.match(rxHash);
      if (m) {
        const base = m[1].trim();
        const g = groups.get(base) ?? { idxs: [], matcher: "rx" as const };
        g.idxs.push(i);
        groups.set(base, g);
      } else if (mh) {
        const base = mh[1].trim();
        const g = groups.get(base) ?? { idxs: [], matcher: "hash" as const };
        g.idxs.push(i);
        groups.set(base, g);
      }
    });

    const next = [...ordered];
    for (const [base, { idxs, matcher }] of groups) {
      if (!matcher || idxs.length <= 1) continue;
      idxs.forEach((raceIdx, j) => {
        const suffix = matcher === "rx" ? ` - Série ${j + 1}` : ` #${j + 1}`;
        next[raceIdx] = { ...next[raceIdx], name: `${base}${suffix}` };
      });
    }
    return next;
  };

  // Recalcule les horaires à partir d'un anchorIndex (inclus) en utilisant les gaps successifs
  const recomputeTimesFrom = (ordered: Race[], anchorIndex: number, anchorDate: Date): Race[] => {
    const next = [...ordered];
    for (let i = anchorIndex; i < next.length; i++) {
      if (i === anchorIndex) {
        next[i] = { ...next[i], start_time: toIsoUtc(anchorDate) };
      } else {
        const prev = next[i - 1];
        const gap = gapsByRaceId[prev.id] ?? slotMinutes;
        const prevDate = new Date(prev.start_time!);
        next[i] = { ...next[i], start_time: toIsoUtc(addMinutes(prevDate, gap)) };
      }
    }
    return next;
  };

  const persistRaceOrder = async (ordered: Race[]) => {
    const withNames = renumberSeriesNames(ordered);
    // anchor = firstStartLocal
    const withTimes = recomputeTimesFrom(withNames, 0, parseLocalInput(firstStartLocal));

    try {
      await Promise.all(
        withTimes.map((r, idx) => api.put(`/races/${r.id}`, { race_number: idx + 1, start_time: r.start_time, name: r.name }))
      );
      
      // Sauvegarder l'intervalle par défaut et les gaps dans localStorage
      if (phaseId) {
        localStorage.setItem(`phase_${phaseId}_slotMinutes`, String(slotMinutes));
        localStorage.setItem(`phase_${phaseId}_firstStartLocal`, firstStartLocal);
        localStorage.setItem(`phase_${phaseId}_gaps`, JSON.stringify(gapsByRaceId));
      }
      
      toast({ title: "Ordre, horaires et noms mis à jour." });
      setRaces(withTimes);
    } catch {
      toast({ title: "Erreur lors de la mise à jour de l'ordre", variant: "destructive" });
      fetchRaces();
    }
  };

  const handleDeleteRace = async (raceId: string) => {
    try {
      await api.delete(`/races/${raceId}`);
      setRaces((prev) => prev.filter((r) => r.id !== raceId));
      toast({ title: "Série supprimée." });
      // Recharger les courses pour mettre à jour l'ordre
      await fetchRaces();
    } catch {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  // ---- DnD handlers ----
  const handleCrewDrop = async (event: any) => {
    const { active, over } = event;
    const a = active?.data?.current;
    const o = over?.data?.current;
    if (!a || !over) return;

    if (o?.bucket === "unassigned") {
      if (a.type === "raceCrew" && a.raceCrewId) {
        try {
          await api.delete(`/race-crews/${a.raceCrewId}`);
          toast({ title: "Équipage remis en non affectés." });
          await fetchRaces();
          await fetchCrews();
        } catch {
          toast({ title: "Erreur lors du retrait", variant: "destructive" });
        }
      }
      return;
    }

    const targetRaceId = o?.raceId;
    const targetLane = o?.lane;
    if (!targetRaceId || !targetLane) return;

    try {
      const race = races.find((r) => r.id === targetRaceId);
      const occupant = race?.crews?.find((c) => c.lane === targetLane) || null;

      // Validation de distance si on ajoute un nouveau crew
      if (a.type === "crew" && a.crewId) {
        const newCrew = crews.find((c) => c.id === a.crewId);
        if (newCrew && race) {
          // Vérifier si la course a déjà des crews
          const existingCrews = race.crews.filter(rc => rc.crew && rc.id !== occupant?.id);
          if (existingCrews.length > 0) {
            // Vérifier que la distance du nouveau crew correspond
            const newCrewDistance = getCrewDistance(newCrew, race);
            const existingDistances = existingCrews
              .map(rc => getCrewDistance(rc.crew, race))
              .filter(d => d !== null);
            
            if (newCrewDistance !== null && existingDistances.length > 0) {
              const uniqueDistances = new Set([...existingDistances, newCrewDistance]);
              if (uniqueDistances.size > 1) {
                toast({ 
                  title: "Erreur : distances incompatibles", 
                  description: "Impossible d'ajouter cet équipage car sa distance ne correspond pas à celle des autres équipages de cette course.",
                  variant: "destructive" 
                });
                return;
              }
            }
          }
        }
        
        if (occupant) await api.delete(`/race-crews/${occupant.id}`);
        await api.post(`/race-crews`, { race_id: targetRaceId, crew_id: a.crewId, lane: targetLane });
        toast({ title: "Équipage affecté." });
      }

      if (a.type === "raceCrew" && a.raceCrewId && a.crewId) {
        const movingSameSpot = a.fromRaceId === targetRaceId && a.fromLane === targetLane;
        if (!movingSameSpot) {
          const movingCrew = races.find(r => r.id === a.fromRaceId)?.crews.find(rc => rc.id === a.raceCrewId)?.crew;
          
          // Validation de distance lors du déplacement
          if (movingCrew && race) {
            const existingCrews = race.crews.filter(rc => rc.crew && rc.id !== occupant?.id && rc.id !== a.raceCrewId);
            if (existingCrews.length > 0) {
              const movingCrewDistance = getCrewDistance(movingCrew, race);
              const existingDistances = existingCrews
                .map(rc => getCrewDistance(rc.crew, race))
                .filter(d => d !== null);
              
              if (movingCrewDistance !== null && existingDistances.length > 0) {
                const uniqueDistances = new Set([...existingDistances, movingCrewDistance]);
                if (uniqueDistances.size > 1) {
                  toast({ 
                    title: "Erreur : distances incompatibles", 
                    description: "Impossible de déplacer cet équipage car sa distance ne correspond pas à celle des autres équipages de cette course.",
                    variant: "destructive" 
                  });
                  return;
                }
              }
            }
          }
          
          if (!occupant) {
            await api.delete(`/race-crews/${a.raceCrewId}`);
            await api.post(`/race-crews`, { race_id: targetRaceId, crew_id: a.crewId, lane: targetLane });
          } else if (occupant.id !== a.raceCrewId) {
            await api.delete(`/race-crews/${a.raceCrewId}`);
            await api.delete(`/race-crews/${occupant.id}`);
            await api.post(`/race-crews`, { race_id: targetRaceId, crew_id: a.crewId, lane: targetLane });
            await api.post(`/race-crews`, { race_id: a.fromRaceId, crew_id: occupant.crew?.id, lane: a.fromLane });
          }
          toast({ title: "Équipages réorganisés." });
        }
      }

      await fetchRaces();
      await fetchCrews();
    } catch {
      toast({ title: "Erreur lors du déplacement", variant: "destructive" });
    }
  };

  const onDragStart = (e: any) => {
    const a = e.active?.data?.current;
    if (a?.type === "crew") setDragPreview({ type: "crew", label: "Équipage" });
    else if (a?.type === "raceCrew") setDragPreview({ type: "raceCrew", label: "Équipage affecté" });
    else if (races.some((r) => r.id === String(e.active?.id))) {
      const race = races.find((r) => r.id === String(e.active?.id));
      setDragPreview({ type: "race", label: race?.name || "Série" });
    } else setDragPreview(null);
  };

  const onDragEnd = async (e: any) => {
    const { active, over } = e;
    setDragPreview(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const isRaceDrag =
      !activeId.startsWith("crew-") &&
      !activeId.startsWith("entry-") &&
      races.some((r) => r.id === activeId) &&
      races.some((r) => r.id === overId);

    if (isRaceDrag) {
      if (activeId !== overId) {
        const oldIndex = races.findIndex((r) => r.id === activeId);
        const newIndex = races.findIndex((r) => r.id === overId);
        const newOrder = arrayMove(races, oldIndex, newIndex);
        setRaces(newOrder);
        await persistRaceOrder(newOrder);
      }
      return;
    }

    await handleCrewDrop(e);
  };

  useEffect(() => {
    if (eventId && phaseId) {
      setLoading(true);
      setShowAllCrews(true);
      setExpandedRaces(new Set());
      Promise.all([
        fetchPhases(),
        fetchCrews(),
        fetchRaces()
      ]).finally(() => {
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, phaseId]);

  // Quand les courses changent, ouvrir toutes les courses si showAllCrews est actif
  useEffect(() => {
    if (showAllCrews && races.length > 0) {
      const raceIds = races.map(r => r.id);
      const currentExpanded = Array.from(expandedRaces);
      // Ne mettre à jour que si les IDs ont changé
      if (raceIds.length !== currentExpanded.length || 
          !raceIds.every(id => currentExpanded.includes(id))) {
        setExpandedRaces(new Set(raceIds));
      }
    } else if (!showAllCrews) {
      // Si showAllCrews est désactivé, fermer toutes les courses
      setExpandedRaces(new Set());
    }
  }, [showAllCrews, races.length]); // Quand showAllCrews ou le nombre de courses change

  const previousPhase = useMemo(() => {
    if (!currentPhase || phases.length === 0) return null;
    const currentIndex = phases.findIndex((p) => p.id === phaseId);
    if (currentIndex <= 0) return null;
    return phases[currentIndex - 1];
  }, [phases, currentPhase, phaseId]);

  const isDraggingRaceCrew = dragPreview?.type === "raceCrew";

  // === Actions timeline ===
  const applySchedule = async () => {
    const ordered = [...races].sort((a,b) => (a.race_number||0) - (b.race_number||0));
    await persistRaceOrder(ordered);
  };

  const onChangeRaceTime = async (raceId: string, localValue: string) => {
    const idx = races.findIndex(r => r.id === raceId);
    if (idx < 0) return;
    const anchor = parseLocalInput(localValue);
    const next = recomputeTimesFrom(races, idx, anchor);
    setRaces(next);
    
    // Si c'est la première course, sauvegarder l'heure
    if (idx === 0 && phaseId) {
      localStorage.setItem(`phase_${phaseId}_firstStartLocal`, localValue);
      setFirstStartLocal(localValue);
    }

    // Sauvegarder automatiquement en base de données
    try {
      const updatedRaces = next.slice(idx); // Toutes les courses à partir de celle modifiée
      await Promise.all(
        updatedRaces.map((r, offset) => 
          api.put(`/races/${r.id}`, { 
            start_time: r.start_time,
            race_number: r.race_number || (idx + offset + 1)
          })
        )
      );
    } catch (err) {
      console.error("Erreur lors de la sauvegarde des horaires:", err);
      toast({ 
        title: "Erreur lors de la sauvegarde", 
        description: "Les horaires ont été mis à jour localement mais n'ont pas pu être sauvegardés.",
        variant: "destructive" 
      });
    }
  };

  const onChangeGapAfter = async (raceId: string, minutes: number) => {
    const m = Math.max(1, minutes || 1);
    setGapsByRaceId(prev => {
      const updated = { ...prev, [raceId]: m };
      // Sauvegarder les gaps dans localStorage
      if (phaseId) {
        localStorage.setItem(`phase_${phaseId}_gaps`, JSON.stringify(updated));
      }
      return updated;
    });
    const idx = races.findIndex(r => r.id === raceId);
    if (idx < 0 || idx >= races.length - 1) return;
    const current = races[idx];
    const currentDate = new Date(current.start_time || parseLocalInput(firstStartLocal));
    const nextStartDate = addMinutes(currentDate, m);
    const next = recomputeTimesFrom(races, idx + 1, nextStartDate);
    setRaces(next);

    // Sauvegarder automatiquement en base de données
    try {
      const updatedRaces = next.slice(idx + 1); // Toutes les courses après celle dont l'intervalle a changé
      await Promise.all(
        updatedRaces.map((r, offset) => 
          api.put(`/races/${r.id}`, { 
            start_time: r.start_time,
            race_number: r.race_number || (idx + offset + 2)
          })
        )
      );
    } catch (err) {
      console.error("Erreur lors de la sauvegarde des horaires:", err);
      toast({ 
        title: "Erreur lors de la sauvegarde", 
        description: "Les horaires ont été mis à jour localement mais n'ont pas pu être sauvegardés.",
        variant: "destructive" 
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Colonne gauche - Skeleton */}
          <div className="w-full md:w-1/3 space-y-4">
            <Card>
              <CardHeader className="bg-red-50">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-10 w-full mt-2" />
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
          
          {/* Colonne droite - Skeleton */}
          <Card className="flex-1">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="p-4 flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Colonne gauche */}
        <div className="w-full md:w-1/3 space-y-4 min-w-0">
          {previousPhase && (
            <PhaseResultsPanel
              phaseId={previousPhase.id}
              phaseName={previousPhase.name}
              assignedCrewIds={getAllCrewIdsInRaces()}
            />
          )}
          <Card>
            <CardHeader className="bg-red-50">
              <CardTitle>Équipages non affectés</CardTitle>
              <div className="mt-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Rechercher un équipage..."
                    value={unassignedSearchQuery}
                    onChange={(e) => setUnassignedSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <UnassignedDroppable isActiveHint={isDraggingRaceCrew}>
              {filteredUnassignedCrews.length === 0 && unassignedSearchQuery ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Aucun équipage trouvé pour "{unassignedSearchQuery}"
                </div>
              ) : (
                filteredUnassignedCrews.map((crew) => (
                  <DraggableCrew key={crew.id} crew={crew} />
                ))
              )}
            </UnassignedDroppable>
          </Card>
        </div>

        {/* Colonne droite */}
        <Card className="flex-1 min-w-0">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex justify-between items-center gap-3">
              <CardTitle>Courses de la phase</CardTitle>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAllCrews(!showAllCrews);
                    if (!showAllCrews) {
                      // Si on active, ouvrir toutes les courses
                      setExpandedRaces(new Set(races.map(r => r.id)));
                    } else {
                      // Si on désactive, fermer toutes les courses
                      setExpandedRaces(new Set());
                    }
                  }}
                  className="text-xs px-3 py-1 border rounded bg-white hover:bg-gray-50 flex items-center gap-1.5"
                  title={showAllCrews ? "Masquer tous les équipages" : "Afficher tous les équipages"}
                >
                  {showAllCrews ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      Masquer équipages
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Afficher équipages
                    </>
                  )}
                </button>
                <button
                  className="text-xs px-2 py-1 border rounded bg-white disabled:opacity-60"
                  disabled={!phaseId || exporting.start}
                  onClick={async () => {
                    if (!phaseId) return;
                    try {
                      setExporting((s) => ({ ...s, start: true }));
                      await downloadPdfSafely({
                        url: `/exports/startlist/phase/${phaseId}`,
                        filename: `startlist_${phaseId}.pdf`,
                        onError: (title, description) => toast({ title, description, variant: "destructive" }),
                      });
                    } finally {
                      setExporting((s) => ({ ...s, start: false }));
                    }
                  }}
                >
                  {exporting.start ? "Export…" : "Export Start list (PDF)"}
                </button>
                <button
                  className="text-xs px-2 py-1 border rounded bg-white disabled:opacity-60"
                  disabled={!phaseId || exporting.weigh}
                  onClick={async () => {
                    if (!phaseId) return;
                    try {
                      setExporting((s) => ({ ...s, weigh: true }));
                      await downloadPdfSafely({
                        url: `/exports/weighin/phase/${phaseId}`,
                        filename: `pesee_${phaseId}.pdf`,
                        onError: (title, description) => toast({ title, description, variant: "destructive" }),
                      });
                    } finally {
                      setExporting((s) => ({ ...s, weigh: false }));
                    }
                  }}
                >
                  {exporting.weigh ? "Export…" : "Export Pesée (PDF)"}
                </button>
                <RaceFormDialog 
                  phaseId={phaseId!} 
                  eventId={eventId!} 
                  onSuccess={async () => {
                    try {
                      // Attendre un court instant pour que la nouvelle course soit disponible dans l'API
                      await new Promise(resolve => setTimeout(resolve, 300));
                      
                      // Récupérer toutes les courses de la phase
                      const res = await api.get(`/races/event/${eventId}`);
                      const phaseRaces: Race[] = res.data.data.filter((r: any) => r.phase_id === phaseId);
                      
                      if (phaseRaces.length === 0) {
                        await fetchRaces();
                        return;
                      }
                      
                      // Trier par race_number pour trouver la dernière
                      const sorted = [...phaseRaces].sort((a, b) => (a.race_number || 0) - (b.race_number || 0));
                      
                      // Trouver la nouvelle course : celle qui n'a pas de start_time ou qui a le plus grand race_number
                      // On identifie la nouvelle course comme celle sans start_time ou avec le race_number le plus élevé
                      const racesWithoutTime = sorted.filter(r => !r.start_time);
                      const newRace = racesWithoutTime.length > 0 
                        ? racesWithoutTime[racesWithoutTime.length - 1] 
                        : sorted[sorted.length - 1];
                      
                      if (!newRace) {
                        await fetchRaces();
                        return;
                      }
                      
                      // Calculer le race_number : maximum existant + 1
                      const maxRaceNumber = sorted.length > 0 
                        ? Math.max(...sorted.map(r => r.race_number || 0))
                        : 0;
                      const newRaceNumber = maxRaceNumber + 1;
                      
                      // Calculer le start_time
                      let newStartTime: string;
                      const existingRacesWithTime = sorted.filter(r => r.start_time && r.id !== newRace.id);
                      
                      if (existingRacesWithTime.length === 0) {
                        // Première course : utiliser firstStartLocal
                        const baseDate = firstStartLocal 
                          ? parseLocalInput(firstStartLocal)
                          : (() => {
                              const d = new Date();
                              d.setHours(9, 0, 0, 0);
                              return d;
                            })();
                        newStartTime = toIsoUtc(baseDate);
                        // Mettre à jour firstStartLocal si elle n'était pas définie
                        if (!firstStartLocal) {
                          setFirstStartLocal(toLocalInputValue(baseDate));
                        }
                      } else {
                        // Course suivante : dernière course avec heure + gap
                        const lastRaceWithTime = existingRacesWithTime.sort((a, b) => {
                          const timeA = new Date(a.start_time!).getTime();
                          const timeB = new Date(b.start_time!).getTime();
                          return timeB - timeA; // Plus récente en premier
                        })[0];
                        
                        if (lastRaceWithTime.start_time) {
                          const prevDate = new Date(lastRaceWithTime.start_time);
                          const gap = gapsByRaceId[lastRaceWithTime.id] || slotMinutes;
                          newStartTime = toIsoUtc(addMinutes(prevDate, gap));
                        } else {
                          // Fallback : utiliser firstStartLocal + (index * slotMinutes)
                          const baseDate = firstStartLocal 
                            ? parseLocalInput(firstStartLocal)
                            : (() => {
                                const d = new Date();
                                d.setHours(9, 0, 0, 0);
                                return d;
                              })();
                          newStartTime = toIsoUtc(addMinutes(baseDate, (newRaceNumber - 1) * slotMinutes));
                        }
                      }
                      
                      // Mettre à jour la nouvelle course avec le race_number et start_time
                      await api.put(`/races/${newRace.id}`, {
                        race_number: newRaceNumber,
                        start_time: newStartTime,
                      });
                      
                      // Rafraîchir la liste des courses (qui sera triée par race_number)
                      await fetchRaces();
                      
                      toast({ 
                        title: "Course créée avec succès", 
                        description: `Course ajoutée à la fin de la liste avec l'heure ${new Date(newStartTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      });
                    } catch (err) {
                      console.error("Erreur lors de l'ajout automatique de la course:", err);
                      // En cas d'erreur, on recharge quand même les courses
                      await fetchRaces();
                      toast({
                        title: "Course créée",
                        description: "La course a été créée mais l'heure n'a pas pu être définie automatiquement",
                        variant: "default",
                      });
                    }
                  }} 
                />
              </div>
            </div>

            <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Configuration des horaires</h3>
                <button
                  className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                  onClick={applySchedule}
                  title="Enregistrer les horaires recalculés"
                >
                  Enregistrer les horaires
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-gray-700 font-medium">Heure de la 1ʳᵉ course</span>
                  <input
                    type="datetime-local"
                    value={firstStartLocal}
                    onChange={(e) => {
                      setFirstStartLocal(e.target.value);
                      // Sauvegarder dans localStorage
                      if (phaseId) {
                        localStorage.setItem(`phase_${phaseId}_firstStartLocal`, e.target.value);
                      }
                      const next = recomputeTimesFrom(races, 0, parseLocalInput(e.target.value));
                      setRaces(next);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-gray-700 font-medium">Intervalle par défaut (minutes)</span>
                  <input
                    type="number"
                    min={1}
                    value={slotMinutes}
                    onChange={(e) => {
                      const m = Math.max(1, Number(e.target.value) || 1);
                      setSlotMinutes(m);
                      // Sauvegarder dans localStorage
                      if (phaseId) {
                        localStorage.setItem(`phase_${phaseId}_slotMinutes`, String(m));
                      }
                      const applied: Record<string, number> = { ...gapsByRaceId };
                      races.forEach(r => { applied[r.id] = m; });
                      setGapsByRaceId(applied);
                      const next = recomputeTimesFrom(races, 0, parseLocalInput(firstStartLocal));
                      setRaces(next);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </label>
              </div>
            </div>
          </CardHeader>

          {/* Timeline verticale + drag and drop par séries */}
          <CardContent className="space-y-4 md:max-h-[80vh] overflow-y-auto min-w-0">
            <SortableContext items={races.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div className="relative pl-6">
                {/* Axe vertical */}
                <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-300" />

                {races.map((race, idx) => {
                  const laneCount = race.lane_count || 6;
                  const lanes = Array.from({ length: laneCount }, (_, i) => i + 1);
                  const timeLabel = race.start_time
                    ? new Date(race.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "";
                  const gap = gapsByRaceId[race.id] ?? slotMinutes;
                  const isExpanded = expandedRaces.has(race.id);
                  const shouldShowCrews = showAllCrews && isExpanded;

                  return (
                    <div key={race.id} className="mb-4">
                      <TimelineRace
                        race={race}
                        timeLabel={timeLabel}
                        onTimeChange={(val) => onChangeRaceTime(race.id, val)}
                        onGapChange={(m) => onChangeGapAfter(race.id, m)}
                        gapMinutes={idx === races.length - 1 ? undefined : gap}
                        onDelete={handleDeleteRace}
                        onNameUpdate={async (newName: string) => {
                          try {
                            await api.put(`/races/${race.id}`, { name: newName });
                            toast({ title: "Nom de la série mis à jour." });
                            await fetchRaces();
                          } catch {
                            toast({ title: "Erreur lors de la mise à jour du nom", variant: "destructive" });
                          }
                        }}
                        showCrews={shouldShowCrews}
                        isExpanded={isExpanded}
                        onToggleExpand={() => {
                          const newExpanded = new Set(expandedRaces);
                          if (newExpanded.has(race.id)) {
                            newExpanded.delete(race.id);
                          } else {
                            newExpanded.add(race.id);
                          }
                          setExpandedRaces(newExpanded);
                        }}
                      >
                        {shouldShowCrews && lanes.map((lane) => {
                          const entry = race.crews?.find((c) => c.lane === lane);
                          return (
                            <DroppableLane key={`${race.id}-${lane}`} lane={lane} raceId={race.id} entry={entry} />
                          );
                        })}
                      </TimelineRace>
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </CardContent>
        </Card>
      </div>

      {/* Aperçu visuel pendant le drag */}
      <DragOverlay>
        {dragPreview ? (
          <div className="px-3 py-1 text-xs bg-gray-800 text-white rounded shadow-lg">{dragPreview.label}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** ---------- Composants ---------- */

function UnassignedDroppable({ children, isActiveHint }: { children: React.ReactNode; isActiveHint?: boolean; }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned", data: { bucket: "unassigned" } });

  return (
    <CardContent
      ref={setNodeRef}
      className={clsx(
        "space-y-2 max-h-[40vh] overflow-y-auto border-2 rounded-lg p-2 transition-colors",
        isOver || isActiveHint ? "border-dashed border-gray-500 bg-gray-50" : "border-transparent"
      )}
    >
      {(isOver || isActiveHint) && (
        <div className="text-[11px] text-gray-600 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
          Déposez ici pour désaffecter l’équipage
        </div>
      )}
      {children}
    </CardContent>
  );
}

function DraggableCrew({ crew }: { crew: Crew }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `crew-${crew.id}`,
    data: { type: "crew", crewId: crew.id },
  });

  const style = { transform: CSS.Translate.toString(transform) } as React.CSSProperties;

  const categoryLabel = crew.category?.label || crew.category_label || "Sans catégorie";

  const participants = crew?.crew_participants
    ?.sort((a, b) => a.seat_position - b.seat_position)
    .map((cp) => {
      const firstName = cp.participant?.first_name || "";
      const lastName = cp.participant?.last_name || "";
      const displayName = firstName && lastName ? `${firstName} ${lastName}` : lastName || firstName;
      return { displayName, isCoxswain: cp.is_coxswain };
    }) || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "border rounded px-2 py-1 cursor-move select-none",
        isDragging ? "opacity-60 ring-2 ring-gray-400" : "",
        "bg-white text-gray-800 border-gray-300"
      )}
    >
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{crew.club_name}</div>
        <div className="text-xs text-blue-600 font-semibold">{categoryLabel}</div>
        {participants.length > 0 && (
          <div className="text-[10px] text-gray-600 space-y-0.5 mt-1">
            {participants.map((p, idx) => (
              <div key={idx} className={clsx("truncate", p.isCoxswain && "font-semibold")}>
                {p.displayName}
                {p.isCoxswain && <span className="text-gray-500 ml-0.5">(B)</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DroppableLane({ lane, raceId, entry }: { lane: number; raceId: string; entry?: RaceCrew; }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `${raceId}-${lane}`, data: { raceId, lane } });

  const { setNodeRef: setDragRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: entry ? `entry-${entry.id}` : `lane-${raceId}-${lane}-empty`,
    data: entry
      ? { type: "raceCrew", raceCrewId: entry.id, crewId: entry.crew?.id, fromRaceId: raceId, fromLane: lane }
      : { type: "emptyLane", raceId, lane },
    disabled: !entry,
  });

  const style = { transform: CSS.Translate.toString(transform) } as React.CSSProperties;

  const participants = entry?.crew?.crew_participants
    ?.sort((a, b) => a.seat_position - b.seat_position)
    .map((cp) => {
      const firstName = cp.participant?.first_name || "";
      const lastName = cp.participant?.last_name || "";
      const displayName = firstName && lastName ? `${firstName} ${lastName}` : lastName || firstName;
      return { displayName, isCoxswain: cp.is_coxswain };
    }) || [];

  return (
    <div
      ref={(el) => { setDropRef(el); setDragRef(el); }}
      style={style}
      {...(entry ? attributes : {})}
      {...(entry ? listeners : {})}
      className={clsx(
        "px-3 py-1 rounded-md text-xs transition-colors select-none",
        isOver ? "ring-2 ring-gray-400" : "",
        entry ? "bg-gray-200 text-gray-900" : "bg-gray-100 italic text-gray-500",
        isDragging ? "opacity-70" : ""
      )}
      title={entry ? entry.crew?.club_name : undefined}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="font-semibold">L{lane}</span>
        <div className="flex-1 text-right min-w-0">
          {entry ? (
            <div className="space-y-0.5">
              <div className="font-medium truncate">{entry.crew?.club_name}</div>
              {participants.length > 0 && (
                <div className="text-[10px] text-gray-600 space-y-0.5">
                  {participants.map((p, idx) => (
                    <div key={idx} className={clsx("truncate", p.isCoxswain && "font-semibold")}>
                      {p.displayName}
                      {p.isCoxswain && <span className="text-gray-500 ml-0.5">(B)</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="italic">(vide)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineRace({
  race,
  timeLabel,
  children,
  onTimeChange,
  onGapChange,
  gapMinutes,
  onDelete,
  onNameUpdate,
  showCrews,
  isExpanded,
  onToggleExpand,
}: {
  race: Race;
  timeLabel: string;
  children: React.ReactNode;
  onTimeChange: (localValue: string) => void;
  onGapChange: (minutes: number) => void;
  gapMinutes?: number;
  onDelete: (raceId: string) => void;
  onNameUpdate?: (newName: string) => Promise<void>;
  showCrews?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: race.id });
  const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;
  const { toast } = useToast();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(race.name);
  const [isSavingName, setIsSavingName] = useState(false);

  // Mettre à jour editedName quand race.name change
  useEffect(() => {
    if (!isEditingName) {
      setEditedName(race.name);
    }
  }, [race.name, isEditingName]);

  const validation = validateRaceDistances(race);
  const displayName = validation.isValid ? generateRaceNameWithCategories(race, race.name) : race.name;

  const datetimeForInput = (() => {
    if (!race.start_time) return "";
    const d = new Date(race.start_time);
    const pad = (n: number) => `${n}`.padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  })();

  const handleStartEdit = () => {
    setEditedName(race.name);
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setEditedName(race.name);
    setIsEditingName(false);
  };

  const handleSaveName = async () => {
    if (!onNameUpdate || editedName.trim() === race.name.trim()) {
      setIsEditingName(false);
      return;
    }

    if (!editedName.trim()) {
      toast({ title: "Le nom ne peut pas être vide", variant: "destructive" });
      return;
    }

    setIsSavingName(true);
    try {
      await onNameUpdate(editedName.trim());
      setIsEditingName(false);
    } catch {
      // L'erreur est déjà gérée par onNameUpdate
    } finally {
      setIsSavingName(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={clsx("relative border-2 rounded-lg p-3 space-y-3 bg-white shadow-sm w-full min-w-0", isDragging ? "opacity-70 ring-2 ring-blue-400 shadow-lg" : "hover:border-gray-300", !validation.isValid && "border-red-300 bg-red-50")}>
      <div className="absolute -left-[11px] top-4 w-4 h-4 rounded-full bg-blue-500 border-3 border-white shadow-md" />

      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="font-semibold text-sm flex items-center gap-2 flex-1 min-w-0">
          {onToggleExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
              title={isExpanded ? "Masquer les équipages" : "Afficher les équipages"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-mono font-bold flex-shrink-0">{timeLabel}</span>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveName}
                  autoFocus
                  disabled={isSavingName}
                  className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleSaveName}
                  disabled={isSavingName}
                  className="text-green-600 hover:text-green-700 transition-colors p-1 rounded-md hover:bg-green-50"
                  title="Enregistrer"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSavingName}
                  className="text-red-600 hover:text-red-700 transition-colors p-1 rounded-md hover:bg-red-50"
                  title="Annuler"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <div className="text-gray-900 truncate flex-1">{displayName}</div>
                {onNameUpdate && (
                  <button
                    onClick={handleStartEdit}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-700 transition-all p-1 rounded-md hover:bg-gray-100"
                    title="Modifier le nom"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {validation.error && (
              <div className="text-xs text-red-600 font-medium mt-1">{validation.error}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onDelete(race.id)}
            className="text-red-500 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50"
            aria-label="Supprimer la série"
            title="Supprimer la série"
          >
            <X className="w-4 h-4" />
          </button>
          <button {...attributes} {...listeners} className="text-sm px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-md bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors cursor-grab active:cursor-grabbing" title="Glisser pour réordonner" aria-label="Glisser pour réordonner">
            ⋮⋮
          </button>
        </div>
      </div>

      {gapMinutes !== undefined && (
        <div className="flex items-center gap-2 text-xs bg-gray-50 px-3 py-2 rounded-md">
          <span className="text-gray-600">Intervalle :</span>
          <input
            type="number"
            min={1}
            value={gapMinutes}
            onChange={(e) => onGapChange(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 px-2 py-1 border border-gray-300 rounded bg-white text-center font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-600">min</span>
        </div>
      )}

      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}
