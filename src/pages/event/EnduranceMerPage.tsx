import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Loader2,
  AlertCircle,
  Trophy,
  FileSpreadsheet,
  Waves,
  RefreshCw,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";

// Types API
interface ImportResultRow {
  id?: string;
  event_id: string;
  epreuve_code: string;
  epreuve_libelle?: string | null;
  place: number;
  club_code: string;
  club_name: string;
  points_attributed: string;
  event_format?: string;
  event_level?: string;
  partants_count?: number;
}

interface RankingRow {
  club_code: string;
  club_name: string;
  total_points: number;
  rank: number;
}

/** Un seul code FFAviron : C + 6 chiffres */
const SINGLE_CLUB_CODE_REGEX = /^C\d{6}$/i;
/**
 * Segment d’un code mixte inline dans une cellule (ex. C029009(2)/C029028(3)).
 * Voir FRONTEND_ENDURANCE_MER_IMPORT.md — ne pas vider ces lignes avant le POST.
 */
const MIXED_CLUB_CODE_SEGMENT_REGEX = /^C\d{6}\(\d+\)$/i;
const MIXTE_NOM_CLUB_REGEX = /\([^()]+\)\s*\/\s*.*\([^()]+\)/;

function normalizeCellValue(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * Code club « valide » pour la sanitization : soit un code seul, soit mixte inline
 * (au moins 2 segments séparés par /, chaque segment C######(n)).
 */
function isValidCodeClubCell(codeClub: string): boolean {
  const code = normalizeCellValue(codeClub);
  if (!code) return false;
  if (SINGLE_CLUB_CODE_REGEX.test(code)) return true;
  if (!code.includes("/")) return false;
  const segments = code
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return false;
  return segments.every((seg) => MIXED_CLUB_CODE_SEGMENT_REGEX.test(seg));
}

function sanitizeWorkbookBeforeImport(file: File): Promise<{
  sanitizedFile: File;
  removedRows: number;
  mixedRowsDetected: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const data = reader.result;
        if (!(data instanceof ArrayBuffer)) {
          throw new Error("Impossible de lire le fichier Excel.");
        }

        const workbook = XLSX.read(data, { type: "array" });
        let removedRows = 0;
        let mixedRowsDetected = 0;

        workbook.SheetNames.forEach((sheetName) => {
          if (sheetName.toLowerCase() === "organisateur") return;

          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
            header: 1,
            defval: "",
          });

          const headerIndex = rows.findIndex((row) => {
            const normalized = row.map((c) => normalizeCellValue(c).toLowerCase());
            return (
              normalized.some((c) => c.includes("classement")) &&
              normalized.some((c) => c.includes("code club")) &&
              normalized.some((c) => c.includes("nom club"))
            );
          });

          if (headerIndex < 0) return;

          const headers = rows[headerIndex].map((c) => normalizeCellValue(c).toLowerCase());
          const placeIdx = headers.findIndex((h) => h.includes("classement"));
          const codeClubIdx = headers.findIndex((h) => h.includes("code club"));
          const nomClubIdx = headers.findIndex((h) => h.includes("nom club"));

          if (placeIdx < 0 || codeClubIdx < 0 || nomClubIdx < 0) return;

          for (let i = headerIndex + 1; i < rows.length; i += 1) {
            const row = rows[i];
            const place = normalizeCellValue(row[placeIdx]);
            const codeClub = normalizeCellValue(row[codeClubIdx]);
            const nomClub = normalizeCellValue(row[nomClubIdx]);

            const hasSomeContent = row.some((cell) => normalizeCellValue(cell) !== "");
            if (!hasSomeContent) continue;

            const isValidCodeClub = isValidCodeClubCell(codeClub);
            const isValidRow = isValidCodeClub && nomClub !== "";

            if (MIXTE_NOM_CLUB_REGEX.test(nomClub)) {
              mixedRowsDetected += 1;
            } else if (isValidRow && codeClub.includes("/")) {
              // Mixte inline sur la colonne code club (ex. C029009(2)/C029028(3))
              mixedRowsDetected += 1;
            }

            if (!isValidRow) {
              removedRows += 1;
              row[placeIdx] = "";
              row[codeClubIdx] = "";
              row[nomClubIdx] = "";
            }
          }

          workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
        });

        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const sanitizedFile = new File([wbout], file.name.replace(/\.xls$/i, ".xlsx"), {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        resolve({ sanitizedFile, removedRows, mixedRowsDetected });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsArrayBuffer(file);
  });
}

export default function EnduranceMerPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();

  const [eventName, setEventName] = useState("");
  const [loadingEvent, setLoadingEvent] = useState(true);

  // Import state
  const [file, setFile] = useState<File | null>(null);
  const [eventFormat, setEventFormat] = useState<"enduro" | "brs">("enduro");
  const [eventLevel, setEventLevel] = useState<"territorial" | "championnat_france">("territorial");
  const [replacePrevious, setReplacePrevious] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<{
    message: string;
    inserted: number;
    epreuves: string[];
    errors: string[];
  } | null>(null);

  // Results & ranking
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [filterEpreuve, setFilterEpreuve] = useState<string>("");
  const [filterClub, setFilterClub] = useState("");
  const [resultsViewMode, setResultsViewMode] = useState<"general" | "by_category">("general");

  const fetchEvent = async () => {
    if (!eventId) return;
    try {
      const res = await api.get(`/events/${eventId}`);
      const data = res.data.data || res.data;
      setEventName(data.name || "");
    } catch {
      setEventName("");
    } finally {
      setLoadingEvent(false);
    }
  };

  const fetchResults = async () => {
    if (!eventId) return;
    setLoadingResults(true);
    try {
      const params: Record<string, string> = {};
      if (filterEpreuve) params.epreuve_code = filterEpreuve;
      if (filterClub.trim()) params.club_code = filterClub.trim();
      const res = await api.get(`/events/${eventId}/endurance-mer/import-results`, { params });
      const data = res.data.data ?? [];
      setResults(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Erreur chargement résultats";
      toast({ variant: "destructive", title: "Erreur", description: msg });
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  const fetchRanking = async () => {
    if (!eventId) return;
    setLoadingRanking(true);
    try {
      const res = await api.get(`/events/${eventId}/endurance-mer/ranking`);
      const data = res.data.data ?? [];
      setRanking(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Erreur chargement classement";
      toast({ variant: "destructive", title: "Erreur", description: msg });
      setRanking([]);
    } finally {
      setLoadingRanking(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    fetchResults();
  }, [eventId, filterEpreuve, filterClub]);

  useEffect(() => {
    fetchRanking();
  }, [eventId]);

  const epreuvesList = useMemo(() => {
    const codes = new Set(results.map((r) => r.epreuve_code));
    return Array.from(codes).sort();
  }, [results]);

  const resultsByEpreuve = useMemo(() => {
    const map = new Map<string, ImportResultRow[]>();
    results.forEach((row) => {
      const key = row.epreuve_code || "Sans épreuve";
      const current = map.get(key) ?? [];
      current.push(row);
      map.set(key, current);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [results]);

  const handleImport = async () => {
    if (!eventId || !file) {
      toast({
        variant: "destructive",
        title: "Fichier requis",
        description: "Veuillez sélectionner un fichier Excel (.xlsx).",
      });
      return;
    }
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast({
        variant: "destructive",
        title: "Format invalide",
        description: "Le fichier doit être au format Excel (.xlsx ou .xls).",
      });
      return;
    }

    setImporting(true);
    setImportSuccess(null);
    try {
      const { sanitizedFile, removedRows, mixedRowsDetected } = await sanitizeWorkbookBeforeImport(file);
      const formData = new FormData();
      formData.append("file", sanitizedFile);
      formData.append("event_format", eventFormat);
      formData.append("event_level", eventLevel);
      formData.append("replace_previous", String(replacePrevious));

      const res = await api.post(`/events/${eventId}/endurance-mer/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = res.data?.data ?? {};
      setImportSuccess({
        message: res.data?.message ?? `${data.inserted ?? 0} résultat(s) importé(s)`,
        inserted: data.inserted ?? 0,
        epreuves: data.epreuves ?? [],
        errors: data.errors ?? [],
      });

      toast({
        title: "Import réussi",
        description: res.data?.message ?? `${data.inserted ?? 0} résultat(s) importé(s)`,
      });

      if (removedRows > 0) {
        toast({
          title: "Lignes ignorées avant import",
          description: `${removedRows} ligne(s) sans code club valide (C + 6 chiffres ou mixte C######(n)/…) ou sans nom club ont été neutralisées.`,
        });
      }

      if (mixedRowsDetected > 0) {
        toast({
          title: "Lignes mixtes détectées",
          description:
            "Lignes multi-clubs (nom ou code inline type C######(n)/…). Elles sont conservées dans le fichier envoyé ; la répartition des points est calculée côté API.",
        });
      }

      setFile(null);
      fetchResults();
      fetchRanking();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Erreur lors de l'import";
      toast({ variant: "destructive", title: "Erreur import", description: msg });
    } finally {
      setImporting(false);
    }
  };

  const exportRankingExcel = () => {
    const exportData = ranking.map((r) => ({
      Rang: r.rank,
      "Code club": r.club_code,
      Club: r.club_name,
      "Total points": typeof r.total_points === "number" ? r.total_points.toFixed(2) : r.total_points,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Classement clubs");
    const fileName = `classement_mer_${eventName?.replace(/\s+/g, "_") || "event"}_${dayjs().format("YYYY-MM-DD")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: "Export réussi", description: "Fichier Excel téléchargé." });
  };

  if (loadingEvent) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Waves className="w-8 h-8 text-emerald-600" />
          Résultats Endurance Mer
        </h1>
        <p className="text-muted-foreground">
          Import des résultats Excel (ENDURO / BRS) et classement des clubs pour l'événement{" "}
          {eventName || "cet événement"}.
        </p>
      </div>

      {/* Bloc Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importer un fichier Excel
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Fichier de remontée des résultats FFAviron (une feuille par épreuve : SF1X, SH1X, etc.)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fichier (.xlsx)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={eventFormat} onValueChange={(v) => setEventFormat(v as "enduro" | "brs")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enduro">Enduro</SelectItem>
                  <SelectItem value="brs">BRS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Niveau</Label>
              <Select
                value={eventLevel}
                onValueChange={(v) => setEventLevel(v as "territorial" | "championnat_france")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="territorial">Territorial</SelectItem>
                  <SelectItem value="championnat_france">Championnat de France</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="replace"
                checked={replacePrevious}
                onCheckedChange={(c) => setReplacePrevious(!!c)}
              />
              <Label htmlFor="replace" className="cursor-pointer">
                Remplacer les résultats déjà importés
              </Label>
            </div>
          </div>
          <Button onClick={handleImport} disabled={!file || importing} className="gap-2">
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Importer
          </Button>
          {importSuccess && (
            <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800">
              <AlertDescription>
                {importSuccess.message}
                {importSuccess.epreuves.length > 0 && (
                  <span className="block mt-1 text-sm">
                    Épreuves : {importSuccess.epreuves.join(", ")}
                  </span>
                )}
                {importSuccess.errors.length > 0 && (
                  <span className="block mt-2 text-amber-700 dark:text-amber-400">
                    Erreurs : {importSuccess.errors.join(" ; ")}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Bloc Classement par club */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Classement par club
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Calculé à la volée (plafond 2 équipages par épreuve et par club)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRanking} disabled={loadingRanking}>
              <RefreshCw className={`w-4 h-4 ${loadingRanking ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportRankingExcel} disabled={ranking.length === 0}>
              <Download className="w-4 h-4" />
              Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRanking ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : ranking.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun classement disponible. Importez des résultats pour afficher le classement.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-20 text-center font-semibold">Rang</TableHead>
                    <TableHead className="min-w-[120px] font-semibold">Code club</TableHead>
                    <TableHead className="min-w-[200px] font-semibold">Club</TableHead>
                    <TableHead className="w-28 text-right font-semibold">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((row) => (
                    <TableRow
                      key={row.club_code}
                      className={
                        row.rank === 1
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : row.rank === 2
                            ? "bg-slate-50 dark:bg-slate-900/20"
                            : row.rank === 3
                              ? "bg-amber-100/50 dark:bg-amber-900/10"
                              : ""
                      }
                    >
                      <TableCell className="text-center font-bold">{row.rank}</TableCell>
                      <TableCell className="font-mono text-sm">{row.club_code}</TableCell>
                      <TableCell className="font-medium">{row.club_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {typeof row.total_points === "number"
                          ? row.total_points.toFixed(2)
                          : row.total_points}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloc Résultats importés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Résultats importés
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Liste des lignes importées avec points attribués (filtres optionnels)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="inline-flex rounded-md border p-1 bg-muted/40">
            <Button
              type="button"
              size="sm"
              variant={resultsViewMode === "general" ? "default" : "ghost"}
              onClick={() => setResultsViewMode("general")}
            >
              Général
            </Button>
            <Button
              type="button"
              size="sm"
              variant={resultsViewMode === "by_category" ? "default" : "ghost"}
              onClick={() => setResultsViewMode("by_category")}
            >
              Par catégories
            </Button>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-2 min-w-[180px]">
              <Label>Épreuve</Label>
              <Select value={filterEpreuve || "all"} onValueChange={(v) => setFilterEpreuve(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {epreuvesList.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[180px]">
              <Label>Code club</Label>
              <Input
                placeholder="Ex. C064027"
                value={filterClub}
                onChange={(e) => setFilterClub(e.target.value)}
              />
            </div>
          </div>
          {loadingResults ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun résultat importé. Utilisez le bloc ci-dessus pour importer un fichier Excel.
            </p>
          ) : (
            resultsViewMode === "general" ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Épreuve</TableHead>
                      <TableHead className="w-20 text-center font-semibold">Place</TableHead>
                      <TableHead className="min-w-[100px] font-semibold">Code club</TableHead>
                      <TableHead className="min-w-[200px] font-semibold">Nom club</TableHead>
                      <TableHead className="w-24 text-right font-semibold">Points</TableHead>
                      <TableHead className="w-20 text-center font-semibold">Partants</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((row, idx) => (
                      <TableRow key={row.id ?? `${row.epreuve_code}-${row.place}-${row.club_code}-${idx}`}>
                        <TableCell className="font-mono text-sm">{row.epreuve_code}</TableCell>
                        <TableCell className="text-center">{row.place}</TableCell>
                        <TableCell className="font-mono text-sm">{row.club_code}</TableCell>
                        <TableCell>{row.club_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {row.points_attributed ?? "-"}
                        </TableCell>
                        <TableCell className="text-center">{row.partants_count ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="space-y-6">
                {resultsByEpreuve.map(([epreuveCode, rows]) => (
                  <div key={epreuveCode} className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {epreuveCode} ({rows.length})
                    </h3>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-20 text-center font-semibold">Place</TableHead>
                            <TableHead className="min-w-[100px] font-semibold">Code club</TableHead>
                            <TableHead className="min-w-[200px] font-semibold">Nom club</TableHead>
                            <TableHead className="w-24 text-right font-semibold">Points</TableHead>
                            <TableHead className="w-20 text-center font-semibold">Partants</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row, idx) => (
                            <TableRow key={row.id ?? `${row.epreuve_code}-${row.place}-${row.club_code}-${idx}`}>
                              <TableCell className="text-center">{row.place}</TableCell>
                              <TableCell className="font-mono text-sm">{row.club_code}</TableCell>
                              <TableCell>{row.club_name}</TableCell>
                              <TableCell className="text-right font-mono">
                                {row.points_attributed ?? "-"}
                              </TableCell>
                              <TableCell className="text-center">{row.partants_count ?? "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
