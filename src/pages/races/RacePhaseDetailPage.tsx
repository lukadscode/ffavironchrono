import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
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
import RaceFormDialog from "@/components/races/RaceFormDialog";

// === Config par défaut ===
const DEFAULT_SLOT_MINUTES = 8;

interface Crew {
  id: string;
  club_name: string;
  club_code: string;
  category_id: string;
  category_label?: string;
}

interface RaceCrew {
  id: string; // race_crews.id (affectation)
  lane: number;
  Crew: Crew;
}

interface Race {
  id: string;
  name: string;
  race_type: string;
  lane_count?: number;
  status?: string;
  start_time?: string; // ISO UTC
  race_number?: number; // ordre
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

export default function RacePhaseDetailPage() {
  const { eventId, phaseId } = useParams();
  const { toast } = useToast();

  const [crews, setCrews] = useState<Crew[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [dragPreview, setDragPreview] = useState<DragPreview>(null);
  const [exporting, setExporting] = useState<{ start?: boolean; weigh?: boolean }>({});

  // === Nouveaux états pour la timeline + gaps dynamiques ===
  const [slotMinutes, setSlotMinutes] = useState<number>(DEFAULT_SLOT_MINUTES);
  const [firstStartLocal, setFirstStartLocal] = useState<string>(""); // "YYYY-MM-DDTHH:mm"
  // minutes entre une course et la suivante: key = race.id
  const [gapsByRaceId, setGapsByRaceId] = useState<Record<string, number>>({});

  const fetchCrews = async () => {
    try {
      const res = await api.get(`/crews/event/${eventId}`);
      setCrews(res.data.data);
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

      // Pré-remplir l'heure de départ initiale
      const existing = sorted
        .map(r => r.start_time ? new Date(r.start_time) : null)
        .filter((d): d is Date => !!d)
        .sort((a,b) => a.getTime() - b.getTime());
      if (existing.length) {
        setFirstStartLocal(toLocalInputValue(existing[0]));
      } else {
        const d = new Date(); d.setHours(9,0,0,0); setFirstStartLocal(toLocalInputValue(d));
      }

      // gaps par défaut
      const defaultGaps: Record<string, number> = {};
      sorted.forEach(r => { defaultGaps[r.id] = sorted.length ? slotMinutes : DEFAULT_SLOT_MINUTES; });
      setGapsByRaceId(defaultGaps);

      setRaces(sorted);
    } catch {
      toast({ title: "Erreur chargement courses", variant: "destructive" });
    }
  };

  const getAllCrewIdsInRaces = () => races.flatMap((race) => (race.crews ?? []).map((c) => c.Crew.id));

  const unassignedCrews = useMemo(() => crews.filter((c) => !getAllCrewIdsInRaces().includes(c.id)), [crews, races]);

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
      toast({ title: "Ordre, horaires et noms mis à jour." });
      setRaces(withTimes);
    } catch {
      toast({ title: "Erreur lors de la mise à jour de l'ordre", variant: "destructive" });
      fetchRaces();
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

      if (a.type === "crew" && a.crewId) {
        if (occupant) await api.delete(`/race-crews/${occupant.id}`);
        await api.post(`/race-crews`, { race_id: targetRaceId, crew_id: a.crewId, lane: targetLane });
        toast({ title: "Équipage affecté." });
      }

      if (a.type === "raceCrew" && a.raceCrewId && a.crewId) {
        const movingSameSpot = a.fromRaceId === targetRaceId && a.fromLane === targetLane;
        if (!movingSameSpot) {
          if (!occupant) {
            await api.delete(`/race-crews/${a.raceCrewId}`);
            await api.post(`/race-crews`, { race_id: targetRaceId, crew_id: a.crewId, lane: targetLane });
          } else if (occupant.id !== a.raceCrewId) {
            await api.delete(`/race-crews/${a.raceCrewId}`);
            await api.delete(`/race-crews/${occupant.id}`);
            await api.post(`/race-crews`, { race_id: targetRaceId, crew_id: a.crewId, lane: targetLane });
            await api.post(`/race-crews`, { race_id: a.fromRaceId, crew_id: occupant.Crew.id, lane: a.fromLane });
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
      fetchCrews();
      fetchRaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, phaseId]);

  const isDraggingRaceCrew = dragPreview?.type === "raceCrew";

  // === Actions timeline ===
  const applySchedule = async () => {
    const ordered = [...races].sort((a,b) => (a.race_number||0) - (b.race_number||0));
    await persistRaceOrder(ordered);
  };

  const onChangeRaceTime = (raceId: string, localValue: string) => {
    const idx = races.findIndex(r => r.id === raceId);
    if (idx < 0) return;
    const anchor = parseLocalInput(localValue);
    const next = recomputeTimesFrom(races, idx, anchor);
    setRaces(next);
  };

  const onChangeGapAfter = (raceId: string, minutes: number) => {
    const m = Math.max(1, minutes || 1);
    setGapsByRaceId(prev => ({ ...prev, [raceId]: m }));
    const idx = races.findIndex(r => r.id === raceId);
    if (idx < 0) return;
    const current = races[idx];
    const currentDate = new Date(current.start_time || parseLocalInput(firstStartLocal));
    const next = recomputeTimesFrom(races, idx, currentDate);
    setRaces(next);
  };

  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="p-4 flex gap-6">
        {/* Colonne gauche */}
        <Card className="w-1/3">
          <CardHeader className="bg-red-50">
            <CardTitle>Équipages non affectés</CardTitle>
          </CardHeader>
          <UnassignedDroppable isActiveHint={isDraggingRaceCrew}>
            {unassignedCrews.map((crew) => (
              <DraggableCrew key={crew.id} crew={crew} />
            ))}
          </UnassignedDroppable>
        </Card>

        {/* Colonne droite */}
        <Card className="flex-1">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex justify-between items-center gap-3">
              <CardTitle>Courses de la phase</CardTitle>
              <div className="flex gap-2">
                <button
                  className="text-xs px-2 py-1 border rounded bg-white disabled:opacity-60"
                  disabled={!phaseId || exporting.start}
                  onClick={async () => {
                    if (!phaseId) return;
                    try {
                      setExporting((s) => ({ ...s, start: true }));
                      await downloadPdfSafely({
                        url: `exports/startlist/phase/${phaseId}`,
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
                        url: `exports/weighin/phase/${phaseId}`,
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
                <RaceFormDialog phaseId={phaseId!} eventId={eventId!} onSuccess={fetchRaces} />
              </div>
            </div>

            {/* Contrôles globaux (optionnels) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-700">Heure de la 1ʳᵉ course</span>
                <input
                  type="datetime-local"
                  value={firstStartLocal}
                  onChange={(e) => {
                    setFirstStartLocal(e.target.value);
                    const next = recomputeTimesFrom(races, 0, parseLocalInput(e.target.value));
                    setRaces(next);
                  }}
                  className="px-2 py-1 border rounded"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-700">Intervalle par défaut (min)</span>
                <input
                  type="number"
                  min={1}
                  value={slotMinutes}
                  onChange={(e) => {
                    const m = Math.max(1, Number(e.target.value) || 1);
                    setSlotMinutes(m);
                  }}
                  onBlur={() => {
                    const applied: Record<string, number> = { ...gapsByRaceId };
                    races.forEach(r => { if (!applied[r.id]) applied[r.id] = slotMinutes; });
                    setGapsByRaceId(applied);
                    const next = recomputeTimesFrom(races, 0, parseLocalInput(firstStartLocal));
                    setRaces(next);
                  }}
                  className="px-2 py-1 border rounded"
                />
              </label>
              <div className="flex items-end gap-2">
                <button className="px-3 py-2 text-sm border rounded bg-white" onClick={applySchedule} title="Enregistrer les horaires recalculés">
                  Enregistrer
                </button>
                <button
                  className="px-3 py-2 text-sm border rounded bg-white"
                  onClick={() => {
                    const reset: Record<string, number> = {};
                    races.forEach(r => { reset[r.id] = slotMinutes; });
                    setGapsByRaceId(reset);
                    const next = recomputeTimesFrom(races, 0, parseLocalInput(firstStartLocal));
                    setRaces(next);
                  }}
                >
                  Réinitialiser intervalles
                </button>
              </div>
            </div>
          </CardHeader>

          {/* Timeline verticale + drag and drop par séries */}
          <CardContent className="space-y-4 md:max-h-[80vh] overflow-y-auto">
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

                  return (
                    <div key={race.id} className="mb-4">
                      <TimelineRace
                        race={race}
                        timeLabel={timeLabel}
                        onTimeChange={(val) => onChangeRaceTime(race.id, val)}
                        onGapChange={(m) => onChangeGapAfter(race.id, m)}
                        gapMinutes={idx === races.length - 1 ? undefined : gap}
                      >
                        {lanes.map((lane) => {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "text-sm border rounded px-2 py-1 cursor-move select-none",
        isDragging ? "opacity-60 ring-2 ring-gray-400" : "",
        "bg-white text-gray-800 border-gray-300"
      )}
    >
      {crew.club_name} ({crew.category_label})
    </div>
  );
}

function DroppableLane({ lane, raceId, entry }: { lane: number; raceId: string; entry?: RaceCrew; }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `${raceId}-${lane}`, data: { raceId, lane } });

  const { setNodeRef: setDragRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: entry ? `entry-${entry.id}` : `lane-${raceId}-${lane}-empty`,
    data: entry
      ? { type: "raceCrew", raceCrewId: entry.id, crewId: entry.Crew.id, fromRaceId: raceId, fromLane: lane }
      : { type: "emptyLane", raceId, lane },
    disabled: !entry,
  });

  const style = { transform: CSS.Translate.toString(transform) } as React.CSSProperties;

  return (
    <div
      ref={(el) => { setDropRef(el); setDragRef(el); }}
      style={style}
      {...(entry ? attributes : {})}
      {...(entry ? listeners : {})}
      className={clsx(
        "flex justify-between items-center px-3 py-1 rounded-md text-xs transition-colors select-none",
        isOver ? "ring-2 ring-gray-400" : "",
        entry ? "bg-gray-200 text-gray-900" : "bg-gray-100 italic text-gray-500",
        isDragging ? "opacity-70" : ""
      )}
      title={entry ? entry.Crew.club_name : undefined}
    >
      <span className="font-semibold">L{lane}</span>
      <span className={clsx("truncate max-w-[200px] text-right", entry ? "px-2 py-0.5 rounded" : "")}>
        {entry ? entry.Crew.club_name : "(vide)"}
      </span>
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
}: {
  race: Race;
  timeLabel: string;
  children: React.ReactNode;
  onTimeChange: (localValue: string) => void;
  onGapChange: (minutes: number) => void;
  gapMinutes?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: race.id });
  const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;

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

  return (
    <div ref={setNodeRef} style={style} className={clsx("relative border rounded p-2 space-y-2 bg-gray-50", isDragging ? "opacity-70 ring-2 ring-gray-400" : "")}>      
      {/* Pastille sur l’axe */}
      <div className="absolute -left-[9px] top-3 w-3 h-3 rounded-full bg-gray-400 border-2 border-white" />

      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm flex items-center gap-2">
          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-white border text-gray-700">{timeLabel}</span>
          <span>{race.name}</span>
        </div>
        <button {...attributes} {...listeners} className="text-xs px-2 py-1 border rounded bg-white" title="Glisser pour réordonner" aria-label="Glisser pour réordonner">☰</button>
      </div>

      {/* Ligne d’édition : heure + intervalle vers la suivante */}
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">Heure de cette course</span>
          <input
            type="datetime-local"
            value={datetimeForInput}
            onChange={(e) => onTimeChange(e.target.value)}
            className="px-2 py-1 border rounded bg-white"
          />
        </label>
        {gapMinutes !== undefined && (
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">Intervalle jusqu’à la suivante (min)</span>
            <input
              type="number"
              min={1}
              value={gapMinutes}
              onChange={(e) => onGapChange(Math.max(1, Number(e.target.value) || 1))}
              className="px-2 py-1 border rounded bg-white w-28"
            />
          </label>
        )}
      </div>

      {children}
    </div>
  );
}
