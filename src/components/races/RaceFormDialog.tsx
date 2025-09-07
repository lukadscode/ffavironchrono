import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/axios";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RaceFormDialogProps {
  phaseId: string;
  eventId: string;
  onSuccess: () => void;
}

interface Distance {
  id: string;
  label: string;
  meters: number;
}

export default function RaceFormDialog({ phaseId, eventId, onSuccess }: RaceFormDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [distances, setDistances] = useState<Distance[]>([]);
  const [form, setForm] = useState({
    name: "",
    race_type: "course en ligne",
    lane_count: 6,
    race_number: 1,
    distance_id: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    const fetchDistances = async () => {
      const res = await api.get(`/distances/event/${eventId}`);
      setDistances(res.data.data);
    };
    fetchDistances();
  }, [eventId]);

  const handleSubmit = async () => {
    try {
      await api.post("/races", {
        phase_id: phaseId,
        ...form,
      });
      setForm({ name: "", race_type: "course en ligne", lane_count: 6, race_number: 1, distance_id: "" });
      setDialogOpen(false);
      onSuccess();
      toast({ title: "Course créée avec succès." });
    } catch (err) {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle course</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select
              value={form.race_type}
              onValueChange={(val) => setForm({ ...form, race_type: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="course en ligne">Course en ligne</SelectItem>
                <SelectItem value="contre la montre">Contre la montre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Distance</Label>
            <Select
              value={form.distance_id}
              onValueChange={(val) => setForm({ ...form, distance_id: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Distance" />
              </SelectTrigger>
              <SelectContent>
                {distances.map((dist) => (
                  <SelectItem key={dist.id} value={dist.id}>
                    {dist.label} ({dist.meters} m)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Couloirs</Label>
              <Input
                type="number"
                value={form.lane_count}
                onChange={(e) => setForm({ ...form, lane_count: parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="flex-1">
              <Label>Numéro</Label>
              <Input
                type="number"
                value={form.race_number}
                onChange={(e) => setForm({ ...form, race_number: parseInt(e.target.value, 10) })}
              />
            </div>
          </div>
          <Button onClick={handleSubmit}>Créer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
