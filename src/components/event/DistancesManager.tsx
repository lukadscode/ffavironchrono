import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PlusIcon } from "lucide-react";

type Distance = {
  id: string;
  event_id: string;
  meters: number;
};

export default function DistancesPage() {
  const { eventId } = useParams();
  const { toast } = useToast();
  const [distances, setDistances] = useState<Distance[]>([]);
  const [newMeters, setNewMeters] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchDistances = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/distances/event/${eventId}`);
      setDistances(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les distances.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const meters = parseInt(newMeters, 10);
      if (isNaN(meters) || !eventId) return;

      await api.post("/distances", {
        event_id: eventId,
        meters,
      });

      toast({ title: "Distance ajoutée avec succès." });
      setNewMeters("");
      setDialogOpen(false);
      fetchDistances();
    } catch (err) {
      toast({
        title: "Erreur à l'ajout",
        description: "Impossible d'ajouter la distance.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/distances/${id}`);
      toast({ title: "Distance supprimée." });
      fetchDistances();
    } catch (err) {
      toast({
        title: "Erreur suppression",
        description: "Impossible de supprimer la distance.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (eventId) fetchDistances();
  }, [eventId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distances de l’événement</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Chargement...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {distances.map((distance) => (
              <Card key={distance.id} className="text-center p-4 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold mb-2">
                  {distance.meters}
                </div>
                <div className="text-sm text-muted-foreground mb-2">mètres</div>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(distance.id)}>
                  Supprimer
                </Button>
              </Card>
            ))}

            {/* Carte pour ajout avec modale */}
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
                  <DialogTitle>Ajouter une distance</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label htmlFor="new-distance">Distance (en mètres)</Label>
                    <Input
                      id="new-distance"
                      type="number"
                      placeholder="Ex: 1000"
                      value={newMeters}
                      onChange={(e) => setNewMeters(e.target.value)}
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
