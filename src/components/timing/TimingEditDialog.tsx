import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";
import { formatTimestamp } from "@/utils/formatTime";
import { useToast } from "@/hooks/use-toast";

type Timing = {
  id: string;
  timestamp: string;
  status: string;
};

type Props = {
  timing: Timing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
  isLocked?: boolean;
};

export function TimingEditDialog({
  timing,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  isLocked,
}: Props) {
  const { toast } = useToast();
  const [timestamp, setTimestamp] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && timing) {
      const d = new Date(timing.timestamp);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 23);
      setTimestamp(local);
      setConfirmDelete(false);
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!timing) return;
    setLoading(true);
    try {
      const iso = new Date(timestamp).toISOString();
      await api.put(`/timings/${timing.id}`, { timestamp: iso });
      toast({ title: "Temps corrigé" });
      onUpdated();
      onOpenChange(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast({
        title: status === 423 ? "Course verrouillée" : "Erreur",
        description: "Impossible de modifier ce temps",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!timing) return;
    setLoading(true);
    try {
      await api.delete(`/timings/${timing.id}`);
      toast({ title: "Temps supprimé" });
      onDeleted();
      onOpenChange(false);
    } catch {
      toast({ title: "Erreur suppression", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!timing) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l'impulsion</DialogTitle>
          <DialogDescription>
            Timestamp actuel : {formatTimestamp(timing.timestamp)}
            {isLocked && " — Course officielle (lecture seule)"}
          </DialogDescription>
        </DialogHeader>

        {!isLocked && (
          <>
            <div className="space-y-2 py-2">
              <Label htmlFor="ts">Nouveau timestamp</Label>
              <Input
                id="ts"
                type="datetime-local"
                step="0.001"
                value={timestamp.slice(0, 19)}
                onChange={(e) => setTimestamp(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              {!confirmDelete ? (
                <>
                  <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                    Supprimer
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    Enregistrer
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-destructive mr-auto">Confirmer la suppression ?</p>
                  <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                    Non
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                    Oui, supprimer
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
