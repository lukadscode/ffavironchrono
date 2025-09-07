import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface PhaseFormDialogProps {
  onSubmit: (name: string, order: number) => void;
}

export default function PhaseFormDialog({ onSubmit }: PhaseFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [order, setOrder] = useState(1);

  const handleCreate = () => {
    onSubmit(name, order);
    setName("");
    setOrder(1);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Ajouter une phase</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle phase</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Ordre</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value, 10))} />
          </div>
          <Button onClick={handleCreate}>Créer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
