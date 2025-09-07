import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlusIcon, ClipboardCopy, CheckIcon } from "lucide-react";

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
  const { toast } = useToast();
  const [timingPoints, setTimingPoints] = useState<TimingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    } catch {
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
    if (!eventId || !newLabel || !newOrder || !newDistance) return;
    try {
      const res = await api.post("/timing-points", {
        event_id: eventId,
        label: newLabel,
        order_index: parseInt(newOrder, 10),
        distance_m: parseInt(newDistance, 10),
      });
      setTimingPoints((prev) => [...prev, res.data.data]);
      setNewLabel("");
      setNewOrder("");
      setNewDistance("");
      setDialogOpen(false);
      toast({ title: "Point ajouté." });
    } catch {
      toast({
        title: "Erreur à l’ajout",
        description: "Vérifie les données saisies.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/timing-points/${id}`);
      setTimingPoints((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Point supprimé." });
    } catch {
      toast({
        title: "Erreur de suppression",
        variant: "destructive",
      });
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

    for (const point of updatedPoints) {
      await api.put(`/timing-points/${point.id}`, {
        order_index: point.order_index,
      });
    }

    toast({ title: "Ordre mis à jour." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Points de chronométrage</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Chargement...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={timingPoints.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {timingPoints.map((point) => (
                  <SortableCard key={point.id} point={point} onDelete={handleDelete} />
                ))}
              </SortableContext>
            </DndContext>

            {/* Carte ajout */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Card className="flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:bg-gray-100">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                    <PlusIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="font-medium text-muted-foreground">Ajouter</div>
                </Card>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un point</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label htmlFor="label">Nom</Label>
                    <Input
                      id="label"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Départ, Arrivée, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="order">Ordre</Label>
                    <Input
                      id="order"
                      type="number"
                      value={newOrder}
                      onChange={(e) => setNewOrder(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="distance">Distance (m)</Label>
                    <Input
                      id="distance"
                      type="number"
                      value={newDistance}
                      onChange={(e) => setNewDistance(e.target.value)}
                      placeholder="1000"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleAdd}>Ajouter</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// SortableCard avec badge token cliquable et sécurisé (sans drag)
function SortableCard({
  point,
  onDelete,
}: {
  point: TimingPoint;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: point.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // ← important pour bloquer le drag
    try {
      await navigator.clipboard.writeText(point.token);
      setCopied(true);
      toast({ title: "Token copié", description: point.token });
      setTimeout(() => setCopied(false), 1500);
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
      {...attributes}
      {...listeners}
      className="text-center p-4 flex flex-col items-center gap-3 cursor-grab"
    >
      {/* Badge token cliquable avec feedback ✔️ */}
      <div
        onClick={handleCopy}
        className="flex items-center gap-2 bg-sky-200 text-blue-900 text-sm font-bold px-2 py-1 rounded cursor-pointer hover:bg-sky-300 transition"
      >
        {copied ? (
          <>
            Copié <CheckIcon className="w-4 h-4" />
          </>
        ) : (
          <>
            {point.token}
            <ClipboardCopy className="w-4 h-4" />
          </>
        )}
      </div>

      {/* Badges distance et ordre */}
      <div className="flex gap-2 flex-wrap justify-center">
        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
          {point.distance_m} meter
        </span>
        <span className="bg-gray-300 text-gray-800 text-xs font-semibold px-2 py-1 rounded">
          Ordre {point.order_index}
        </span>
      </div>

      {/* Label */}
      <div className="font-medium text-sm">{point.label}</div>

      <Button variant="destructive" size="sm" onClick={() => onDelete(point.id)}>
        Supprimer
      </Button>
    </Card>
  );
}
