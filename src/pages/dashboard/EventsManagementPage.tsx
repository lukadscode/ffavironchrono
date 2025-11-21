import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Plus, Loader2, Trash2, AlertTriangle } from "lucide-react";
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

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Gestion des événements</h2>
          <p className="text-muted-foreground">
            Gérez tous les événements de la plateforme
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Importer un événement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importer un événement</DialogTitle>
              <DialogDescription>
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun événement pour le moment. Importez votre premier événement pour commencer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg line-clamp-2">{event.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="flex items-start gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-700">Dates</div>
                    <div className="text-muted-foreground">
                      {dayjs(event.start_date).format("DD MMM YYYY")} -{" "}
                      {dayjs(event.end_date).format("DD MMM YYYY")}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-700">Lieu</div>
                    <div className="text-muted-foreground line-clamp-2">
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

                <div className="flex gap-2 mt-4">
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1"
                  >
                    <Link to={`/event/${event.id}`}>Voir l'événement</Link>
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
      )}

      {/* Modal de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
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

