import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
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
  DialogTrigger,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Calendar,
  MapPin,
  Plus,
  Loader2,
  Trash2,
  AlertTriangle,
  Search,
  LayoutGrid,
  List,
  Waves,
  Anchor,
  Dumbbell,
  RefreshCw,
} from "lucide-react";
import dayjs from "dayjs";

type Event = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  race_type?: string;
  is_finished?: boolean;
  is_visible?: boolean;
};

/** Élément renvoyé par GET /import/manifestations (simplifié pour l’UI). */
type FfaManifestation = {
  id: string | number;
  libelle?: string;
  nom?: string;
  type?: { id?: string | number; libelle?: string; disciplines?: unknown };
  details_type?: { code?: string; libelle?: string };
  structure?: { nom?: string; code?: string };
  date_debut?: string;
  date_fin?: string;
};

function manifestationDisplayTitle(m: FfaManifestation): string {
  const t = (m.libelle || m.nom || "").trim();
  return t || `Manifestation ${m.id}`;
}

function manifestationMatchesQuery(m: FfaManifestation, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  const parts = [
    String(m.id),
    manifestationDisplayTitle(m),
    m.type?.libelle,
    m.details_type?.code,
    m.details_type?.libelle,
    m.structure?.nom,
    m.structure?.code,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return parts.some((p) => p.includes(n));
}

/** Compare le type d'événement (casse / accents) pour l'UI */
function raceTypeMatches(current: string | undefined, mode: "rivière" | "mer" | "indoor") {
  const n = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  return n(current) === n(mode);
}

export default function EventsManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manifestationId, setManifestationId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [manifestations, setManifestations] = useState<FfaManifestation[]>([]);
  const [manifestListLoading, setManifestListLoading] = useState(false);
  const [manifestListError, setManifestListError] = useState<string | null>(null);
  const [manifestListSearch, setManifestListSearch] = useState("");
  const [fetchAllManifestations, setFetchAllManifestations] = useState(false);
  const [manifestParPage, setManifestParPage] = useState(200);
  const [manifestPage, setManifestPage] = useState(1);
  const [manifestMeta, setManifestMeta] = useState<Record<string, unknown> | null>(null);
  /** Filtres relayés tels quels vers l’intranet FFA (sauf par_page, page, fetch_all gérés localement). */
  const [ffaDateDebut, setFfaDateDebut] = useState("");
  const [ffaDateFin, setFfaDateFin] = useState("");
  const [ffaModeleId, setFfaModeleId] = useState("");
  const [ffaStructureId, setFfaStructureId] = useState("");
  const [ffaDisciplineCode, setFfaDisciplineCode] = useState("");
  const [ffaTourId, setFfaTourId] = useState("");
  const [ffaInclude, setFfaInclude] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [raceTypeSavingId, setRaceTypeSavingId] = useState<string | null>(null);

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Filtrer les événements selon la recherche
  const filteredManifestations = useMemo(() => {
    return manifestations.filter((m) => manifestationMatchesQuery(m, manifestListSearch));
  }, [manifestations, manifestListSearch]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) {
      return events;
    }
    const query = searchQuery.toLowerCase();
    return events.filter(
      (event) =>
        event.name.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.race_type?.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    fetchAllEvents();
  }, [isAdmin, navigate]);

  const fetchAllEvents = async () => {
    try {
      const res = await api.get("/events");
      setEvents(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement événements", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les événements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadManifestationsList = useCallback(async () => {
    setManifestListLoading(true);
    setManifestListError(null);
    try {
      const par = Math.min(500, Math.max(1, Math.floor(manifestParPage)));
      const pg = Math.max(1, Math.floor(manifestPage));
      const params: Record<string, string | boolean> = {
        par_page: String(par),
      };
      if (fetchAllManifestations) {
        params.fetch_all = true;
      } else {
        params.page = String(pg);
      }

      const appendFfa = (key: string, value: string) => {
        const t = value.trim();
        if (t) params[key] = t;
      };
      appendFfa("date_debut", ffaDateDebut);
      appendFfa("date_fin", ffaDateFin);
      appendFfa("modele_id", ffaModeleId);
      appendFfa("structure_id", ffaStructureId);
      appendFfa("discipline_code", ffaDisciplineCode);
      appendFfa("tour_id", ffaTourId);
      appendFfa("include", ffaInclude);

      const res = await api.get("/import/manifestations", { params });
      const body = res.data;
      if (body?.status && body.status !== "success") {
        throw new Error(body.message || "Réponse liste manifestations invalide");
      }
      const list = Array.isArray(body?.data) ? body.data : [];
      setManifestations(list as FfaManifestation[]);
      setManifestMeta(
        body?.meta && typeof body.meta === "object" ? (body.meta as Record<string, unknown>) : null
      );
    } catch (err: any) {
      console.error("Erreur chargement manifestations FFA", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err?.response?.status === 503
          ? "Service manifestations indisponible (ex. jeton intranet serveur manquant)."
          : null) ||
        err?.message ||
        "Impossible de charger la liste des manifestations.";
      setManifestListError(msg);
      setManifestations([]);
      setManifestMeta(null);
    } finally {
      setManifestListLoading(false);
    }
  }, [
    fetchAllManifestations,
    manifestParPage,
    manifestPage,
    ffaDateDebut,
    ffaDateFin,
    ffaModeleId,
    ffaStructureId,
    ffaDisciplineCode,
    ffaTourId,
    ffaInclude,
  ]);

  const handlePostManifestation = async (mode: "import" | "update") => {
    if (!manifestationId.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir ou sélectionner un ID de manifestation",
        variant: "destructive",
      });
      return;
    }

    const stored = localStorage.getItem("authTokens");
    if (!stored) {
      toast({
        title: "Erreur d'authentification",
        description: "Vous n'êtes pas connecté. Veuillez vous reconnecter.",
        variant: "destructive",
      });
      navigate("/admin/login");
      return;
    }

    const id = manifestationId.trim();
    const path =
      mode === "update" ? `/import/manifestation/${id}/update` : `/import/manifestation/${id}`;

    setIsImporting(true);
    try {
      const res = await api.post(path);
      const name = res.data?.data?.name;

      toast({
        title: "Succès",
        description:
          mode === "update"
            ? name
              ? `Manifestation « ${name} » mise à jour avec succès.`
              : "Mise à jour incrémentale effectuée."
            : name
              ? `Événement « ${name} » importé avec succès.`
              : "Import effectué avec succès.",
      });

      setManifestationId("");
      setDialogOpen(false);
      setManifestListSearch("");
      await fetchAllEvents();
    } catch (err: any) {
      console.error("Erreur import / mise à jour manifestation", err);

      let errorMessage =
        mode === "update"
          ? "Impossible de mettre à jour la manifestation"
          : "Impossible d'importer l'événement";

      if (err?.response?.status === 401 || err?.response?.status === 403) {
        errorMessage =
          "Vous n'êtes pas autorisé à effectuer cette action. Veuillez vous reconnecter.";
        const tokens = localStorage.getItem("authTokens");
        if (!tokens) {
          navigate("/admin/login");
          return;
        }
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    setIsDeleting(true);
    try {
      await api.delete(`/events/${eventToDelete.id}`);
      
      toast({
        title: "Succès",
        description: `L'événement "${eventToDelete.name}" a été supprimé avec succès.`,
      });

      // Fermer la modal
      setDeleteDialogOpen(false);
      setEventToDelete(null);

      // Recharger la liste des événements
      await fetchAllEvents();
    } catch (err: any) {
      console.error("Erreur suppression événement", err);
      
      let errorMessage = "Impossible de supprimer l'événement";
      
      if (err?.response?.status === 404) {
        errorMessage = "Événement non trouvé";
      } else if (err?.response?.status === 401) {
        errorMessage = "Vous n'êtes pas autorisé à supprimer cet événement";
      } else if (err?.response?.status === 500) {
        errorMessage = err?.response?.data?.message || "Erreur serveur lors de la suppression";
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangeRaceType = async (eventId: string, newType: string) => {
    setRaceTypeSavingId(eventId);
    try {
      // L'API attend en général PUT (comme sur la page Vue d'ensemble événement), pas PATCH
      const res = await api.put(`/events/${eventId}`, { race_type: newType });
      const updated = res.data?.data;
      const nextType =
        typeof updated?.race_type === "string" && updated.race_type.length > 0
          ? updated.race_type
          : newType;
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, race_type: nextType } : e))
      );
      toast({
        title: "Type mis à jour",
        description: `Le type de l'événement a été changé en « ${nextType} ».`,
      });
    } catch (err: any) {
      console.error("Erreur mise à jour du type d'événement", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err?.response?.status === 405 || err?.response?.status === 404
          ? "Méthode ou route non disponible. Vérifiez que l’API autorise PUT /events/:id avec race_type."
          : null) ||
        "Impossible de mettre à jour le type d'événement.";
      toast({
        title: "Erreur",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setRaceTypeSavingId(null);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold mb-2">Gestion des événements</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gérez tous les événements de la plateforme
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setManifestationId("");
              setManifestListSearch("");
              setManifestListError(null);
              setFfaDateDebut("");
              setFfaDateFin("");
              setFfaModeleId("");
              setFfaStructureId("");
              setFfaDisciplineCode("");
              setFfaTourId("");
              setFfaInclude("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Importer un événement</span>
              <span className="sm:hidden">Importer</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Importer une manifestation FFA</DialogTitle>
              <DialogDescription className="text-sm">
                Saisissez l’identifiant FFA ou chargez la liste fédérale (<code className="text-xs">GET /import/manifestations</code>
                ). Les filtres ci-dessous sont recopiés vers l’intranet (dates <code className="text-xs">yyyy-mm-dd</code>,{" "}
                <code className="text-xs">modele_id</code>, <code className="text-xs">structure_id</code>, etc.).{" "}
                <code className="text-xs">par_page</code>, <code className="text-xs">page</code> et{" "}
                <code className="text-xs">fetch_all</code> restent gérés par l’API chrono.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
              <div className="space-y-2">
                <Label htmlFor="manifestationId">ID manifestation FFA</Label>
                <Input
                  id="manifestationId"
                  inputMode="numeric"
                  placeholder="Ex. 531 — ou clic sur une ligne ci-dessous"
                  value={manifestationId}
                  onChange={(e) => setManifestationId(e.target.value)}
                  disabled={isImporting}
                />
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Filtres intranet FFA</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="ffa-date-debut" className="text-xs">
                        date_debut
                      </Label>
                      <Input
                        id="ffa-date-debut"
                        type="date"
                        className="font-mono text-sm"
                        value={ffaDateDebut}
                        onChange={(e) => setFfaDateDebut(e.target.value)}
                        disabled={manifestListLoading || isImporting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ffa-date-fin" className="text-xs">
                        date_fin
                      </Label>
                      <Input
                        id="ffa-date-fin"
                        type="date"
                        className="font-mono text-sm"
                        value={ffaDateFin}
                        onChange={(e) => setFfaDateFin(e.target.value)}
                        disabled={manifestListLoading || isImporting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ffa-modele-id" className="text-xs">
                        modele_id
                      </Label>
                      <Input
                        id="ffa-modele-id"
                        inputMode="numeric"
                        placeholder="ex. 12"
                        className="font-mono text-sm"
                        value={ffaModeleId}
                        onChange={(e) => setFfaModeleId(e.target.value)}
                        disabled={manifestListLoading || isImporting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ffa-structure-id" className="text-xs">
                        structure_id
                      </Label>
                      <Input
                        id="ffa-structure-id"
                        inputMode="numeric"
                        placeholder="ex. 34"
                        className="font-mono text-sm"
                        value={ffaStructureId}
                        onChange={(e) => setFfaStructureId(e.target.value)}
                        disabled={manifestListLoading || isImporting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ffa-discipline-code" className="text-xs">
                        discipline_code
                      </Label>
                      <Input
                        id="ffa-discipline-code"
                        placeholder="ex. MER"
                        className="font-mono text-sm"
                        value={ffaDisciplineCode}
                        onChange={(e) => setFfaDisciplineCode(e.target.value)}
                        disabled={manifestListLoading || isImporting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ffa-tour-id" className="text-xs">
                        tour_id
                      </Label>
                      <Input
                        id="ffa-tour-id"
                        inputMode="numeric"
                        placeholder="ex. 5"
                        className="font-mono text-sm"
                        value={ffaTourId}
                        onChange={(e) => setFfaTourId(e.target.value)}
                        disabled={manifestListLoading || isImporting}
                      />
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <Label htmlFor="ffa-include" className="text-xs">
                        include
                      </Label>
                      <Input
                        id="ffa-include"
                        placeholder="Valeur attendue par l’intranet (optionnel)"
                        className="font-mono text-sm"
                        value={ffaInclude}
                        onChange={(e) => setFfaInclude(e.target.value)}
                        disabled={manifestListLoading || isImporting}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                  <div className="space-y-1">
                    <Label htmlFor="manifest-par-page" className="text-xs">
                      par_page (1–500)
                    </Label>
                    <Input
                      id="manifest-par-page"
                      type="number"
                      min={1}
                      max={500}
                      className="w-28"
                      value={manifestParPage}
                      onChange={(e) => setManifestParPage(Number(e.target.value) || 200)}
                      disabled={manifestListLoading || isImporting}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manifest-page" className="text-xs">
                      page (si tout ne charge pas)
                    </Label>
                    <Input
                      id="manifest-page"
                      type="number"
                      min={1}
                      className="w-24"
                      value={manifestPage}
                      onChange={(e) => setManifestPage(Math.max(1, Number(e.target.value) || 1))}
                      disabled={manifestListLoading || isImporting || fetchAllManifestations}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <Checkbox
                      id="manifest-fetch-all"
                      checked={fetchAllManifestations}
                      onCheckedChange={(c) => setFetchAllManifestations(c === true)}
                      disabled={manifestListLoading || isImporting}
                    />
                    <Label htmlFor="manifest-fetch-all" className="text-sm font-normal cursor-pointer">
                      Toutes les pages (<code className="text-xs">fetch_all=true</code>)
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="sm:ml-auto"
                    onClick={() => void loadManifestationsList()}
                    disabled={manifestListLoading || isImporting}
                  >
                    {manifestListLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="ml-2">Charger la liste FFA</span>
                  </Button>
                </div>

                {manifestListError ? (
                  <Alert variant="destructive">
                    <AlertDescription className="text-sm">{manifestListError}</AlertDescription>
                  </Alert>
                ) : null}

                {manifestMeta && Object.keys(manifestMeta).length > 0 ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium">Métadonnées API (meta)</summary>
                    <pre className="mt-1 max-h-24 overflow-auto rounded border bg-background p-2 text-[10px] leading-tight">
                      {JSON.stringify(manifestMeta)}
                    </pre>
                  </details>
                ) : null}

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Filtrer par titre, id, discipline, club…"
                    value={manifestListSearch}
                    onChange={(e) => setManifestListSearch(e.target.value)}
                    disabled={manifestations.length === 0 && !manifestListLoading}
                  />
                </div>

                <ScrollArea className="h-[min(50vh,320px)] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-20 font-semibold">ID</TableHead>
                        <TableHead className="min-w-[200px] font-semibold">Libellé</TableHead>
                        <TableHead className="w-24 font-semibold">Disc.</TableHead>
                        <TableHead className="min-w-[120px] font-semibold">Organisateur</TableHead>
                        <TableHead className="w-32 font-semibold text-center">Début</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manifestListLoading && manifestations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin inline mr-2 align-middle" />
                            Chargement…
                          </TableCell>
                        </TableRow>
                      ) : filteredManifestations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                            {manifestations.length === 0
                              ? "Aucune donnée — utilisez « Charger la liste FFA »."
                              : "Aucune manifestation ne correspond au filtre."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredManifestations.map((m) => {
                          const idStr = String(m.id);
                          const selected = manifestationId.trim() === idStr;
                          const d0 = m.date_debut && dayjs(m.date_debut).isValid();
                          return (
                            <TableRow
                              key={idStr}
                              className={cn(
                                "cursor-pointer",
                                selected && "bg-primary/10 hover:bg-primary/15"
                              )}
                              onClick={() => setManifestationId(idStr)}
                            >
                              <TableCell className="font-mono text-xs tabular-nums">{idStr}</TableCell>
                              <TableCell className="text-sm max-w-[280px]">
                                <div className="font-medium line-clamp-2">{manifestationDisplayTitle(m)}</div>
                                {m.type?.libelle ? (
                                  <div className="text-xs text-muted-foreground line-clamp-1">{m.type.libelle}</div>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-xs">
                                {m.details_type?.code || m.details_type?.libelle || "—"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[160px] line-clamp-2">
                                {m.structure?.nom || m.structure?.code || "—"}
                              </TableCell>
                              <TableCell className="text-center text-xs whitespace-nowrap">
                                {d0 ? dayjs(m.date_debut).format("DD/MM/YYYY") : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  {filteredManifestations.length} ligne{filteredManifestations.length > 1 ? "s" : ""} affichée
                  {manifestations.length !== filteredManifestations.length
                    ? ` (${manifestations.length} au total)`
                    : manifestations.length > 0
                      ? ` (${manifestations.length} chargée${manifestations.length > 1 ? "s" : ""})`
                      : ""}
                  . Cliquez sur une ligne pour renseigner l’ID.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setManifestationId("");
                  setManifestListSearch("");
                  setManifestListError(null);
                  setFfaDateDebut("");
                  setFfaDateFin("");
                  setFfaModeleId("");
                  setFfaStructureId("");
                  setFfaDisciplineCode("");
                  setFfaTourId("");
                  setFfaInclude("");
                }}
                disabled={isImporting}
              >
                Annuler
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handlePostManifestation("update")}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Mise à jour incrémentale
              </Button>
              <Button onClick={() => void handlePostManifestation("import")} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    En cours…
                  </>
                ) : (
                  "Importer"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barre de recherche et sélecteur de vue */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Barre de recherche */}
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, lieu ou type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Sélecteur de vue */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "card" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("card")}
                className="gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Cartes</span>
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="gap-2"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Tableau</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery
                ? "Aucun événement ne correspond à votre recherche."
                : "Aucun événement pour le moment. Importez votre premier événement pour commencer."}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg line-clamp-2">{event.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-700">Dates</div>
                    <div className="text-muted-foreground break-words">
                      {dayjs(event.start_date).format("DD MMM YYYY")} -{" "}
                      {dayjs(event.end_date).format("DD MMM YYYY")}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-700">Lieu</div>
                    <div className="text-muted-foreground line-clamp-2 break-words">
                      {event.location}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {event.race_type && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200 capitalize">
                        {event.race_type}
                      </span>
                    )}
                    {event.is_finished && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Terminé
                      </span>
                    )}
                    {event.is_visible === false && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                        Masqué
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                    <span className="font-semibold">Mode :</span>
                    <Button
                      type="button"
                      variant={raceTypeMatches(event.race_type, "rivière") ? "default" : "outline"}
                      size="sm"
                      className="h-6 px-2 gap-1 text-[11px]"
                      disabled={raceTypeSavingId === event.id}
                      onClick={() => handleChangeRaceType(event.id, "rivière")}
                    >
                      <Anchor className="w-3 h-3" />
                      Rivière
                    </Button>
                    <Button
                      type="button"
                      variant={raceTypeMatches(event.race_type, "mer") ? "default" : "outline"}
                      size="sm"
                      className="h-6 px-2 gap-1 text-[11px]"
                      disabled={raceTypeSavingId === event.id}
                      onClick={() => handleChangeRaceType(event.id, "mer")}
                    >
                      <Waves className="w-3 h-3" />
                      Mer
                    </Button>
                    <Button
                      type="button"
                      variant={raceTypeMatches(event.race_type, "indoor") ? "default" : "outline"}
                      size="sm"
                      className="h-6 px-2 gap-1 text-[11px]"
                      disabled={raceTypeSavingId === event.id}
                      onClick={() => handleChangeRaceType(event.id, "indoor")}
                    >
                      <Dumbbell className="w-3 h-3" />
                      Indoor
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1 text-sm"
                  >
                    <Link to={`/event/${event.id}`}>
                      <span className="hidden sm:inline">Voir l'événement</span>
                      <span className="sm:hidden">Voir</span>
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteClick(event);
                    }}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Lieu</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {dayjs(event.start_date).format("DD MMM YYYY")} -{" "}
                          {dayjs(event.end_date).format("DD MMM YYYY")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{event.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {event.race_type && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200 capitalize">
                            {event.race_type}
                          </span>
                        )}
                        <div className="flex items-center gap-1 flex-wrap text-[11px] text-muted-foreground mt-1">
                          <Button
                            type="button"
                            variant={raceTypeMatches(event.race_type, "rivière") ? "default" : "outline"}
                            size="sm"
                            className="h-6 px-2 gap-1 text-[11px]"
                            disabled={raceTypeSavingId === event.id}
                            onClick={() => handleChangeRaceType(event.id, "rivière")}
                          >
                            <Anchor className="w-3 h-3" />
                            Rivière
                          </Button>
                          <Button
                            type="button"
                            variant={raceTypeMatches(event.race_type, "mer") ? "default" : "outline"}
                            size="sm"
                            className="h-6 px-2 gap-1 text-[11px]"
                            disabled={raceTypeSavingId === event.id}
                            onClick={() => handleChangeRaceType(event.id, "mer")}
                          >
                            <Waves className="w-3 h-3" />
                            Mer
                          </Button>
                          <Button
                            type="button"
                            variant={raceTypeMatches(event.race_type, "indoor") ? "default" : "outline"}
                            size="sm"
                            className="h-6 px-2 gap-1 text-[11px]"
                            disabled={raceTypeSavingId === event.id}
                            onClick={() => handleChangeRaceType(event.id, "indoor")}
                          >
                            <Dumbbell className="w-3 h-3" />
                            Indoor
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        {event.is_finished && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Terminé
                          </span>
                        )}
                        {event.is_visible === false && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                            Masqué
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                        >
                          <Link to={`/event/${event.id}`}>
                            Voir
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(event)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modal de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-lg sm:text-xl">
              <AlertTriangle className="w-5 h-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="pt-4">
              <div className="space-y-3">
                <p className="font-semibold text-foreground">
                  Êtes-vous sûr de vouloir supprimer l'événement "{eventToDelete?.name}" ?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-red-800">
                    ⚠️ Cette action est irréversible et supprimera en cascade :
                  </p>
                  <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                    <li>Toutes les phases de course</li>
                    <li>Toutes les courses</li>
                    <li>Tous les équipages</li>
                    <li>Tous les participants liés aux équipages</li>
                    <li>Tous les timings</li>
                    <li>Tous les points de timing</li>
                    <li>Toutes les distances</li>
                    <li>Toutes les associations</li>
                  </ul>
                  <p className="text-xs text-red-600 mt-2">
                    Note : Les participants (Participant) ne seront pas supprimés car ils peuvent être liés à d'autres événements.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setEventToDelete(null);
              }}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression en cours...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer définitivement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

