import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, FileUp, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AdminPage } from "@/components/layout/AdminPage";
import { formatDuration } from "@/utils/formatTime";
import {
  previewFinishLynx,
  importFinishLynx,
  type FinishLynxPreview,
  type FinishLynxImportResult,
} from "@/api/finishLynx";

type RaceOption = {
  id: string;
  name: string | null;
  race_number: number | null;
  status: string;
};

function actionBadge(action: string) {
  switch (action) {
    case "import":
      return <Badge className="bg-primary">Import</Badge>;
    case "status":
      return <Badge variant="secondary">Statut</Badge>;
    case "error":
      return <Badge variant="destructive">Erreur</Badge>;
    default:
      return <Badge variant="outline">Ignoré</Badge>;
  }
}

export default function FinishLynxImportPage() {
  const { eventId } = useParams();
  const { toast } = useToast();

  const [races, setRaces] = useState<RaceOption[]>([]);
  const [raceId, setRaceId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<FinishLynxPreview | null>(null);
  const [importResult, setImportResult] = useState<FinishLynxImportResult | null>(
    null
  );

  useEffect(() => {
    if (!eventId) return;
    setLoadingRaces(true);
    api
      .get(`/races/event/${eventId}`)
      .then((res) => {
        const list = (res.data?.data || res.data || []) as RaceOption[];
        setRaces(list.sort((a, b) => (a.race_number || 0) - (b.race_number || 0)));
      })
      .catch(() => {
        toast({
          title: "Erreur",
          description: "Impossible de charger les courses",
          variant: "destructive",
        });
      })
      .finally(() => setLoadingRaces(false));
  }, [eventId, toast]);

  const handlePreview = useCallback(async () => {
    if (!raceId || !file) return;
    setPreviewing(true);
    setImportResult(null);
    try {
      const data = await previewFinishLynx(raceId, file);
      setPreview(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || "Échec de l'analyse du fichier LIF";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  }, [raceId, file, toast]);

  const handleImport = useCallback(async () => {
    if (!raceId || !file) return;
    setImporting(true);
    try {
      const result = await importFinishLynx(raceId, file, replaceExisting);
      setImportResult(result);
      toast({
        title: "Import terminé",
        description: `${result.imported} arrivée(s) importée(s) depuis FinishLynx`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || "Échec de l'import FinishLynx";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [raceId, file, replaceExisting, toast]);

  const selectedRace = races.find((r) => r.id === raceId);

  return (
    <AdminPage
      title="Import FinishLynx"
      description="Importer les temps d'arrivée depuis un fichier .lif (photo-finish FinishLynx)"
      icon={Camera}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Course cible</Label>
              {loadingRaces ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement…
                </div>
              ) : (
                <Select value={raceId} onValueChange={setRaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une course" />
                  </SelectTrigger>
                  <SelectContent>
                    {races.map((race) => (
                      <SelectItem key={race.id} value={race.id}>
                        {race.race_number != null ? `#${race.race_number}` : ""}{" "}
                        {race.name || "Course"} ({race.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fichier FinishLynx (.lif)</Label>
              <input
                type="file"
                accept=".lif,.txt"
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setPreview(null);
                  setImportResult(null);
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="replace-existing"
              checked={replaceExisting}
              onCheckedChange={setReplaceExisting}
            />
            <Label htmlFor="replace-existing">
              Remplacer les arrivées déjà enregistrées
            </Label>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              disabled={!raceId || !file || previewing}
            >
              {previewing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              Analyser le fichier
            </Button>
            <Button
              variant="default"
              onClick={handleImport}
              disabled={!raceId || !file || !preview || importing}
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Importer les arrivées
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Aperçu
              {!preview.heat_matches && preview.event.heatNumber != null && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Série LIF #{preview.event.heatNumber} ≠ course #
                  {selectedRace?.race_number ?? "?"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>Épreuve LIF : {preview.event.eventName || "—"}</span>
              <span>·</span>
              <span>Série : {preview.event.heatNumber ?? "—"}</span>
              <span>·</span>
              <span>Point d&apos;arrivée : {preview.finish_point.label}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{preview.summary.to_import} à importer</Badge>
              <Badge variant="outline">
                {preview.summary.status_updates} statuts
              </Badge>
              <Badge variant="outline">{preview.summary.errors} erreurs</Badge>
              <Badge variant="outline">{preview.summary.skipped} ignorés</Badge>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Couloir</th>
                    <th className="px-3 py-2 text-left">Place</th>
                    <th className="px-3 py-2 text-left">Concurrent</th>
                    <th className="px-3 py-2 text-left">Temps</th>
                    <th className="px-3 py-2 text-left">Équipage</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, idx) => (
                    <tr key={`${row.lane}-${idx}`} className="border-t">
                      <td className="px-3 py-2">{row.lane ?? "—"}</td>
                      <td className="px-3 py-2">{row.place ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.competitor_name || "—"}
                        {row.affiliation ? (
                          <span className="text-muted-foreground"> ({row.affiliation})</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {row.time_raw ||
                          (row.time_ms != null ? formatDuration(row.time_ms) : "—")}
                      </td>
                      <td className="px-3 py-2">{row.crew_label || "—"}</td>
                      <td className="px-3 py-2">{actionBadge(row.action)}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-green-700 dark:text-green-400">
              Import terminé — {importResult.imported} arrivée(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Statut course : {importResult.race_status}
            </p>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}
