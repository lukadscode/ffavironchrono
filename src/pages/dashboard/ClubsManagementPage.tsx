import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Loader2,
  Search,
  RefreshCw,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Club = {
  id: string;
  nom: string;
  nom_court: string | null;
  code: string;
  code_court: string | null;
  etat: string | null;
  type: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

type SyncResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
};

type ImportResult = {
  total: number;
  updated: number;
  not_found: number;
  errors: number;
  details?: Array<{ code: string; error: string }>;
};

export default function ClubsManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEtat, setFilterEtat] = useState<string>("all");
  const [filterCodeCourt, setFilterCodeCourt] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Filtrer les clubs selon la recherche et les filtres
  const filteredClubs = useMemo(() => {
    let filtered = clubs;

    // Filtre de recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (club) =>
          club.nom?.toLowerCase().includes(query) ||
          club.nom_court?.toLowerCase().includes(query) ||
          club.code?.toLowerCase().includes(query) ||
          club.code_court?.toLowerCase().includes(query)
      );
    }

    // Filtre par type
    if (filterType !== "all") {
      filtered = filtered.filter((club) => club.type === filterType);
    }

    // Filtre par état
    if (filterEtat !== "all") {
      filtered = filtered.filter((club) => club.etat === filterEtat);
    }

    // Filtre par code court (présent/absent)
    if (filterCodeCourt === "with") {
      filtered = filtered.filter((club) => club.code_court);
    } else if (filterCodeCourt === "without") {
      filtered = filtered.filter((club) => !club.code_court);
    }

    return filtered;
  }, [clubs, searchQuery, filterType, filterEtat, filterCodeCourt]);

  // Statistiques
  const stats = useMemo(() => {
    return {
      total: clubs.length,
      withCodeCourt: clubs.filter((c) => c.code_court).length,
      withoutCodeCourt: clubs.filter((c) => !c.code_court).length,
      active: clubs.filter((c) => c.etat === "A").length,
      inactive: clubs.filter((c) => c.etat === "I").length,
    };
  }, [clubs]);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    fetchClubs();
  }, [isAdmin, navigate]);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filterType !== "all") params.type = filterType;
      
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `/clubs?${queryString}` : "/clubs";
      
      const res = await api.get(url);
      setClubs(res.data.data || []);
    } catch (err: any) {
      console.error("Erreur chargement clubs", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de charger les clubs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post("/clubs/sync");
      setSyncResult(res.data.data);
      toast({
        title: "Synchronisation terminée",
        description: `${res.data.data.updated} clubs mis à jour, ${res.data.data.created} créés`,
      });
      await fetchClubs(); // Recharger la liste
    } catch (err: any) {
      console.error("Erreur synchronisation", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Erreur lors de la synchronisation",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      let jsonData: Array<{ code: string; code_court: string }> = [];

      // Parser le fichier
      if (file.name.endsWith(".json")) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        jsonData = Array.isArray(parsed) ? parsed : parsed.clubs || [];
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(firstSheet);
      } else {
        throw new Error("Format non supporté. Utilisez .json, .xlsx ou .xls");
      }

      // Valider
      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        throw new Error("Le fichier doit contenir un tableau non vide");
      }

      const isValid = jsonData.every(
        (item) => item.code && typeof item.code === "string" && item.code_court && typeof item.code_court === "string"
      );

      if (!isValid) {
        throw new Error('Chaque ligne doit contenir "code" et "code_court"');
      }

      // Envoyer à l'API
      const res = await api.post("/clubs/import-code-court", {
        clubs: jsonData.map((item) => ({
          code: String(item.code).trim(),
          code_court: String(item.code_court).trim(),
        })),
      });

      setImportResult(res.data.data);
      
      if (res.data.data.errors === 0 && res.data.data.not_found === 0) {
        toast({
          title: "Import réussi",
          description: `${res.data.data.updated} codes courts importés avec succès`,
        });
      } else {
        toast({
          title: "Import terminé avec avertissements",
          description: `${res.data.data.updated} mis à jour, ${res.data.data.not_found} non trouvés`,
          variant: "default",
        });
      }

      await fetchClubs(); // Recharger la liste
      setImportDialogOpen(false);
      
      // Réinitialiser le input file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error("Erreur import", err);
      toast({
        title: "Erreur d'import",
        description: err?.response?.data?.message || err.message || "Erreur lors de l'import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    try {
      const exportData = clubs.map((club) => ({
        code: club.code,
        nom: club.nom,
        nom_court: club.nom_court || "",
        code_court: club.code_court || "",
        etat: club.etat || "",
        type: club.type || "",
      }));

      // Créer un fichier Excel
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clubs");
      XLSX.writeFile(wb, `clubs_export_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast({
        title: "Export réussi",
        description: `${exportData.length} clubs exportés`,
      });
    } catch (err: any) {
      console.error("Erreur export", err);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'export",
        variant: "destructive",
      });
    }
  };

  const handleExportTemplate = () => {
    try {
      // Template avec un exemple
      const templateData = [
        {
          code: "C130001",
          code_court: "CAM",
        },
        {
          code: "C130002",
          code_court: "CAB",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "template_import_code_court.xlsx");

      toast({
        title: "Template téléchargé",
        description: "Téléchargez le template, remplissez-le et réimportez-le",
      });
    } catch (err: any) {
      console.error("Erreur export template", err);
      toast({
        title: "Erreur",
        description: "Erreur lors de la création du template",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des clubs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8" />
            Gestion des clubs
          </h1>
          <p className="text-muted-foreground mt-1">
            Synchronisez et gérez les clubs depuis l'API FFAviron
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Synchronisation...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Synchroniser depuis FFAviron
              </>
            )}
          </Button>
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Importer codes courts
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Résultats de synchronisation */}
      {syncResult && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Résultat de la synchronisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total traité</p>
                <p className="text-2xl font-bold">{syncResult.total}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Créés</p>
                <p className="text-2xl font-bold text-green-600">{syncResult.created}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mis à jour</p>
                <p className="text-2xl font-bold text-blue-600">{syncResult.updated}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inchangés</p>
                <p className="text-2xl font-bold text-gray-600">{syncResult.skipped}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résultats d'import */}
      {importResult && (
        <Card
          className={
            importResult.errors > 0 || importResult.not_found > 0
              ? "border-orange-200 bg-orange-50"
              : "border-green-200 bg-green-50"
          }
        >
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {importResult.errors === 0 && importResult.not_found === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              )}
              Résultat de l'import
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{importResult.total}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mis à jour</p>
                <p className="text-2xl font-bold text-green-600">{importResult.updated}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Non trouvés</p>
                <p className="text-2xl font-bold text-orange-600">{importResult.not_found}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Erreurs</p>
                <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
              </div>
            </div>
            {importResult.details && importResult.details.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-semibold mb-2">Détails des erreurs :</p>
                <ul className="space-y-1">
                  {importResult.details.map((detail, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      <span className="font-mono">{detail.code}</span>: {detail.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total clubs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avec code court
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.withCodeCourt}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sans code court
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.withoutCodeCourt}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Résultats filtrés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredClubs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recherche et filtres */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Rechercher par nom, code, nom court ou code court..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="CLU">Clubs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>État</Label>
                <Select value={filterEtat} onValueChange={setFilterEtat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les états" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les états</SelectItem>
                    <SelectItem value="A">Actif</SelectItem>
                    <SelectItem value="I">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Code court</Label>
                <Select value={filterCodeCourt} onValueChange={setFilterCodeCourt}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="with">Avec code court</SelectItem>
                    <SelectItem value="without">Sans code court</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des clubs */}
      <Card>
        <CardHeader>
          <CardTitle>Clubs ({filteredClubs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClubs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun club trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Nom court</TableHead>
                    <TableHead>Code court</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClubs.map((club) => (
                    <TableRow key={club.id}>
                      <TableCell className="font-mono font-semibold">{club.code}</TableCell>
                      <TableCell className="font-medium">{club.nom}</TableCell>
                      <TableCell>{club.nom_court || "—"}</TableCell>
                      <TableCell>
                        {club.code_court ? (
                          <Badge variant="outline" className="font-mono">
                            {club.code_court}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {club.etat === "A" ? (
                          <Badge className="bg-green-500">Actif</Badge>
                        ) : club.etat === "I" ? (
                          <Badge variant="secondary">Inactif</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{club.type || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'import */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importer les codes courts</DialogTitle>
            <DialogDescription>
              Importez les codes courts depuis un fichier JSON ou Excel. Le fichier doit contenir
              les colonnes "code" et "code_court".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-4">
                  <FileSpreadsheet className="w-12 h-12 text-muted-foreground" />
                  <FileJson className="w-12 h-12 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">
                    Formats supportés : .xlsx, .xls, .json
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Le fichier doit contenir les colonnes : <code>code</code> et{" "}
                    <code>code_court</code>
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Import en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Sélectionner un fichier
                      </>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportTemplate} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Télécharger un template
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

