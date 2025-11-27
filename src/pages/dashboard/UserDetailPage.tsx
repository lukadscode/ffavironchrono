import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  User,
  Calendar,
  MapPin,
} from "lucide-react";
import dayjs from "dayjs";

type UserDetail = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "superadmin";
  status?: "active" | "inactive";
  num_license?: string;
  avatar?: string;
  slug?: string;
  created_at?: string;
};

type UserEvent = {
  id: string;
  user_id: string;
  event_id: string;
  role: "viewer" | "editor" | "referee" | "timing" | "organiser";
  Event: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    location: string;
    race_type?: string;
  };
};

type Event = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  race_type?: string;
};

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [userEvents, setUserEvents] = useState<UserEvent[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Dialog pour ajouter un événement
  const [addEventDialogOpen, setAddEventDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedEventRole, setSelectedEventRole] = useState("viewer");
  const [isAdding, setIsAdding] = useState(false);

  // Dialog pour supprimer un événement
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<UserEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // États pour modifier le rôle
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set());

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    if (userId) {
      fetchUserDetail();
      fetchUserEvents();
      fetchAllEvents();
    }
  }, [userId, isAdmin, navigate]);

  const fetchUserDetail = async () => {
    if (!userId) return;

    try {
      const res = await api.get(`/users/${userId}`);
      setUser(res.data.data || res.data);
    } catch (err: any) {
      console.error("Erreur chargement utilisateur", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de charger les informations de l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserEvents = async () => {
    if (!userId) return;

    setLoadingEvents(true);
    try {
      // Récupérer tous les user-events et filtrer par user_id
      // On récupère tous les événements pour avoir les détails complets
      const [userEventsRes, eventsRes] = await Promise.all([
        api.get("/user-events").catch(() => ({ data: { data: [] } })),
        api.get("/events").catch(() => ({ data: { data: [] } })),
      ]);

      const allUserEvents = userEventsRes.data.data || [];
      const allEventsData = eventsRes.data.data || [];

      // Filtrer les user-events pour cet utilisateur
      const filtered = allUserEvents.filter(
        (ue: any) => ue.user_id === userId || ue.User?.id === userId
      );

      // Enrichir avec les détails des événements
      const enriched = filtered.map((ue: any) => {
        const eventData = allEventsData.find((e: any) => e.id === ue.event_id);
        return {
          ...ue,
          Event: eventData
            ? {
                id: eventData.id,
                name: eventData.name,
                start_date: eventData.start_date,
                end_date: eventData.end_date,
                location: eventData.location,
                race_type: eventData.race_type,
              }
            : ue.Event || {
                id: ue.event_id,
                name: "Événement introuvable",
                start_date: "",
                end_date: "",
                location: "",
              },
        };
      });

      setUserEvents(enriched);
    } catch (err: any) {
      console.error("Erreur chargement événements utilisateur", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de charger les événements de l'utilisateur",
        variant: "destructive",
      });
      setUserEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchAllEvents = async () => {
    try {
      const res = await api.get("/events");
      setAllEvents(res.data.data || []);
    } catch (err: any) {
      console.error("Erreur chargement événements", err);
    }
  };

  const handleAddEvent = async () => {
    if (!selectedEventId || !userId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un événement",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      // Récupérer l'email de l'utilisateur
      const userEmail = user?.email;
      if (!userEmail) {
        throw new Error("Email utilisateur introuvable");
      }

      await api.post("/user-events", {
        email: userEmail,
        event_id: selectedEventId,
        role: selectedEventRole,
      });

      toast({
        title: "Succès",
        description: "Événement ajouté avec succès",
      });

      setAddEventDialogOpen(false);
      setSelectedEventId("");
      setSelectedEventRole("viewer");

      // Recharger les événements
      await fetchUserEvents();
    } catch (err: any) {
      console.error("Erreur ajout événement", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible d'ajouter l'événement",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteClick = (userEvent: UserEvent) => {
    setEventToDelete(userEvent);
    setDeleteDialogOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    setIsDeleting(true);
    try {
      await api.delete(`/user-events/${eventToDelete.id}`);

      toast({
        title: "Succès",
        description: `L'utilisateur a été retiré de l'événement "${eventToDelete.Event.name}".`,
      });

      setDeleteDialogOpen(false);
      setEventToDelete(null);

      // Recharger les événements
      await fetchUserEvents();
    } catch (err: any) {
      console.error("Erreur suppression événement", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de retirer l'événement",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEventRoleChange = async (userEventId: string, newRole: string) => {
    setUpdatingRoles((prev) => new Set(prev).add(userEventId));

    try {
      // Mettre à jour le rôle via PATCH /user-events/{id}
      await api.patch(`/user-events/${userEventId}`, { role: newRole });

      setUserEvents((prev) =>
        prev.map((ue) =>
          ue.id === userEventId ? { ...ue, role: newRole as UserEvent["role"] } : ue
        )
      );

      toast({
        title: "Succès",
        description: "Rôle mis à jour avec succès",
      });
    } catch (err: any) {
      console.error("Erreur mise à jour rôle", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de mettre à jour le rôle",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoles((prev) => {
        const next = new Set(prev);
        next.delete(userEventId);
        return next;
      });
    }
  };

  // Obtenir le label du rôle dans l'événement
  const getEventRoleLabel = (role: string) => {
    switch (role) {
      case "organiser":
        return "Organisateur";
      case "editor":
        return "Éditeur";
      case "referee":
        return "Arbitre";
      case "timing":
        return "Chronométreur";
      case "viewer":
        return "Visualiseur";
      default:
        return role;
    }
  };

  // Obtenir les événements disponibles (non déjà associés)
  const availableEvents = allEvents.filter(
    (event) => !userEvents.some((ue) => ue.event_id === event.id)
  );

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/users-management")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Utilisateur introuvable</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/users-management")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-1 sm:mb-2 flex items-center gap-2">
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
              {user.name}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Informations utilisateur */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <strong>Email :</strong> {user.email}
            </div>
            <div>
              <strong>Rôle principal :</strong>{" "}
              <span className="capitalize">{user.role}</span>
            </div>
            <div>
              <strong>Statut :</strong>{" "}
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium border ${
                  user.status === "active"
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-orange-100 text-orange-700 border-orange-200"
                }`}
              >
                {user.status === "active" ? "Actif" : "Inactif"}
              </span>
            </div>
            {user.num_license && (
              <div>
                <strong>Numéro de licence :</strong> {user.num_license}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Événements associés */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg sm:text-xl">Événements associés ({userEvents.length})</CardTitle>
            <Dialog open={addEventDialogOpen} onOpenChange={setAddEventDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Ajouter un événement</span>
                  <span className="sm:hidden">Ajouter</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">Ajouter un événement</DialogTitle>
                  <DialogDescription className="text-sm">
                    Associer cet utilisateur à un événement avec un rôle spécifique.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="event">Événement *</Label>
                    <Select
                      value={selectedEventId}
                      onValueChange={setSelectedEventId}
                      disabled={isAdding}
                    >
                      <SelectTrigger id="event">
                        <SelectValue placeholder="Sélectionnez un événement" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEvents.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            Aucun événement disponible
                          </div>
                        ) : (
                          availableEvents.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              {event.name} - {dayjs(event.start_date).format("DD/MM/YYYY")}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventRole">Rôle dans l'événement *</Label>
                    <Select
                      value={selectedEventRole}
                      onValueChange={setSelectedEventRole}
                      disabled={isAdding}
                    >
                      <SelectTrigger id="eventRole">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Visualiseur</SelectItem>
                        <SelectItem value="editor">Éditeur</SelectItem>
                        <SelectItem value="referee">Arbitre</SelectItem>
                        <SelectItem value="organiser">Organisateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddEventDialogOpen(false);
                      setSelectedEventId("");
                      setSelectedEventRole("viewer");
                    }}
                    disabled={isAdding}
                  >
                    Annuler
                  </Button>
                  <Button onClick={handleAddEvent} disabled={isAdding || !selectedEventId}>
                    {isAdding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ajout...
                      </>
                    ) : (
                      "Ajouter"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingEvents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : userEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun événement associé
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Événement</TableHead>
                    <TableHead className="min-w-[140px] hidden md:table-cell">Dates</TableHead>
                    <TableHead className="min-w-[120px] hidden lg:table-cell">Lieu</TableHead>
                    <TableHead className="min-w-[130px]">Rôle</TableHead>
                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userEvents.map((userEvent) => (
                    <TableRow key={userEvent.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/event/${userEvent.event_id}`}
                          className="text-primary hover:underline"
                        >
                          {userEvent.Event.name}
                        </Link>
                        <div className="text-xs md:hidden text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {dayjs(userEvent.Event.start_date).format("DD/MM/YYYY")} -{" "}
                            {dayjs(userEvent.Event.end_date).format("DD/MM/YYYY")}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {userEvent.Event.location}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {dayjs(userEvent.Event.start_date).format("DD/MM/YYYY")} -{" "}
                          {dayjs(userEvent.Event.end_date).format("DD/MM/YYYY")}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {userEvent.Event.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={userEvent.role}
                          onValueChange={(newRole) =>
                            handleEventRoleChange(userEvent.id, newRole)
                          }
                          disabled={updatingRoles.has(userEvent.id)}
                        >
                          <SelectTrigger className="w-full sm:w-[150px]">
                            {updatingRoles.has(userEvent.id) ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Mise à jour...</span>
                              </div>
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Visualiseur</SelectItem>
                            <SelectItem value="editor">Éditeur</SelectItem>
                            <SelectItem value="referee">Arbitre</SelectItem>
                            <SelectItem value="timing">Chronométreur</SelectItem>
                            <SelectItem value="organiser">Organisateur</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(userEvent)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-lg sm:text-xl">
              <AlertTriangle className="w-5 h-5" />
              Retirer l'événement
            </DialogTitle>
            <DialogDescription className="pt-4">
              <p className="font-semibold text-foreground mb-2">
                Êtes-vous sûr de vouloir retirer l'utilisateur de l'événement "
                {eventToDelete?.Event.name}" ?
              </p>
              <p className="text-sm text-muted-foreground">
                L'utilisateur perdra tous ses droits d'accès à cet événement.
              </p>
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
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Retirer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

