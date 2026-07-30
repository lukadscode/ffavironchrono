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
import { Textarea } from "@/components/ui/textarea";
import { updateRaceCrewAdjustment } from "@/api/races";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raceCrewId: string;
  clubName: string;
  rawTimeMs: number | null;
  currentAdjustmentMs: number;
  currentReason: string | null;
  onSaved: () => void;
};

export function AdjustmentDialog({
  open,
  onOpenChange,
  raceCrewId,
  clubName,
  rawTimeMs,
  currentAdjustmentMs,
  currentReason,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [seconds, setSeconds] = useState(String(currentAdjustmentMs / 1000));
  const [reason, setReason] = useState(currentReason || "");
  const [loading, setLoading] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setSeconds(String(currentAdjustmentMs / 1000));
      setReason(currentReason || "");
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    const adjustmentMs = Math.round(parseFloat(seconds.replace(",", ".")) * 1000);
    if (isNaN(adjustmentMs)) {
      toast({ title: "Valeur invalide", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await updateRaceCrewAdjustment(raceCrewId, adjustmentMs, reason || undefined);
      toast({ title: "Ajustement enregistré" });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer l'ajustement", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const previewMs =
    rawTimeMs !== null
      ? rawTimeMs + Math.round(parseFloat(seconds.replace(",", ".")) * 1000 || 0)
      : null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pénalité / bonification</DialogTitle>
          <DialogDescription>
            {clubName} — valeur positive = pénalité (temps augmenté), négative = bonification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="adjustment">Ajustement (secondes)</Label>
            <Input
              id="adjustment"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 5 pour +5s, -2 pour -2s"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Motif</Label>
            <Textarea
              id="reason"
              placeholder="Ex: franchissement de ligne, comportement antisportif…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          {previewMs !== null && !isNaN(previewMs) && (
            <p className="text-sm text-muted-foreground">
              Temps final estimé :{" "}
              <span className="font-mono font-medium text-foreground">
                {(previewMs / 1000).toFixed(3)}s
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
