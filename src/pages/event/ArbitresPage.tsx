import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { formatDuration, formatTimeDifference } from "@/utils/formatTime";
import { assignDeadHeatPositions } from "@/utils/ranking";
import { AdminPage } from "@/components/layout/AdminPage";
import { AdjustmentDialog } from "@/components/arbitre/AdjustmentDialog";
import {
  getRaceResults,
  validateRace,
  type RaceResultRow,
} from "@/api/races";
import {
  CREW_STATUS_LABELS,
  type CrewStatus,
} from "@/constants/crewStatus";

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  race_phase?: { id: string; name: string };
  isIndoor?: boolean;
  indoorResults?: IndoorParticipantResult[];
  results?: RaceResultRow[];
};

type IndoorParticipantResult = {
  id: string;
  place: number;
  time_display: string;
  time_ms: number;
  distance: number;
  avg_pace: string;
  spm: number;
  calories: number;
  crew?: {
    id: string;
    club_name: string;
    club_code: string;
    category?: { id: string; code: string; label: string };
  } | null;
};

export default function ArbitresPage() {
  const { eventId } = useParams();
  const { toast } = useToast();
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [isIndoorEvent, setIsIndoorEvent] = useState(false);
  const [adjustmentTarget, setAdjustmentTarget] = useState<RaceResultRow | null>(null);

  const fetchRaces = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const racesData = res.data.data || [];
      const nonOfficial = racesData.filter((r: Race) => r.status === "non_official");

      const enriched = await Promise.all(
        nonOfficial.map(async (race: Race) => {
          if (isIndoorEvent) {
            try {
              const indoorRes = await api.get(`/indoor-results/race/${race.id}`);
              const indoorData = indoorRes.data.data;
              if (indoorData?.participants?.length > 0) {
                return {
                  ...race,
                  isIndoor: true,
                  indoorResults: indoorData.participants.sort(
                    (a: IndoorParticipantResult, b: IndoorParticipantResult) => a.place - b.place
                  ),
                };
              }
            } catch (err: unknown) {
              const status = (err as { response?: { status?: number } })?.response?.status;
              if (status !== 404) console.error(err);
            }
          }

          try {
            const results = await getRaceResults(race.id);
            return { ...race, isIndoor: false, results };
          } catch {
            return { ...race, isIndoor: false, results: [] };
          }
        })
      );

      setRaces(enriched.sort((a, b) => a.race_number - b.race_number));
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les courses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, isIndoorEvent, toast]);

  useEffect(() => {
    if (!eventId) return;
    api.get(`/events/${eventId}`).then((res) => {
      const raceType = res.data.data.race_type?.toLowerCase() || "";
      setIsIndoorEvent(raceType.includes("indoor"));
    }).catch(() => setIsIndoorEvent(false));
  }, [eventId]);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  const handleValidateRace = async (raceId: string) => {
    setValidating(true);
    try {
      const res = await validateRace(raceId);
      const validator = res.data?.validator;
      const name = validator
        ? [validator.first_name, validator.last_name].filter(Boolean).join(" ") || validator.email
        : null;

      toast({
        title: "Course validée officiellement",
        description: name
          ? `Signée par ${name} le ${dayjs().format("DD/MM/YYYY HH:mm")}`
          : "Résultats verrouillés",
      });

      setRaces((prev) => prev.filter((r) => r.id !== raceId));
      if (selectedRaceId === raceId) setSelectedRaceId(null);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de valider la course",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  const refreshSelectedRaceResults = async () => {
    if (!selectedRaceId) return;
    try {
      const results = await getRaceResults(selectedRaceId);
      setRaces((prev) =>
        prev.map((r) => (r.id === selectedRaceId ? { ...r, results } : r))
      );
    } catch {
      toast({ title: "Erreur rechargement résultats", variant: "destructive" });
    }
  };

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Chargement des courses…</p>
      </div>
    );
  }

  return (
    <AdminPage
      title="Validation arbitre"
      description="Contrôle des résultats, pénalités et validation officielle des courses."
      icon={ShieldCheck}
      actions={
        <Badge variant="outline" className="gap-1.5 py-1">
          <Clock className="h-3.5 w-3.5" />
          {races.length} course{races.length !== 1 ? "s" : ""} en attente
        </Badge>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Courses à valider</CardTitle>
          </CardHeader>
          <CardContent>
            {races.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Aucune course en attente de validation
              </p>
            ) : (
              <div className="space-y-2">
                {races.map((race) => (
                  <button
                    key={race.id}
                    type="button"
                    onClick={() => setSelectedRaceId(race.id)}
                    className={`w-full rounded-md border p-4 text-left transition ${
                      selectedRaceId === race.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          Série {race.race_number} — {race.name}
                        </p>
                        {race.race_phase && (
                          <p className="text-sm text-muted-foreground">
                            {race.race_phase.name}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dayjs(race.start_time).format("HH:mm")} ·{" "}
                          {race.isIndoor
                            ? `${race.indoorResults?.length || 0} résultats indoor`
                            : `${race.results?.filter((r) => r.has_timing).length || 0} arrivées`}
                        </p>
                      </div>
                      <Clock className="h-5 w-5 shrink-0 text-accent" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">
                {selectedRace
                  ? `Résultats — Série ${selectedRace.race_number}`
                  : "Sélectionnez une course"}
              </CardTitle>
              {selectedRace && !selectedRace.isIndoor && (
                <Button
                  onClick={() => handleValidateRace(selectedRace.id)}
                  disabled={validating}
                  className="gap-2 shrink-0"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Valider officiel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRace ? (
              <p className="py-8 text-center text-muted-foreground">
                Sélectionnez une course pour afficher le classement
              </p>
            ) : selectedRace.isIndoor ? (
              <IndoorResultsTable results={selectedRace.indoorResults || []} />
            ) : (
              <TimingResultsTable
                results={selectedRace.results || []}
                onAdjust={(row) => setAdjustmentTarget(row)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {adjustmentTarget && (
        <AdjustmentDialog
          open={!!adjustmentTarget}
          onOpenChange={(open) => !open && setAdjustmentTarget(null)}
          raceCrewId={adjustmentTarget.race_crew_id}
          clubName={adjustmentTarget.club_name || "Équipage"}
          rawTimeMs={adjustmentTarget.raw_duration_ms}
          currentAdjustmentMs={adjustmentTarget.adjustment_ms}
          currentReason={adjustmentTarget.adjustment_reason}
          onSaved={refreshSelectedRaceResults}
        />
      )}
    </AdminPage>
  );
}

function TimingResultsTable({
  results,
  onAdjust,
}: {
  results: RaceResultRow[];
  onAdjust: (row: RaceResultRow) => void;
}) {
  if (results.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Aucun résultat disponible
      </p>
    );
  }

  const grouped = results.reduce<Record<string, RaceResultRow[]>>((acc, r) => {
    const label = r.category?.label || "Sans catégorie";
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.keys(grouped)
        .sort()
        .map((categoryLabel) => {
          const categoryResults = [...grouped[categoryLabel]].sort((a, b) => {
            if (!a.has_timing) return 1;
            if (!b.has_timing) return -1;
            const ta = parseInt(a.final_time || "999999999", 10);
            const tb = parseInt(b.final_time || "999999999", 10);
            return ta - tb;
          });

          const ranked = assignDeadHeatPositions(categoryResults, (r) =>
            r.final_time !== null ? parseInt(r.final_time, 10) : null
          );
          const leaderTime = ranked.find((r) => r.position === 1)?.final_time
            ? parseInt(ranked.find((r) => r.position === 1)!.final_time!, 10)
            : null;

          return (
            <div key={categoryLabel}>
              <div className="mb-2 flex items-center gap-2 border-b pb-2">
                <h3 className="font-semibold">{categoryLabel}</h3>
                <span className="text-sm text-muted-foreground">
                  ({categoryResults.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">Rang</th>
                      <th className="px-3 py-2 font-medium">Coul.</th>
                      <th className="px-3 py-2 font-medium">Club</th>
                      <th className="px-3 py-2 font-medium">Statut</th>
                      <th className="px-3 py-2 text-right font-medium">Temps</th>
                      <th className="px-3 py-2 text-right font-medium">Ajust.</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((result) => {
                      const finalMs = result.final_time
                        ? parseInt(result.final_time, 10)
                        : null;
                      const diff =
                        leaderTime !== null && finalMs !== null
                          ? finalMs - leaderTime
                          : null;
                      const statusLabel =
                        CREW_STATUS_LABELS[result.status as CrewStatus] ||
                        result.status;

                      return (
                        <tr
                          key={result.race_crew_id}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="px-3 py-2.5 font-bold">
                            {result.position ?? "—"}
                          </td>
                          <td className="px-3 py-2.5">{result.lane}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{result.club_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {result.club_code}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {result.status !== "registered" ? (
                              <Badge variant="secondary" className="text-xs">
                                {statusLabel}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="font-mono font-semibold">
                              {result.has_timing ? formatDuration(finalMs) : "N/A"}
                            </div>
                            {diff !== null && diff !== 0 && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {formatTimeDifference(diff)}
                              </div>
                            )}
                            {result.adjustment_reason && (
                              <div className="mt-0.5 text-xs text-muted-foreground italic">
                                {result.adjustment_reason}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs">
                            {result.adjustment_ms !== 0 ? (
                              <span
                                className={
                                  result.adjustment_ms > 0
                                    ? "text-destructive"
                                    : "text-green-700"
                                }
                              >
                                {result.adjustment_ms > 0 ? "+" : ""}
                                {(result.adjustment_ms / 1000).toFixed(1)}s
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {result.has_timing && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1"
                                onClick={() => onAdjust(result)}
                              >
                                <Scale className="h-3.5 w-3.5" />
                                Ajuster
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function IndoorResultsTable({ results }: { results: IndoorParticipantResult[] }) {
  const grouped = results.reduce<Record<string, IndoorParticipantResult[]>>(
    (acc, p) => {
      const label = p.crew?.category?.label || "Sans catégorie";
      if (!acc[label]) acc[label] = [];
      acc[label].push(p);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      {Object.keys(grouped)
        .sort()
        .map((label) => (
          <div key={label}>
            <h3 className="mb-2 border-b pb-2 font-semibold">{label}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2">Place</th>
                  <th className="px-3 py-2">Club</th>
                  <th className="px-3 py-2">Temps</th>
                  <th className="px-3 py-2">Allure</th>
                  <th className="px-3 py-2">SPM</th>
                </tr>
              </thead>
              <tbody>
                {[...grouped[label]]
                  .sort((a, b) => a.place - b.place)
                  .map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-3 py-2 font-bold">{p.place}</td>
                      <td className="px-3 py-2">{p.crew?.club_name || "—"}</td>
                      <td className="px-3 py-2 font-mono">{p.time_display}</td>
                      <td className="px-3 py-2 font-mono">{p.avg_pace}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {p.spm}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
