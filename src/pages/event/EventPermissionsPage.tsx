import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusIcon } from "lucide-react";

type UserEvent = {
  id: string;
  role: string;
  User: {
    name: string;
    email: string;
  };
};

export default function EventPermissionsPage() {
  const { eventId } = useParams();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("organiser");

  const fetchPermissions = async () => {
    try {
      const res = await api.get(`/user-events/event/${eventId}`);
      setPermissions(res.data.data ?? []);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les accès.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!email || !role) return;

    try {
      await api.post("/user-events", { email, role, event_id: eventId });
      toast({ title: "Accès ajouté avec succès." });
      setEmail("");
      setRole("organiser");
      setDialogOpen(false);
      fetchPermissions();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter cet accès.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/user-events/${id}`);
      toast({ title: "Accès supprimé." });
      setPermissions((prev) => prev.filter((perm) => perm.id !== id));
    } catch {
      toast({
        title: "Erreur",
        description: "Échec de suppression.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [eventId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaboration</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Chargement...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {permissions.map((perm) => (
              <Card key={perm.id} className="items-center text-center p-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-gray-200 mb-2" />
                <div className="font-medium">{perm.User.name}</div>
                <div className="text-sm text-muted-foreground">{perm.role}</div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(perm.id)}
                  className="mt-2"
                >
                  Supprimer
                </Button>
              </Card>
            ))}

            {/* Add user card triggers dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Card className="flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:bg-gray-100">
                  <div className="mx-auto w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                    <PlusIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="font-medium text-muted-foreground">Ajouter</div>
                </Card>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un accès</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ex: user@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Rôle</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Sélectionnez un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organiser">Organisateur</SelectItem>
                        <SelectItem value="viewer">Spectateur</SelectItem>
                        <SelectItem value="editor">Éditeur</SelectItem>
                      </SelectContent>
                    </Select>
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
