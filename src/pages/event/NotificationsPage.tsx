import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Calendar,
  Clock,
} from "lucide-react";
import dayjs from "dayjs";
import type { Notification } from "@/components/notifications/NotificationDisplay";

interface Race {
  id: string;
  name: string;
  race_number: number;
}

export default function NotificationsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);

  const [form, setForm] = useState({
    race_id: "__none__",
    message: "",
    importance: "info" as "info" | "warning" | "error" | "success",
    is_active: true,
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (eventId) {
      fetchNotifications();
      fetchRaces();
    }
  }, [eventId]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/notifications?event_id=${eventId}`);
      setNotifications(res.data.data || []);
    } catch (err: any) {
      console.error("Erreur chargement notifications:", err);
      const errorMessage = err?.response?.data?.message || err?.message || "Erreur inconnue";
      const statusCode = err?.response?.status;
      
      if (statusCode === 404 || statusCode === 500) {
        // Endpoint peut-être pas encore implémenté côté backend
        console.warn("Endpoint /notifications peut-être non disponible côté backend");
        setNotifications([]); // Continuer avec une liste vide
        toast({
          title: "Endpoint non disponible",
          description: "L'endpoint de notifications n'est peut-être pas encore implémenté côté backend. Affichage d'une liste vide.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: `Impossible de charger les notifications: ${errorMessage}`,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRaces = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      setRaces(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement courses:", err);
    }
  };

  const handleCreate = async () => {
    if (!form.message.trim()) {
      toast({
        title: "Erreur",
        description: "Le message est requis",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload: any = {
        event_id: eventId,
        message: form.message.trim(),
        importance: form.importance,
        is_active: form.is_active,
      };

      if (form.race_id && form.race_id !== "__none__") {
        payload.race_id = form.race_id;
      }

      if (form.start_date) {
        payload.start_date = new Date(form.start_date).toISOString();
      }

      if (form.end_date) {
        payload.end_date = new Date(form.end_date).toISOString();
      }

      if (editingNotification) {
        await api.put(`/notifications/${editingNotification.id}`, payload);
        toast({ title: "Notification modifiée avec succès" });
      } else {
        await api.post("/notifications", payload);
        toast({ title: "Notification créée avec succès" });
      }

      setDialogOpen(false);
      resetForm();
      fetchNotifications();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (notification: Notification) => {
    setEditingNotification(notification);
    setForm({
      race_id: notification.race_id || "__none__",
      message: notification.message,
      importance: notification.importance,
      is_active: notification.is_active,
      start_date: notification.start_date
        ? dayjs(notification.start_date).format("YYYY-MM-DDTHH:mm")
        : "",
      end_date: notification.end_date
        ? dayjs(notification.end_date).format("YYYY-MM-DDTHH:mm")
        : "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette notification ?")) {
      return;
    }

    try {
      await api.delete(`/notifications/${id}`);
      toast({ title: "Notification supprimée" });
      fetchNotifications();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de supprimer la notification",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setForm({
      race_id: "__none__",
      message: "",
      importance: "info",
      is_active: true,
      start_date: "",
      end_date: "",
    });
    setEditingNotification(null);
  };

  const getImportanceIcon = (importance: string) => {
    switch (importance) {
      case "error":
        return <XCircle className="w-4 h-4" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "error":
        return "bg-red-100 text-red-800 border-red-300";
      case "warning":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "success":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/event/${eventId}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Bell className="w-8 h-8" />
              Gestion des notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              Créez et gérez les notifications pour cet événement
            </p>
          </div>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle notification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingNotification ? "Modifier la notification" : "Nouvelle notification"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Course (optionnel)</Label>
                <Select
                  value={form.race_id || "__none__"}
                  onValueChange={(value) => setForm({ ...form, race_id: value === "__none__" ? "__none__" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les courses (notification générale)" />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Toutes les courses (notification générale)</SelectItem>
                      {races.map((race) => (
                        <SelectItem key={race.id} value={race.id}>
                          Course {race.race_number} - {race.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Sélectionner "Toutes les courses" pour une notification générale à tout l'événement
                </p>
              </div>

              <div className="space-y-2">
                <Label>Message *</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Entrez le message de la notification..."
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {form.message.length}/1000 caractères
                </p>
              </div>

              <div className="space-y-2">
                <Label>Importance</Label>
                <Select
                  value={form.importance}
                  onValueChange={(value: any) => setForm({ ...form, importance: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Information (bleu)</SelectItem>
                    <SelectItem value="success">Succès (vert)</SelectItem>
                    <SelectItem value="warning">Avertissement (orange)</SelectItem>
                    <SelectItem value="error">Erreur (rouge)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Notification active
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Date de début (optionnel)</Label>
                <Input
                  type="datetime-local"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Si vide, la notification est immédiate
                </p>
              </div>

              <div className="space-y-2">
                <Label>Date de fin (optionnel)</Label>
                <Input
                  type="datetime-local"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Si vide, la notification n'expire pas
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={handleCreate}>
                  {editingNotification ? "Modifier" : "Créer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications ({notifications.length})</CardTitle>
          <CardDescription>
            Les notifications actives sont affichées en temps réel sur les pages publiques
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Chargement des notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">Aucune notification créée</p>
              <p className="text-xs text-muted-foreground">
                Les notifications seront affichées ici une fois créées
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Importance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>
                      {notification.race_id ? (
                        <Badge variant="outline">Course</Badge>
                      ) : (
                        <Badge variant="outline">Événement</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate">{notification.message}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getImportanceColor(notification.importance)}>
                        <span className="mr-1">{getImportanceIcon(notification.importance)}</span>
                        {notification.importance}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {notification.is_active ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        {notification.start_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {dayjs(notification.start_date).format("DD/MM/YYYY HH:mm")}
                          </div>
                        )}
                        {notification.end_date && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dayjs(notification.end_date).format("DD/MM/YYYY HH:mm")}
                          </div>
                        )}
                        {!notification.start_date && !notification.end_date && (
                          <span className="text-muted-foreground">Immédiate / Sans expiration</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(notification)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(notification.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

