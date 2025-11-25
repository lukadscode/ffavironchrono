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
  const [name, setName] = useState("");
  const [role, setRole] = useState("organiser");
  const [isAdding, setIsAdding] = useState(false);

  const fetchPermissions = async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/user-events/event/${eventId}`);
      setPermissions(res.data.data ?? []);
    } catch (error: any) {
      console.error("Erreur lors du chargement des accès:", error);
      
      const errorMessage = 
        error?.response?.data?.message || 
        error?.response?.data?.error ||
        error?.message ||
        "Impossible de charger les accès.";
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };


  const handleAdd = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !role) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une adresse email valide.",
        variant: "destructive",
      });
      return;
    }

    if (!eventId) {
      toast({
        title: "Erreur",
        description: "ID d'événement manquant.",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);

    try {
      // Le backend gère maintenant automatiquement la création d'utilisateur
      const payload: any = { 
        email: trimmedEmail, 
        role, 
        event_id: eventId 
      };
      
      // Ajouter le nom si fourni (optionnel, le backend l'extraira de l'email sinon)
      if (name.trim()) {
        payload.name = name.trim();
      }
      
      const response = await api.post("/user-events", payload);
      const responseData = response.data?.data || response.data;
      
      // Vérifier si un utilisateur a été créé
      const userCreated = responseData?.user_created || false;
      const temporaryPassword = responseData?.temporary_password;
      
      let successMessage = "Accès ajouté avec succès.";
      
      if (userCreated && temporaryPassword) {
        successMessage = `Utilisateur créé et accès ajouté. Un email avec le mot de passe provisoire a été envoyé à ${trimmedEmail}.`;
      } else if (userCreated) {
        successMessage = `Utilisateur créé et accès ajouté. Un email avec les instructions a été envoyé à ${trimmedEmail}.`;
      }
      
      toast({ 
        title: "Succès",
        description: successMessage
      });
      
      setEmail("");
      setName("");
      setRole("organiser");
      setDialogOpen(false);
      await fetchPermissions();
    } catch (error: any) {
      console.error("❌ Erreur lors de l'ajout d'un accès:", error);
      
      let errorMessage = "Impossible d'ajouter cet accès.";
      
      if (error?.response?.status === 409) {
        errorMessage = "Cet utilisateur a déjà accès à cet événement.";
      } else if (error?.response?.status === 400) {
        const badRequestMsg = error?.response?.data?.message || error?.response?.data?.error || "";
        if (badRequestMsg.toLowerCase().includes("déjà") || badRequestMsg.toLowerCase().includes("already")) {
          errorMessage = "Cet utilisateur a déjà accès à cet événement.";
        } else {
          errorMessage = badRequestMsg || "Données invalides. Vérifiez les informations saisies.";
        }
      } else if (error?.response?.status === 403) {
        errorMessage = "Vous n'avez pas la permission d'ajouter des accès à cet événement.";
      } else if (error?.response?.status === 404) {
        errorMessage = "L'événement ou l'utilisateur n'a pas été trouvé.";
      } else if (error?.response?.status === 500) {
        const serverMessage = error?.response?.data?.message || 
                             error?.response?.data?.error ||
                             "Erreur serveur. Veuillez contacter l'administrateur.";
        errorMessage = `Erreur serveur: ${serverMessage}`;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/user-events/${id}`);
      toast({ 
        title: "Succès",
        description: "Accès supprimé." 
      });
      setPermissions((prev) => prev.filter((perm) => perm.id !== id));
    } catch (error: any) {
      console.error("Erreur lors de la suppression d'un accès:", error);
      
      const errorMessage = 
        error?.response?.data?.message || 
        error?.response?.data?.error ||
        error?.message ||
        "Échec de suppression.";
      
      toast({
        title: "Erreur",
        description: errorMessage,
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
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ex: user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Nom</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Optionnel - sera extrait de l'email si vide"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Si vide, le nom sera automatiquement extrait de l'adresse email
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="role">Rôle *</Label>
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
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setDialogOpen(false);
                        setEmail("");
                        setName("");
                        setRole("organiser");
                      }}
                      disabled={isAdding}
                    >
                      Annuler
                    </Button>
                    <Button onClick={handleAdd} disabled={isAdding}>
                      {isAdding ? "Ajout en cours..." : "Ajouter"}
                    </Button>
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

