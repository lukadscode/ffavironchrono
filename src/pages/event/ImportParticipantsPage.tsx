import { useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileUp, Info, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/axios";
import * as XLSX from "xlsx";

export default function ImportParticipantsPage() {
  const { eventId } = useParams();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"create_only" | "update_or_create">("create_only");
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);

  const handleTemplateDownload = async () => {
    if (!eventId) return;
    setIsDownloadingTemplate(true);
    try {
      // Récupérer les catégories de l'événement pour remplir l'onglet de référence
      const categoriesRes = await api.get(`/categories/event/${eventId}/with-crews`);
      const categories = categoriesRes.data?.data || categoriesRes.data || [];

      // Feuille Participants : en-têtes + quelques lignes d'exemple
      // Note: crew_external_id est optionnel - s'il est absent, un ID sera généré automatiquement
      const participantsHeaders = [
        "category_code",
        "club_name",
        "club_code",
        "seat_position",
        "is_coxswain",
        "participant_first_name",
        "participant_last_name",
        "participant_license_number",
        "participant_gender",
        "participant_email",
        "participant_club_name",
        "temps_pronostique",
        "crew_external_id", // Optionnel : pour regrouper manuellement les participants d'un même équipage
      ];

      const participantsExamples = [
        participantsHeaders,
        [
          "J18H2x",
          "Club de Test",
          "ABC",
          "1",
          "0",
          "Jean",
          "Dupont",
          "123456",
          "Homme",
          "jean.dupont@example.com",
          "",
          "420",
          "EQUIPAGE-001", // Optionnel : même ID pour regrouper les participants d'un équipage
        ],
        [
          "J18H2x",
          "Club de Test",
          "ABC",
          "2",
          "0",
          "Pierre",
          "Martin",
          "234567",
          "Homme",
          "pierre.martin@example.com",
          "",
          "420",
          "EQUIPAGE-001", // Même ID = même équipage
        ],
      ];

      const wsParticipants = XLSX.utils.aoa_to_sheet(participantsExamples);

      // Feuille Categories : référence des catégories disponibles
      const categoriesHeaders = ["code", "label", "age_group", "gender", "boat_seats", "has_coxswain"];
      const categoriesRows = [
        categoriesHeaders,
        ...categories.map((cat: any) => [
          cat.code || "",
          cat.label || cat.name || "",
          cat.age_group || "",
          cat.gender || "",
          cat.boat_seats ?? "",
          cat.has_coxswain ?? "",
        ]),
      ];
      const wsCategories = XLSX.utils.aoa_to_sheet(categoriesRows);

      // Création du classeur
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsParticipants, "Participants");
      XLSX.utils.book_append_sheet(wb, wsCategories, "Categories");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `participants_import_template_event_${eventId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Erreur génération template import participants (front):", err);
      toast({
        title: "Erreur",
        description:
          err.response?.data?.message ||
          "Impossible de générer le modèle d'import. Vérifiez la liste des catégories de l'événement.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setImportSummary(null);
    setImportErrors([]);
  };

  const handleSubmit = async () => {
    if (!eventId || !file) {
      toast({
        title: "Fichier manquant",
        description: "Veuillez sélectionner un fichier CSV ou Excel à importer.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    formData.append("dry_run", String(dryRun));

    setIsSubmitting(true);
    setImportSummary(null);
    setImportErrors([]);

    try {
      const res = await api.post(`/events/${eventId}/import-participants`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const data = res.data;
      setImportSummary(data.summary || null);
      setImportErrors(data.errors || []);

      if (data.status === "success") {
        toast({
          title: dryRun ? "Simulation terminée" : "Import terminé",
          description: dryRun
            ? "La simulation s'est déroulée avec succès. Vérifiez le rapport avant de lancer l'import réel."
            : "L'import des participants et équipages a été réalisé avec succès.",
        });
      } else {
        toast({
          title: "Import terminé avec erreurs",
          description: data.message || "Des erreurs ont été détectées durant l'import.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Erreur import participants:", err);
      const apiMessage = err.response?.data?.message;
      const apiErrors = err.response?.data?.errors;

      if (apiErrors && Array.isArray(apiErrors)) {
        setImportErrors(apiErrors);
      }

      toast({
        title: "Erreur",
        description: apiMessage || "Impossible de traiter le fichier d'import",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import de participants et d'équipages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 flex gap-3 items-start">
            <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Utilisez ce module pour importer en masse des participants et leurs équipages à partir d'un fichier
                CSV ou Excel.
              </p>
              <p>
                Le modèle Excel contient deux onglets : <strong>Participants</strong> (à remplir) et{" "}
                <strong>Categories</strong> (liste des catégories disponibles pour l'événement).
              </p>
              <p className="text-xs mt-2">
                <strong>Note :</strong> La colonne <code>crew_external_id</code> est optionnelle. Si elle est absente,
                les équipages seront automatiquement regroupés par catégorie, club et ordre de saisie.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleTemplateDownload}
              disabled={isDownloadingTemplate || !eventId}
            >
              {isDownloadingTemplate ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Télécharger le modèle Excel
            </Button>
            <p className="text-xs text-muted-foreground">
              Vous pouvez aussi utiliser un fichier CSV avec les mêmes en-têtes de colonnes.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fichier d'import (.xlsx ou .csv)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
              {file && (
                <p className="text-xs text-muted-foreground">
                  Fichier sélectionné : <strong>{file.name}</strong>
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mode d'import</Label>
                <Select
                  value={mode}
                  onValueChange={(value: "create_only" | "update_or_create") => setMode(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_only">
                      Créer uniquement les nouveaux équipages (ignorer ceux déjà existants)
                    </SelectItem>
                    <SelectItem value="update_or_create">
                      Créer ou mettre à jour les équipages existants
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Simulation (dry-run)</Label>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={dryRun}
                    onCheckedChange={(checked) => setDryRun(!!checked)}
                    id="dry-run-switch"
                  />
                  <Label htmlFor="dry-run-switch" className="text-sm text-muted-foreground cursor-pointer">
                    Ne rien écrire en base, juste générer un rapport
                  </Label>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !file}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement du fichier...
                  </>
                ) : (
                  <>
                    <FileUp className="w-4 h-4 mr-2" />
                    Lancer l'import
                  </>
                )}
              </Button>
            </div>
          </div>

          {importSummary && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold">Résumé de l'import</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Lignes totales</div>
                  <div className="font-semibold">{importSummary.rows_total ?? "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Équipages créés</div>
                  <div className="font-semibold">{importSummary.crews_created ?? "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Équipages mis à jour</div>
                  <div className="font-semibold">{importSummary.crews_updated ?? "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Participants créés</div>
                  <div className="font-semibold">{importSummary.participants_created ?? "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Participants existants réutilisés</div>
                  <div className="font-semibold">{importSummary.participants_matched ?? "-"}</div>
                </div>
              </div>
            </div>
          )}

          {importErrors && importErrors.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-red-600">Erreurs détectées ({importErrors.length})</h3>
              <div className="max-h-64 overflow-y-auto border rounded-md bg-red-50/50">
                <ul className="text-xs text-red-700 divide-y">
                  {importErrors.map((err, idx) => (
                    <li key={idx} className="px-3 py-2">
                      <span className="font-semibold">Ligne {err.row ?? "?"} : </span>
                      <span>{err.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

