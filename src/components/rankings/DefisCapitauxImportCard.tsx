import { useEffect, useState } from "react";
import api from "@/lib/axios";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

export type DefisCapitauxImportMeta = {
  source?: string;
  imported_at?: string;
  source_filename?: string | null;
  rows_count?: number;
} | null;

type PreviewRow = {
  imported_rank: number;
  club_code: string | null;
  club_name: string;
  points: number;
  club_matched: boolean;
};

type PreviewWarning = { row: number; message: string };

type Props = {
  season: string;
  importMeta: DefisCapitauxImportMeta;
  onImported: () => void;
};

export function DefisCapitauxImportCard({ season, importMeta, onImported }: Props) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<PreviewWarning[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFile(null);
    setPreviewRows(null);
    setPreviewFilename(null);
    setWarnings([]);
    setError(null);
  }, [season]);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Rang", "Code club", "Club"],
      [1, "C013001", "Exemple Club Aviron"],
      [2, "C069001", "Exemple Club 2"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "7 defis capitaux");
    XLSX.writeFile(wb, `modele_7_defis_capitaux_${season}.xlsx`);
  };

  const handlePreview = async () => {
    if (!file) {
      toast({
        title: "Fichier manquant",
        description: "Choisissez le tableau Excel du classement final.",
        variant: "destructive",
      });
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("season", season);
      const res = await api.post("/rankings/indoor/defis-capitaux/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data?.data ?? res.data;
      setPreviewRows(Array.isArray(data?.rows) ? data.rows : []);
      setPreviewFilename(data?.source_filename ?? file.name);
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Impossible de lire le fichier.";
      setError(message);
      setPreviewRows(null);
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!previewRows || previewRows.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/rankings/indoor/defis-capitaux/import", {
        season,
        source_filename: previewFilename,
        rows: previewRows,
      });
      toast({
        title: "Classement importé",
        description: `${previewRows.length} club(s) — points 7 défis capitaux ajoutés au total indoor.`,
      });
      setFile(null);
      setPreviewRows(null);
      setWarnings([]);
      onImported();
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Impossible d'enregistrer l'import.";
      setError(message);
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Supprimer l'import 7 défis capitaux de cette saison ?")) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await api.delete("/rankings/indoor/defis-capitaux", { params: { season } });
      toast({
        title: "Import supprimé",
        description: "Les points 7 défis capitaux ne sont plus dans le classement indoor.",
      });
      onImported();
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Impossible de supprimer l'import.";
      setError(message);
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const unmatched = (previewRows || []).filter((r) => !r.club_matched).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          7 défis capitaux — tableau final
        </CardTitle>
        <CardDescription>
          Événement annuel distinct. Importez le classement final (Excel) : Chrono applique le barème
          rang → points, puis ajoute ces points au classement indoor de la saison{" "}
          <code className="text-xs">{season}</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {importMeta?.rows_count ? (
          <Alert>
            <AlertDescription className="text-sm space-y-1">
              <p>
                <strong>{importMeta.rows_count}</strong> club(s) déjà importé(s)
                {importMeta.source_filename ? (
                  <>
                    {" "}
                    depuis <code className="text-xs">{importMeta.source_filename}</code>
                  </>
                ) : null}
                {importMeta.imported_at ? (
                  <> le {new Date(importMeta.imported_at).toLocaleString("fr-FR")}</>
                ) : null}
                .
              </p>
              <p className="text-muted-foreground">
                Un nouvel import remplace entièrement le tableau de cette saison.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun tableau importé pour cette saison. Colonnes attendues :{" "}
            <strong>Rang</strong>, <strong>Code club</strong>, <strong>Club</strong>.
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-start">
          <div className="space-y-2">
            <Label htmlFor="defis-capitaux-file">Fichier (.xlsx / .xls / .csv)</Label>
            <Input
              id="defis-capitaux-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreviewRows(null);
                setWarnings([]);
                setError(null);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-6 sm:pt-8">
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Modèle Excel
            </Button>
            <Button type="button" onClick={handlePreview} disabled={previewing || !file}>
              {previewing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Lecture…
                </>
              ) : (
                "Prévisualiser les points"
              )}
            </Button>
            {importMeta?.rows_count ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Suppression…" : "Supprimer l'import"}
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {previewRows ? (
          <div className="space-y-3">
            <p className="text-sm">
              {previewRows.length} club(s) — points calculés avec le barème Défis capitaux.
              {unmatched > 0 ? (
                <span className="text-amber-700 dark:text-amber-400">
                  {" "}
                  {unmatched} club(s) non reconnus dans le registre (importés quand même).
                </span>
              ) : null}
            </p>
            {warnings.length > 0 ? (
              <ul className="text-xs text-muted-foreground list-disc list-inside max-h-24 overflow-y-auto">
                {warnings.slice(0, 12).map((w) => (
                  <li key={`${w.row}-${w.message}`}>
                    Ligne {w.row} : {w.message}
                  </li>
                ))}
                {warnings.length > 12 ? <li>… et {warnings.length - 12} autre(s)</li> : null}
              </ul>
            ) : null}
            <div className="overflow-x-auto max-h-80 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-20 text-center">Rang</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="w-28 text-center">Points</TableHead>
                    <TableHead className="w-28 text-center">Registre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 80).map((row, idx) => (
                    <TableRow key={`${row.imported_rank}-${row.club_code ?? row.club_name}-${idx}`}>
                      <TableCell className="text-center font-semibold">{row.imported_rank}</TableCell>
                      <TableCell>
                        <div className="font-medium">{row.club_name}</div>
                        {row.club_code ? (
                          <div className="text-xs text-muted-foreground font-mono">{row.club_code}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center font-semibold tabular-nums">
                        {Number(row.points).toFixed(1)}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.club_matched ? (
                          <Badge className="bg-emerald-100 text-emerald-800">OK</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">Non trouvé</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {previewRows.length > 80 ? (
              <p className="text-xs text-muted-foreground">
                Aperçu des 80 premières lignes ({previewRows.length} au total).
              </p>
            ) : null}
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer et ajouter au classement indoor"
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
