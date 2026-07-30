import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Plus,
  ClipboardCopy,
  Check,
  Timer,
  MapPin,
  Hash,
  GripVertical,
  Trash2,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AdminPage } from "@/components/layout/AdminPage";
import { StatCard } from "@/components/layout/StatCard";

type TimingPoint = {
  id: string;
  event_id: string;
  label: string;
  order_index: number;
  distance_m: number;
  token: string;
};

export default function TimingPointsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timingPoints, setTimingPoints] = useState<TimingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pointToDelete, setPointToDelete] = useState<TimingPoint | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [newDistance, setNewDistance] = useState("");

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    fetchPoints();
  }, [eventId]);

  const fetchPoints = async () => {
    try {
      const res = await api.get(`/timing-points/event/${eventId}`);
      const sorted = res.data.data.sort(
        (a: TimingPoint, b: TimingPoint) => a.order_index - b.order_index
      );
      setTimingPoints(sorted);
    } catch (err: any) {
      console.error("Erreur chargement points:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les points de chronométrage.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!eventId || !newLabel || !newOrder || !newDistance) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post("/timing-points", {
        event_id: eventId,
        label: newLabel,
        order_index: parseInt(newOrder, 10),
        distance_m: parseInt(newDistance, 10),
      });
      setTimingPoints((prev) => {
        const updated = [...prev, res.data.data];
        return updated.sort((a, b) => a.order_index - b.order_index);
      });
      setNewLabel("");
      setNewOrder("");
      setNewDistance("");
      setDialogOpen(false);
      toast({
        title: "Succès",
        description: "Point de chronométrage ajouté avec succès",
      });
    } catch (err: any) {
      console.error("Erreur ajout point:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Erreur lors de l'ajout du point";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (point: TimingPoint) => {
    setPointToDelete(point);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!pointToDelete) return;

    setIsDeleting(true);
    try {
      await api.delete(`/timing-points/${pointToDelete.id}`);
      setTimingPoints((prev) => prev.filter((p) => p.id !== pointToDelete.id));
      setDeleteDialogOpen(false);
      setPointToDelete(null);
      toast({
        title: "Succès",
        description: "Point de chronométrage supprimé",
      });
    } catch (err: any) {
      console.error("Erreur suppression:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Erreur lors de la suppression";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = timingPoints.findIndex((p) => p.id === active.id);
    const newIndex = timingPoints.findIndex((p) => p.id === over.id);

    const newOrder = arrayMove(timingPoints, oldIndex, newIndex);
    const updatedPoints = newOrder.map((point, idx) => ({
      ...point,
      order_index: idx + 1,
    }));

    setTimingPoints(updatedPoints);

    try {
      await Promise.all(
        updatedPoints.map((point) =>
          api.put(`/timing-points/${point.id}`, {
            order_index: point.order_index,
          })
        )
      );
      toast({
        title: "Succès",
        description: "Ordre des points mis à jour",
      });
    } catch (err: any) {
      console.error("Erreur mise à jour ordre:", err);
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour de l'ordre",
        variant: "destructive",
      });
      // Recharger les points en cas d'erreur
      fetchPoints();
    }
  };

  const totalDistance = timingPoints.reduce((sum, p) => sum + p.distance_m, 0);
  const isStartPoint = (point: TimingPoint) => point.order_index === 1;
  const isFinishPoint = (point: TimingPoint) =>
    point.order_index === timingPoints.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des points de timing...</p>
        </div>
      </div>
    );
  }

  const addPointDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un point
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un point de chronométrage</DialogTitle>
          <DialogDescription>
            Créez un nouveau point de timing pour cet événement
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="label">Nom du point *</Label>
            <Input
              id="label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ex: Départ, 500m, Arrivée"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order">Ordre *</Label>
            <Input
              id="order"
              type="number"
              min="1"
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="distance">Distance (mètres) *</Label>
            <Input
              id="distance"
              type="number"
              min="0"
              value={newDistance}
              onChange={(e) => setNewDistance(e.target.value)}
              placeholder="1000"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setDialogOpen(false);
              setNewLabel("");
              setNewOrder("");
              setNewDistance("");
            }}
            disabled={isSaving}
          >
            Annuler
          </Button>
          <Button onClick={handleAdd} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ajout...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <AdminPage
      title="Points de chronométrage"
      description="Configurez les points de passage pour le chronométrage de l'événement"
      icon={Timer}
      actions={timingPoints.length > 0 ? addPointDialog : undefined}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total points" value={timingPoints.length} icon={Hash} />
        <StatCard label="Distance totale" value={`${totalDistance}m`} icon={MapPin} />
        <StatCard
          label="Distance finale"
          value={
            timingPoints.length > 0
              ? `${timingPoints[timingPoints.length - 1].distance_m}m`
              : "0m"
          }
          icon={Timer}
        />
      </div>

      {/* Liste des points */}
      {timingPoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Timer className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-semibold text-muted-foreground mb-2">
              Aucun point de chronométrage
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Ajoutez votre premier point pour commencer
            </p>
            {addPointDialog}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Glissez-déposez les cartes pour réorganiser l'ordre
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={timingPoints.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {timingPoints.map((point) => (
                  <SortableCard
                    key={point.id}
                    point={point}
                    onDelete={handleDeleteClick}
                    isStart={isStartPoint(point)}
                    isFinish={isFinishPoint(point)}
                    navigate={navigate}
                    eventId={eventId || ""}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
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
                  Êtes-vous sûr de vouloir supprimer le point{" "}
                  <span className="text-red-600">"{pointToDelete?.label}"</span> ?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    ⚠️ Cette action est irréversible. Tous les timings associés à ce point seront également supprimés.
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
                setPointToDelete(null);
              }}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
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
                  Supprimer définitivement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

function SortableCard({
  point,
  onDelete,
  isStart,
  isFinish,
  navigate,
  eventId,
}: {
  point: TimingPoint;
  onDelete: (point: TimingPoint) => void;
  isStart: boolean;
  isFinish: boolean;
  navigate: any;
  eventId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: point.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(point.token);
      setCopied(true);
      toast({
        title: "Token copié",
        description: `Token "${point.token}" copié dans le presse-papiers`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de copier le token",
        variant: "destructive",
      });
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`relative overflow-hidden transition-all duration-200 ${
        isDragging
          ? "shadow-2xl scale-105 border-orange-500"
          : "hover:shadow-lg border-2 hover:border-orange-400"
      } ${isStart ? "ring-2 ring-green-500/30" : ""} ${isFinish ? "ring-2 ring-red-500/30" : ""}`}
    >
      {/* Handle de drag */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-orange-600 transition-colors z-10"
      >
        <GripVertical className="w-5 h-5" />
      </div>

      <CardContent className="p-5">
        {/* Badges spéciaux */}
        <div className="flex items-center justify-between mb-4">
          {isStart && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
              🏁 DÉPART
            </span>
          )}
          {isFinish && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300">
              🏁 ARRIVÉE
            </span>
          )}
          {!isStart && !isFinish && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
              Point intermédiaire
            </span>
          )}
        </div>

        {/* Label principal */}
        <h3 className="text-xl font-bold mb-4 text-center">{point.label}</h3>

        {/* Token cliquable */}
        <div
          onClick={handleCopy}
          className={`flex items-center justify-center gap-2 p-3 rounded-lg mb-4 cursor-pointer transition-all ${
            copied
              ? "bg-green-100 text-green-700 border-2 border-green-300"
              : "bg-orange-100 text-orange-700 border-2 border-orange-300 hover:bg-orange-200"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5" />
              <span className="font-mono font-bold">Copié !</span>
            </>
          ) : (
            <>
              <Hash className="w-5 h-5" />
              <span className="font-mono font-bold text-lg">{point.token}</span>
              <ClipboardCopy className="w-4 h-4" />
            </>
          )}
        </div>

        {/* Informations */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Distance</span>
            </div>
            <span className="font-bold text-lg">{point.distance_m}m</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Ordre</span>
            </div>
            <span className="font-bold text-lg">#{point.order_index}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/event/${eventId}/timing/${point.id}`)}
          >
            <Timer className="w-4 h-4 mr-2" />
            Chronométrer
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(point);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
