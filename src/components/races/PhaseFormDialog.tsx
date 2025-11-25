import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

interface PhaseFormDialogProps {
  onSubmit: (name: string, order: number) => void;
  phase?: {
    id: string;
    name: string;
    order_index: number;
  } | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function PhaseFormDialog({ 
  onSubmit, 
  phase = null,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: PhaseFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const [order, setOrder] = useState(1);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange || (() => {}) : setInternalOpen;

  useEffect(() => {
    if (phase) {
      setName(phase.name);
      setOrder(phase.order_index);
    } else {
      setName("");
      setOrder(1);
    }
  }, [phase, open]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), order);
    if (!phase) {
      setName("");
      setOrder(1);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !isControlled && (
        <DialogTrigger asChild>
          <Button>Ajouter une phase</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{phase ? "Modifier la phase" : "Nouvelle phase"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom *</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Phase 1"
            />
          </div>
          <div>
            <Label>Ordre</Label>
            <Input 
              type="number" 
              value={order} 
              onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
              min={1}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              {phase ? "Modifier" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
