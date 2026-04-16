import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trophy, Calendar, MapPin, Award, ExternalLink, Info, LayoutList } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

interface ClubRanking {
  id: string;
  club_name: string;
  club_code: string | null;
  total_points: number;
  rank: number | null;
  points_count: number;
  results_count: number;
}

interface EventRankings {
  event: {
    id: string;
    name: string;
    location: string;
    start_date: string;
    end_date: string;
    race_type: string;
    season: string | null;
  };
  rankings: ClubRanking[];
}

type SeasonFilterMeta = {
  mode?: string;
  description?: string;
};

function normalizeRaceType(rt: string | undefined | null): string {
  return String(rt ?? "").trim().toLowerCase();
}

function eventSupportsEnduranceMerLink(raceType: string): boolean {
  const r = normalizeRaceType(raceType);
  if (!r) return false;
  const tokens = r.split(/[\s/_-·]+/).filter(Boolean);
  return tokens.includes("mer");
}

type EventTypeFilter = "indoor" | "mer" | "riviere";

const hasClubCode = (clubCode: string | null | undefined): boolean =>
  Boolean((clubCode || "").trim());

function currentCalendarYearString(): string {
  return String(new Date().getFullYear());
}

function parseCalendarYearOnCommit(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length >= 4) {
    const y = parseInt(digits.slice(0, 4), 10);
    if (Number.isFinite(y) && y >= 1900 && y <= 2100) return String(y);
  }
  return currentCalendarYearString();
}

/**
 * Année de libellé de la saison mer « N » : du 01/09/(N-1) au 31/08/N (ex. saison 2026).
 * À la date courante : sept.–déc. → N = année civile + 1 ; janv.–août → N = année civile.
 */
function currentMerSeasonLabelYear(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 8) return String(y + 1);
  return String(y);
}

/** Période affichée pour une saison mer de libellé N. */
function formatMerSeasonRangeFromLabel(yearStr: string): string {
  const y = parseInt(String(yearStr).trim(), 10);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return "—";
  const start = dayjs(`${y - 1}-09-01`);
  const end = dayjs(`${y}-08-31`);
  if (!start.isValid() || !end.isValid()) return "—";
  return `${start.format("DD/MM/YYYY")} au ${end.format("DD/MM/YYYY")}`;
}

function mapDashboardByEvent(items: any[] | undefined, eventType: EventTypeFilter): EventRankings[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const ev = item.event ?? {};
    const rt =
      ev.race_type ||
      (eventType === "mer" ? "mer" : eventType === "indoor" ? "indoor" : "rivière");
    return {
      event: {
        id: ev.id,
        name: ev.name ?? "",
        location: ev.location ?? "",
        start_date: ev.start_date ?? "",
        end_date: ev.end_date ?? "",
        race_type: rt,
        season: ev.season != null && ev.season !== "" ? String(ev.season) : null,
      },
      rankings: (item.rankings ?? [])
        .map((row: any, index: number) => ({
          id: `${ev.id}-${row.club_code ?? row.club_name ?? index}`,
          club_name: row.club_name ?? "Club inconnu",
          club_code: row.club_code ?? null,
          total_points: Number(row.total_points ?? 0),
          rank: typeof row.rank === "number" ? row.rank : index + 1,
          points_count: Number(row.points_count ?? 0),
          results_count: Number(row.results_count ?? 0),
        }))
        .filter((r: ClubRanking) => hasClubCode(r.club_code)),
    };
  });
}

type MerBreakdown = {
  enduro_top4?: number;
  brs_top1?: number;
  championnat_france_enduro?: number;
  championnat_france_brs?: number;
  championnat_france?: number;
  territorial_bonus?: number;
};

/** Une ligne de compétition pour l’onglet détail par club (points + compté ou non). */
type ClubCompetitionLine = {
  lineKey: string;
  eventId?: string;
  eventName: string;
  startDate?: string;
  points: number;
  counted: boolean;
  detail: string;
};

function sortClubCompetitionLines(lines: ClubCompetitionLine[]): ClubCompetitionLine[] {
  return [...lines].sort((a, b) => {
    const ta = a.startDate && dayjs(a.startDate).isValid() ? dayjs(a.startDate).valueOf() : 0;
    const tb = b.startDate && dayjs(b.startDate).isValid() ? dayjs(b.startDate).valueOf() : 0;
    if (ta !== tb) return ta - tb;
    return a.eventName.localeCompare(b.eventName, "fr");
  });
}

function buildMerClubCompetitionLines(row: any): ClubCompetitionLine[] {
  const lines: ClubCompetitionLine[] = [];
  const contributions = Array.isArray(row.contributions) ? row.contributions : [];
  contributions.forEach((c: any, idx: number) => {
    const detailParts: string[] = ["Compté dans le total saison"];
    if (c.kind) detailParts.push(`type : ${c.kind}`);
    if (c.rule) detailParts.push(`règle : ${c.rule}`);
    if (typeof c.selection_rank === "number") detailParts.push(`rang de sélection ${c.selection_rank}`);
    lines.push({
      lineKey: `mer-c-${String(c.event_id ?? "noid")}-${idx}`,
      eventId: c.event_id ? String(c.event_id) : undefined,
      eventName: String(c.event_name ?? "—"),
      startDate: c.start_date ? String(c.start_date) : undefined,
      points: Number(c.points ?? 0),
      counted: true,
      detail: detailParts.join(" · "),
    });
  });

  const otherE = Array.isArray(row.other_enduro_territorial) ? row.other_enduro_territorial : [];
  otherE.forEach((o: any, idx: number) => {
    lines.push({
      lineKey: `mer-oe-${String(o.event_id ?? idx)}-${idx}`,
      eventId: o.event_id ? String(o.event_id) : undefined,
      eventName: String(o.event_name ?? "—"),
      startDate: o.start_date ? String(o.start_date) : undefined,
      points: Number(o.points ?? 0),
      counted: false,
      detail:
        "Non compté : enduro territoriale en dehors des 4 meilleures retenues pour le classement général",
    });
  });

  const otherB = Array.isArray(row.other_brs_territorial) ? row.other_brs_territorial : [];
  otherB.forEach((o: any, idx: number) => {
    lines.push({
      lineKey: `mer-ob-${String(o.event_id ?? idx)}-${idx}`,
      eventId: o.event_id ? String(o.event_id) : undefined,
      eventName: String(o.event_name ?? "—"),
      startDate: o.start_date ? String(o.start_date) : undefined,
      points: Number(o.points ?? 0),
      counted: false,
      detail:
        "Non compté : BRS territoriale en dehors de la meilleure retenue pour le classement général",
    });
  });

  const bonus = Number(row.breakdown?.territorial_bonus ?? 0);
  const hasBonusContribution = contributions.some((c: any) =>
    String(c.kind ?? "")
      .toLowerCase()
      .includes("bonus")
  );
  if (Math.abs(bonus) > 1e-9 && !hasBonusContribution) {
    lines.push({
      lineKey: "mer-bonus-territorial",
      eventName: "Bonus territorial mer",
      points: bonus,
      counted: true,
      detail: "Compté : bonus territorial mer actifs en base pour la saison (sans événement associé)",
    });
  }

  return sortClubCompetitionLines(lines);
}

function indoorContributionDetail(kind: string | undefined): string {
  if (kind === "meeting_standard_max")
    return "Compté : meilleur meeting standard de la saison (barème Points Indoor)";
  if (kind === "championnat_france_indoor")
    return "Compté : points championnat de France indoor agrégés sur la saison";
  if (kind === "defis_capitaux")
    return "Compté : contribution « défis capitaux » (N meilleurs de la saison selon le barème API)";
  return "Compté dans le total général indoor";
}

function indoorKindTitle(kind: string | undefined): string {
  if (kind === "meeting_standard_max") return "Meeting standard (meilleur de la saison)";
  if (kind === "championnat_france_indoor") return "Championnat de France indoor";
  if (kind === "defis_capitaux") return "Défis capitaux";
  return kind ? String(kind) : "Contribution";
}

function buildIndoorClubCompetitionLines(contributions: any[] | undefined): ClubCompetitionLine[] {
  if (!Array.isArray(contributions)) return [];
  const lines: ClubCompetitionLine[] = contributions.map((c: any, idx: number) => ({
    lineKey: `in-${String(c.event_id ?? idx)}-${idx}`,
    eventId: c.event_id ? String(c.event_id) : undefined,
    eventName: String(c.event_name ?? indoorKindTitle(c.kind)),
    startDate: c.start_date ? String(c.start_date) : undefined,
    points: Number(c.points ?? 0),
    counted: true,
    detail: indoorContributionDetail(c.kind),
  }));
  return sortClubCompetitionLines(lines);
}

/** Ligne affichée pour l’onglet classement général */
type GlobalRankingRow = {
  key: string;
  club_name: string;
  club_code: string;
  global_rank: number;
  best_points: number;
  best_results_count: number;
  best_event_name: string;
  best_event_date: string;
  /** indoor (API dashboard) : aperçu meeting + CF / défis depuis contributions */
  indoorDetail?: {
    regionalPoints: number;
    regionalEventName: string;
    regionalEventDate: string;
    regionalResultsCount: number;
    maifPoints: number;
    maifEventName: string;
  };
  merBreakdown?: MerBreakdown;
  contributions?: any[];
  otherEnduroTerritorial?: any[];
  otherBrsTerritorial?: any[];
  /** Ventilation par compétition (onglet détail par club). */
  competitionLines: ClubCompetitionLine[];
};

function mapDashboardGlobal(globalPayload: any, eventType: EventTypeFilter): GlobalRankingRow[] {
  const rankings = Array.isArray(globalPayload?.rankings) ? globalPayload.rankings : [];
  return rankings.map((row: any, index: number) => {
    const clubCode = String(row.club_code ?? "").trim();
    const contributions = row.contributions;

    let best_event_name = "";
    let best_event_date = "";
    const results_count = Number(row.results_count ?? 0);

    if (eventType === "indoor" && Array.isArray(contributions)) {
      const meeting = contributions.find((c: any) => c.kind === "meeting_standard_max");
      best_event_name = meeting?.event_name || "";
      best_event_date = meeting?.start_date || "";
    } else if (eventType === "mer" && Array.isArray(contributions) && contributions.length) {
      const withEvent = contributions.find((c: any) => c.event_name);
      best_event_name = withEvent?.event_name ?? "Saison (contributions)";
      best_event_date = withEvent?.start_date ?? "";
    }

    let indoorDetail: GlobalRankingRow["indoorDetail"];
    if (eventType === "indoor" && Array.isArray(contributions)) {
      const meeting = contributions.find((c: any) => c.kind === "meeting_standard_max");
      const cf = contributions.filter((c: any) => c.kind === "championnat_france_indoor");
      const defis = contributions.filter((c: any) => c.kind === "defis_capitaux");
      const regionalPoints = Number(meeting?.points ?? 0);
      const maifPoints =
        cf.reduce((s, c) => s + Number(c.points ?? 0), 0) +
        defis.reduce((s, c) => s + Number(c.points ?? 0), 0);
      const labels = [cf.length ? "Championnat France indoor" : "", defis.length ? "Défis capitaux" : ""].filter(
        Boolean
      );
      indoorDetail = {
        regionalPoints,
        regionalEventName: meeting?.event_name ?? "—",
        regionalEventDate: meeting?.start_date ?? "",
        regionalResultsCount: 0,
        maifPoints,
        maifEventName: labels.join(" · ") || (maifPoints > 0 ? "CF / défis" : ""),
      };
    }

    const competitionLines =
      eventType === "mer"
        ? buildMerClubCompetitionLines(row)
        : eventType === "indoor"
          ? buildIndoorClubCompetitionLines(contributions)
          : [];

    return {
      key: clubCode || `row-${index}`,
      club_name: row.club_name ?? "",
      club_code: clubCode,
      global_rank: typeof row.rank === "number" ? row.rank : index + 1,
      best_points: Number(row.total_points ?? 0),
      best_results_count: results_count,
      best_event_name,
      best_event_date,
      indoorDetail,
      merBreakdown: eventType === "mer" ? row.breakdown : undefined,
      contributions,
      otherEnduroTerritorial: eventType === "mer" ? row.other_enduro_territorial : undefined,
      otherBrsTerritorial: eventType === "mer" ? row.other_brs_territorial : undefined,
      competitionLines,
    };
  });
}

function formatMerBreakdownLine(b: MerBreakdown | undefined): string | null {
  if (!b) return null;
  const parts: string[] = [];
  const e = b.enduro_top4;
  const brs = b.brs_top1;
  const cfe = b.championnat_france_enduro;
  const cfb = b.championnat_france_brs;
  const cf = b.championnat_france;
  const bonus = b.territorial_bonus;
  if (e != null && Number(e) !== 0) parts.push(`Enduro (top 4) : ${Number(e).toFixed(1)}`);
  if (brs != null && Number(brs) !== 0) parts.push(`BRS : ${Number(brs).toFixed(1)}`);
  if (cfe != null && Number(cfe) !== 0) parts.push(`CF enduro : ${Number(cfe).toFixed(1)}`);
  if (cfb != null && Number(cfb) !== 0) parts.push(`CF BRS : ${Number(cfb).toFixed(1)}`);
  if (cf != null && Number(cf) !== 0 && cfe == null && cfb == null)
    parts.push(`CF : ${Number(cf).toFixed(1)}`);
  if (bonus != null && Number(bonus) !== 0) parts.push(`Bonus terr. : ${Number(bonus).toFixed(1)}`);
  return parts.length ? parts.join(" · ") : null;
}

export default function ClubRankingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eventType, setEventType] = useState<EventTypeFilter>("indoor");
  const [data, setData] = useState<EventRankings[]>([]);
  const [globalRanking, setGlobalRanking] = useState<GlobalRankingRow[]>([]);
  const [rulesSummary, setRulesSummary] = useState<Record<string, string> | null>(null);
  const [apiPayloadSeason, setApiPayloadSeason] = useState<string | null>(null);
  const [seasonFilterMeta, setSeasonFilterMeta] = useState<SeasonFilterMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "by-event" | "club-detail">("global");
  /** Pour indoor / rivière : année civile. Pour mer : libellé de saison (N = fin au 31/08/N). Rechargement au blur du brouillon. */
  const [calendarYear, setCalendarYear] = useState(currentCalendarYearString);
  const [calendarYearDraft, setCalendarYearDraft] = useState(currentCalendarYearString);
  const [includeTerritorialBonus, setIncludeTerritorialBonus] = useState(true);

  const commitCalendarYearFromDraft = useCallback(() => {
    const next = parseCalendarYearOnCommit(calendarYearDraft);
    setCalendarYearDraft(next);
    setCalendarYear(next);
  }, [calendarYearDraft]);

  // Vérifier les permissions : admin, superadmin ou commission
  useEffect(() => {
    const isAuthorized = 
      user?.role === "admin" || 
      user?.role === "superadmin" || 
      user?.role === "commission";
    
    if (!isAuthorized) {
      navigate("/dashboard");
      return;
    }
  }, [user, navigate]);

  const fetchRankings = useCallback(async () => {
    if (!eventType) return;

    setLoading(true);
    setError(null);
    try {
      const typeParam = eventType === "riviere" ? "riviere" : eventType;
      const params: Record<string, string | boolean> = {
        type: typeParam,
      };

      const yearForApi = calendarYear.trim() || currentCalendarYearString();
      params.season = yearForApi;
      if (eventType === "mer") {
        params.include_territorial_bonus = includeTerritorialBonus;
      }

      const response = await api.get("/rankings/clubs/dashboard", { params });
      const body = response.data;

      if (body?.status && body.status !== "success") {
        setError(body.message || "Erreur lors de la récupération des classements");
        setData([]);
        setGlobalRanking([]);
        setRulesSummary(null);
        setApiPayloadSeason(null);
        setSeasonFilterMeta(null);
        return;
      }

      const payload = body?.data ?? body;
      const seasonFromPayload =
        payload?.season != null && String(payload.season).trim() !== ""
          ? String(payload.season)
          : null;
      setApiPayloadSeason(seasonFromPayload);
      const sf = payload?.season_filter;
      if (sf && typeof sf === "object") {
        setSeasonFilterMeta({
          mode: typeof sf.mode === "string" ? sf.mode : undefined,
          description: typeof sf.description === "string" ? sf.description : undefined,
        });
      } else {
        setSeasonFilterMeta(null);
      }
      setRulesSummary(
        payload?.rules_summary && typeof payload.rules_summary === "object"
          ? payload.rules_summary
          : null
      );
      setData(mapDashboardByEvent(payload?.byEvent, eventType));
      setGlobalRanking(mapDashboardGlobal(payload?.global ?? {}, eventType));
    } catch (err: any) {
      console.error("Erreur récupération classements:", err);
      setError(err?.response?.data?.message || "Impossible de charger les classements");
      setData([]);
      setGlobalRanking([]);
      setRulesSummary(null);
      setApiPayloadSeason(null);
      setSeasonFilterMeta(null);
    } finally {
      setLoading(false);
    }
  }, [eventType, calendarYear, includeTerritorialBonus]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des classements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Classements des Clubs</h1>
        <p className="text-muted-foreground">
          Consultez les classements des clubs par type d'événement
        </p>
      </div>

      {/* Sélecteur de type d'événement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Type d'événement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={eventType}
            onValueChange={(v) => {
              const next = v as EventTypeFilter;
              setEventType(next);
              if (next === "mer") {
                const def = currentMerSeasonLabelYear();
                setCalendarYear(def);
                setCalendarYearDraft(def);
              }
            }}
          >
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Sélectionner un type d'événement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indoor">Indoor</SelectItem>
              <SelectItem value="mer">Mer</SelectItem>
              <SelectItem value="riviere">Rivière</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 items-start">
            <div className="space-y-2">
              <Label htmlFor="club-rank-calendar-year">
                {eventType === "mer" ? "Saison mer" : "Année calendaire"}
              </Label>
              <Input
                id="club-rank-calendar-year"
                className="w-40"
                inputMode="numeric"
                autoComplete="off"
                value={calendarYearDraft}
                onChange={(e) => setCalendarYearDraft(e.target.value)}
                onBlur={commitCalendarYearFromDraft}
                placeholder={
                  eventType === "mer" ? currentMerSeasonLabelYear() : currentCalendarYearString()
                }
              />
              {eventType === "mer" ? (
                <p className="text-xs text-muted-foreground max-w-lg space-y-1">
                  <span className="block">
                    Une <strong>saison</strong> <code className="text-xs">N</code> court du{" "}
                    <strong>01/09/(N-1)</strong> au <strong>31/08/N</strong> (ex. saison{" "}
                    <code className="text-xs">2026</code> : du{" "}
                    <code className="text-xs">01/09/2025</code> au <code className="text-xs">31/08/2026</code>
                    ). Le paramètre <code className="text-xs">season</code> envoyé est ce numéro{" "}
                    <code className="text-xs">N</code>.
                  </span>
                  <span className="block text-foreground/90">
                    Période pour <code className="text-xs">{parseCalendarYearOnCommit(calendarYearDraft)}</code> :{" "}
                    {formatMerSeasonRangeFromLabel(parseCalendarYearOnCommit(calendarYearDraft))}
                  </span>
                  <span className="block">La recherche se lance à la sortie du champ.</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground max-w-md">
                  La recherche se lance à la sortie du champ. Le paramètre{" "}
                  <code className="text-xs">season</code> envoyé est l’année saisie (ex.{" "}
                  <code className="text-xs">2026</code>) pour indoor et rivière.
                </p>
              )}
            </div>
            {eventType === "mer" && (
              <div className="flex items-center gap-2 pt-6 sm:pt-8">
                <Checkbox
                  id="club-rank-bonus"
                  checked={includeTerritorialBonus}
                  onCheckedChange={(c) => setIncludeTerritorialBonus(c === true)}
                />
                <Label htmlFor="club-rank-bonus" className="font-normal cursor-pointer">
                  Inclure le bonus territorial mer
                </Label>
              </div>
            )}
          </div>

          {eventType === "riviere" && (
            <p className="text-sm text-muted-foreground">
              Agrégation rivière : placeholder côté API — <code className="text-xs">byEvent</code> et{" "}
              <code className="text-xs">global</code> peuvent être vides (voir{" "}
              <code className="text-xs">CLUBS_DASHBOARD_RANKINGS.md</code>).
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(apiPayloadSeason || seasonFilterMeta?.description || seasonFilterMeta?.mode) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            {apiPayloadSeason ? (
              <p className="text-sm">
                <span className="font-medium">Saison renvoyée par l’API :</span>{" "}
                <code className="text-xs">{apiPayloadSeason}</code>
              </p>
            ) : null}
            {seasonFilterMeta?.mode ? (
              <p className="text-xs text-muted-foreground">
                Filtre : <code className="text-xs">{seasonFilterMeta.mode}</code>
              </p>
            ) : null}
            {seasonFilterMeta?.description ? (
              <p className="text-sm text-muted-foreground">{seasonFilterMeta.description}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {/* Onglets */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 border-b bg-muted/30">
          <button
            onClick={() => setActiveTab("global")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "global"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Award className="w-4 h-4" />
            Classement général
          </button>
          <button
            onClick={() => setActiveTab("by-event")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "by-event"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Trophy className="w-4 h-4" />
            Classement par événement
          </button>
          <button
            onClick={() => setActiveTab("club-detail")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "club-detail"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            Détail par club
          </button>
        </div>
      </div>

      {/* Classement Global */}
      {activeTab === "global" && globalRanking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Classement Global ({eventType.toUpperCase()})
            </CardTitle>
            <CardDescription className="space-y-2">
              {rulesSummary && Object.keys(rulesSummary).length > 0 ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {Object.entries(rulesSummary).map(([k, v]) => (
                    <li key={k}>{typeof v === "string" ? v : JSON.stringify(v)}</li>
                  ))}
                </ul>
              ) : eventType === "indoor" ? (
                <p className="text-sm">
                  Total = meilleur meeting standard (barème Points Indoor) + somme des points championnat de France indoor +
                  somme des <em>N</em> meilleurs défis capitaux sur la saison (
                  <code className="text-xs">GET /rankings/clubs/dashboard?type=indoor</code>).
                </p>
              ) : eventType === "mer" ? (
                <p className="text-sm">
                  Total saison = 4 meilleures enduro territoriales + 1 meilleure BRS territoriale + CF enduro + CF BRS +
                  bonus territorial (si activé). Détail par club via <code className="text-xs">breakdown</code> /{" "}
                  <code className="text-xs">contributions</code>.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Agrégation rivière : non implémentée côté API — classements vides attendus.
                </p>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-20 text-center font-semibold">Rang</TableHead>
                    <TableHead className="min-w-[250px] font-semibold">Club</TableHead>
                    <TableHead className="w-36 text-center font-semibold">
                      {eventType === "indoor"
                        ? "Total points"
                        : eventType === "mer"
                          ? "Total saison"
                          : "Total"}
                    </TableHead>
                    {eventType === "indoor" ? (
                      <>
                        <TableHead className="min-w-[180px] text-center font-semibold">
                          Meilleur régional
                        </TableHead>
                        <TableHead className="min-w-[180px] text-center font-semibold">
                          France MAIF
                        </TableHead>
                      </>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {globalRanking.map((club) => {
                    const merDetailLine =
                      eventType === "mer" ? formatMerBreakdownLine(club.merBreakdown) : null;
                    return (
                      <TableRow
                        key={club.key}
                        className={`${
                          club.global_rank === 1
                            ? "bg-amber-50 dark:bg-amber-950/20"
                            : club.global_rank === 2
                              ? "bg-slate-50 dark:bg-slate-900/20"
                              : club.global_rank === 3
                                ? "bg-amber-100 dark:bg-amber-900/20"
                                : ""
                        }`}
                      >
                        <TableCell className="text-center">
                          <span className="font-bold text-lg text-primary">{club.global_rank}</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{club.club_name}</div>
                          {club.club_code && (
                            <div className="text-sm text-muted-foreground">{club.club_code}</div>
                          )}
                          {merDetailLine ? (
                            <div className="text-xs text-muted-foreground mt-1 max-w-md">{merDetailLine}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-xl text-primary">
                            {club.best_points.toFixed(1)}
                          </span>
                        </TableCell>
                        {eventType === "indoor" ? (
                          <>
                            <TableCell className="text-center">
                              <span className="font-semibold">
                                {club.indoorDetail
                                  ? club.indoorDetail.regionalPoints.toFixed(1)
                                  : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold">
                                {club.indoorDetail ? club.indoorDetail.maifPoints.toFixed(1) : "—"}
                              </span>
                              {club.indoorDetail?.maifEventName ? (
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-[200px] mx-auto">
                                  {club.indoorDetail.maifEventName}
                                </div>
                              ) : null}
                            </TableCell>
                          </>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "global" && globalRanking.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun classement global disponible pour ce type d'événement.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === "club-detail" && globalRanking.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutList className="w-5 h-5 text-primary" />
                Détail par club
              </CardTitle>
              <CardDescription className="text-sm space-y-2">
                {eventType === "mer" ? (
                  <p>
                    Même ordre que le classement général. Chaque ligne est une compétition (ou le bonus territorial).
                    Le badge indique si les points de cette ligne sont inclus dans le total saison ou exclus par les
                    règles (reliquats enduro / BRS territoriaux).
                  </p>
                ) : eventType === "indoor" ? (
                  <p>
                    Liste dérivée des <code className="text-xs">contributions</code> renvoyées par l’API pour la
                    saison : chaque bloc affiché est comptabilisé dans le total indoor.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    La réponse rivière ne fournit pas encore de ventilation par compétition dans ce format.
                  </p>
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {globalRanking.map((club) => (
            <Card key={`club-detail-${club.key}`}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex flex-wrap items-baseline gap-2">
                      <span className="font-bold text-primary tabular-nums">#{club.global_rank}</span>
                      <span>{club.club_name}</span>
                    </CardTitle>
                    {club.club_code ? (
                      <CardDescription className="font-mono text-xs mt-1">{club.club_code}</CardDescription>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total saison</p>
                    <p className="text-xl font-bold text-primary tabular-nums">
                      {club.best_points.toFixed(2)} pts
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {club.competitionLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Aucune ventilation par compétition dans la réponse API pour ce club.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-[220px] font-semibold">Compétition</TableHead>
                          <TableHead className="w-28 text-center font-semibold">Date</TableHead>
                          <TableHead className="w-28 text-right font-semibold">Points</TableHead>
                          <TableHead className="w-36 text-center font-semibold">Comptabilisation</TableHead>
                          <TableHead className="min-w-[200px] font-semibold">Motif</TableHead>
                          <TableHead className="w-[200px] font-semibold">Liens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {club.competitionLines.map((line) => {
                          const dateStr =
                            line.startDate && dayjs(line.startDate).isValid()
                              ? dayjs(line.startDate).format("DD/MM/YYYY")
                              : "—";
                          return (
                            <TableRow
                              key={line.lineKey}
                              className={line.counted ? "" : "bg-muted/40"}
                            >
                              <TableCell>
                                <div className="font-medium break-words">{line.eventName}</div>
                              </TableCell>
                              <TableCell className="text-center text-sm text-muted-foreground whitespace-nowrap">
                                {dateStr}
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                {line.points.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center">
                                {line.counted ? (
                                  <Badge className="whitespace-nowrap">Compté</Badge>
                                ) : (
                                  <Badge variant="secondary" className="whitespace-nowrap">
                                    Non compté
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-md">
                                {line.detail}
                              </TableCell>
                              <TableCell>
                                {line.eventId ? (
                                  <div className="flex flex-col gap-1">
                                    {eventType === "mer" ? (
                                      <>
                                        <Button asChild variant="link" size="sm" className="h-auto p-0 justify-start">
                                          <Link to={`/event/${line.eventId}/endurance-mer`}>Mer (import)</Link>
                                        </Button>
                                        <Button asChild variant="link" size="sm" className="h-auto p-0 justify-start">
                                          <Link to={`/event/${line.eventId}/results`}>Résultats org.</Link>
                                        </Button>
                                        <Button asChild variant="link" size="sm" className="h-auto p-0 justify-start">
                                          <Link to={`/public/event/${line.eventId}/results`}>Résultats publics</Link>
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button asChild variant="link" size="sm" className="h-auto p-0 justify-start">
                                          <Link to={`/event/${line.eventId}/results`}>Résultats org.</Link>
                                        </Button>
                                        <Button asChild variant="link" size="sm" className="h-auto p-0 justify-start">
                                          <Link to={`/public/event/${line.eventId}/results`}>Résultats publics</Link>
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "club-detail" && globalRanking.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucune donnée pour le détail par club (classement général vide).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Classements par Événement */}
      {activeTab === "by-event" &&
        (data.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Aucun classement disponible pour ce type d'événement.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {data.map((eventRankings) => {
              const ev = eventRankings.event;
              const sd = dayjs(ev.start_date);
              const ed = dayjs(ev.end_date);
              const startOk = sd.isValid();
              const endOk = ed.isValid();
              const dateLabel =
                startOk && endOk && !sd.isSame(ed, "day")
                  ? `${sd.format("DD/MM/YYYY")} – ${ed.format("DD/MM/YYYY")}`
                  : startOk
                    ? sd.format("DD/MM/YYYY")
                    : "—";
              const showMerAdmin = eventSupportsEnduranceMerLink(ev.race_type);
              return (
              <Card key={ev.id}>
                <CardHeader>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 min-w-0 space-y-2">
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        <Trophy className="w-5 h-5 text-primary shrink-0" />
                        <span className="break-words">{ev.name}</span>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                          Type : {ev.race_type || "—"}
                        </span>
                        {ev.season ? (
                          <span className="inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                            Saison (événement) : {ev.season}
                          </span>
                        ) : null}
                        {apiPayloadSeason ? (
                          <span className="inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                            {eventType === "mer" ? "Saison (requête)" : "Filtre API"} : {apiPayloadSeason}
                          </span>
                        ) : null}
                      </div>
                      <CardDescription className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 mt-0">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>{dateLabel}</span>
                        </div>
                        {ev.location ? (
                          <div className="flex items-start gap-2 min-w-0">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="break-words">{ev.location}</span>
                          </div>
                        ) : null}
                      </CardDescription>
                      <p className="text-xs text-muted-foreground font-mono break-all">
                        ID événement : {ev.id}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 lg:items-end lg:ml-4">
                      <p className="text-xs text-muted-foreground lg:text-right">Vérifications</p>
                      <div className="flex flex-wrap gap-2">
                        {showMerAdmin ? (
                          <Button asChild variant="default" size="sm">
                            <Link to={`/event/${ev.id}/endurance-mer`}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Import / classement mer
                            </Link>
                          </Button>
                        ) : null}
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/event/${ev.id}/results`}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Résultats (org.)
                          </Link>
                        </Button>
                        <Button asChild variant="secondary" size="sm">
                          <Link to={`/public/event/${ev.id}/results`}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Résultats publics
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-20 text-center font-semibold">Rang</TableHead>
                          <TableHead className="min-w-[250px] font-semibold">Club</TableHead>
                          <TableHead className="w-32 text-center font-semibold">Total points</TableHead>
                          {eventType !== "mer" ? (
                            <>
                              <TableHead className="w-32 text-center font-semibold">Nb points</TableHead>
                              <TableHead className="w-32 text-center font-semibold">Nb résultats</TableHead>
                            </>
                          ) : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventRankings.rankings.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={eventType === "mer" ? 3 : 5}
                              className="text-center text-muted-foreground py-8"
                            >
                              Aucun classement disponible pour cet événement
                            </TableCell>
                          </TableRow>
                        ) : (
                          eventRankings.rankings.map((ranking) => (
                            <TableRow
                              key={ranking.id}
                              className={`${
                                ranking.rank === 1 ? "bg-amber-50 dark:bg-amber-950/20" :
                                ranking.rank === 2 ? "bg-slate-50 dark:bg-slate-900/20" :
                                ranking.rank === 3 ? "bg-amber-100 dark:bg-amber-900/20" : ""
                              }`}
                            >
                              <TableCell className="text-center">
                                {ranking.rank !== null ? (
                                  <span className="font-bold text-lg text-primary">
                                    {ranking.rank}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  {ranking.club_name}
                                </div>
                                {ranking.club_code && (
                                  <div className="text-sm text-muted-foreground">
                                    {ranking.club_code}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-bold text-xl text-primary">
                                  {ranking.total_points.toFixed(1)}
                                </span>
                              </TableCell>
                              {eventType !== "mer" ? (
                                <>
                                  <TableCell className="text-center">
                                    <span className="text-muted-foreground">
                                      {ranking.points_count} point{ranking.points_count > 1 ? "s" : ""}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-muted-foreground">
                                      {ranking.results_count || 0} résultat
                                      {(ranking.results_count || 0) > 1 ? "s" : ""}
                                    </span>
                                  </TableCell>
                                </>
                              ) : null}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        ))}
    </div>
  );
}

