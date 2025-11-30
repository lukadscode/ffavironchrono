import { useEffect, useState, useMemo } from "react";
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
import { Calendar, MapPin, Plus, Loader2, Trash2, AlertTriangle, Search, LayoutGrid, List } from "lucide-react";
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

export default function EventsManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manifestationId, setManifestationId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [searchQuery, setSearchQuery] = useState("");

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Filtrer les événements selon la recherche
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

  const handleImportEvent = async () => {
    if (!manifestationId.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un ID de manifestation",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const res = await api.post(`/import/manifestation/${manifestationId.trim()}`);
      
      toast({
        title: "Succès",
        description: `Événement "${res.data.data.name}" importé avec succès !`,
      });

      // Réinitialiser le formulaire
      setManifestationId("");
      setDialogOpen(false);

      // Recharger la liste des événements
      await fetchAllEvents();
    } catch (err: any) {
      console.error("Erreur import événement", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Impossible d'importer l'événement";
      
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Importer un événement</span>
              <span className="sm:hidden">Importer</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Importer un événement</DialogTitle>
              <DialogDescription className="text-sm">
                Saisissez l'ID de la manifestation à importer depuis le système externe.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="manifestationId">ID de la manifestation</Label>
                <Input
                  id="manifestationId"
                  type="number"
                  placeholder="Ex: 531"
                  value={manifestationId}
                  onChange={(e) => setManifestationId(e.target.value)}
                  disabled={isImporting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setManifestationId("");
                }}
                disabled={isImporting}
              >
                Annuler
              </Button>
              <Button onClick={handleImportEvent} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Import en cours...
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

                <div className="flex items-center gap-2 pt-2">
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
                      {event.race_type && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200 capitalize">
                          {event.race_type}
                        </span>
                      )}
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

