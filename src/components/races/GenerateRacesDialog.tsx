import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  eventId: string;
  phases: { id: string; name: string }[];
  onSuccess: () => void;
}

export default function GenerateRacesDialog({ eventId, phases, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [phaseId, setPhaseId] = useState<string>();
  const [laneCount, setLaneCount] = useState<number>(6);
  const [startTime, setStartTime] = useState<string>(""); // datetime-local
  const [intervalMinutes, setIntervalMinutes] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!phaseId || !laneCount) return;

    try {
      setLoading(true);

      await api.post("/races/generate", {
        phase_id: phaseId,
        lane_count: laneCount,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        interval_minutes: intervalMinutes,
      });

      toast({ title: "Séries générées avec succès." });
      onSuccess();
      setOpen(false);
    } catch {
      toast({ title: "Erreur lors de la génération", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Générer une série</Button>
      </DialogTrigger>
      <DialogContent className="space-y-4">
        <div className="space-y-2">
          <Label>Phase</Label>
          <Select onValueChange={(v) => setPhaseId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Nombre de lignes d’eau</Label>
          <Select onValueChange={(v) => setLaneCount(Number(v))} defaultValue="6">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...Array(16)].map((_, i) => {
                const n = i + 1;
                return (
                  <SelectItem key={n} value={`${n}`}>
                    {n}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Heure de départ de la première course</Label>
          <Input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Minutes entre chaque course</Label>
          <Input
            type="number"
            min={0}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
          />
        </div>

        <Button onClick={handleGenerate} disabled={loading || !phaseId}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Génération...
            </>
          ) : (
            "Générer"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
