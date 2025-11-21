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
import { register } from "@/api/auth";

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

  const generateRandomPassword = (): string => {
    // Génère un mot de passe aléatoire sécurisé de 16 caractères
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const createUserIfNotExists = async (email: string): Promise<boolean> => {
    try {
      // Générer un nom à partir de l'email (partie avant @)
      const nameFromEmail = email.split("@")[0];
      const name = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
      
      // Générer un mot de passe aléatoire
      const randomPassword = generateRandomPassword();
      
      // Préparer les données selon le format attendu par l'API
      const registerData = {
        name: name || "Utilisateur",
        email: email.trim(),
        password: randomPassword,
        num_license: "", // Champ optionnel, vide par défaut
      };
      
      // Vérifier que tous les champs obligatoires sont présents
      if (!registerData.email || !registerData.name || !registerData.password) {
        console.error("❌ Données manquantes:", {
          hasEmail: !!registerData.email,
          hasName: !!registerData.name,
          hasPassword: !!registerData.password,
        });
        return false;
      }

      // Vérifier que le mot de passe est valide
      if (registerData.password.length < 8) {
        console.error("❌ Mot de passe trop court:", registerData.password.length);
        return false;
      }

      console.log("👤 Création automatique de l'utilisateur avec:", {
        email: registerData.email,
        name: registerData.name,
        passwordLength: registerData.password.length,
        num_license: registerData.num_license || "(vide)",
      });
      
      console.log("📤 Envoi de la requête POST /auth/register avec le format exact:", {
        name: registerData.name,
        email: registerData.email,
        num_license: registerData.num_license,
        password: "***" + registerData.password.substring(registerData.password.length - 3),
        passwordLength: registerData.password.length,
      });
      
      console.log("🔍 Objet complet à envoyer (sans mot de passe complet):", {
        name: registerData.name,
        email: registerData.email,
        num_license: registerData.num_license,
        password: "[MASQUÉ]",
      });
      
      const result = await register(registerData);
      
      console.log("✅ Utilisateur créé automatiquement:", result);
      return true;
    } catch (error: any) {
      console.error("❌ Erreur lors de la création automatique de l'utilisateur:", error);
      console.error("📋 Détails complets de l'erreur:", {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message,
      });
      
      // Si l'utilisateur existe déjà, c'est OK
      if (error?.response?.status === 409 || 
          error?.response?.data?.message?.includes("already exists") ||
          error?.response?.data?.error?.includes("already exists")) {
        console.log("ℹ️ L'utilisateur existe déjà");
        return true;
      }
      
      return false;
    }
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
      const payload = { 
        email: trimmedEmail, 
        role, 
        event_id: eventId 
      };
      
      console.log("📤 Envoi de la requête POST /user-events avec:", payload);
      
      const response = await api.post("/user-events", payload);
      
      console.log("✅ Réponse de l'API:", response.data);
      
      toast({ 
        title: "Succès",
        description: "Accès ajouté avec succès." 
      });
      setEmail("");
      setRole("organiser");
      setDialogOpen(false);
      await fetchPermissions();
    } catch (error: any) {
      console.error("❌ Erreur lors de l'ajout d'un accès:", error);
      console.error("📋 Détails complets de l'erreur:", {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message,
        config: {
          url: error?.config?.url,
          method: error?.config?.method,
          data: error?.config?.data,
        },
      });
      
      // Messages d'erreur plus spécifiques selon le code de statut
      let errorMessage = "Impossible d'ajouter cet accès.";
      
      if (error?.response?.status === 500) {
        // Erreur serveur - vérifier si c'est parce que l'utilisateur n'existe pas
        const responseData = error?.response?.data || {};
        const serverMessage = responseData.message || 
                             responseData.error ||
                             responseData.detail ||
                             "";
        
        // Vérifier si l'erreur indique que l'utilisateur n'existe pas
        const isUserNotFoundError = 
          (serverMessage.includes("user_id") && serverMessage.includes("undefined")) ||
          serverMessage.includes("User not found") ||
          serverMessage.includes("does not exist") ||
          serverMessage.includes("WHERE parameter") ||
          responseData.message?.includes("user_id");
        
        if (isUserNotFoundError) {
          console.log("👤 L'utilisateur n'existe pas, création automatique...");
          
          // Créer l'utilisateur automatiquement
          const userCreated = await createUserIfNotExists(trimmedEmail);
          
          if (userCreated) {
            // Réessayer de créer la relation user-event
            try {
              console.log("🔄 Nouvelle tentative de création de la relation user-event...");
              const retryPayload = { 
                email: trimmedEmail, 
                role, 
                event_id: eventId 
              };
              
              const retryResponse = await api.post("/user-events", retryPayload);
              console.log("✅ Relation user-event créée avec succès:", retryResponse.data);
              
              toast({ 
                title: "Succès",
                description: "Utilisateur créé et accès ajouté avec succès. Un mot de passe aléatoire a été généré." 
              });
              
              setEmail("");
              setRole("organiser");
              setDialogOpen(false);
              await fetchPermissions();
              return; // Sortir de la fonction car on a réussi
            } catch (retryError: any) {
              console.error("❌ Erreur lors de la nouvelle tentative:", retryError);
              errorMessage = "L'utilisateur a été créé mais l'accès n'a pas pu être ajouté. Veuillez réessayer.";
            }
          } else {
            errorMessage = "Impossible de créer l'utilisateur automatiquement. Veuillez contacter l'administrateur.";
          }
        } else {
          // Autre type d'erreur 500
          errorMessage = `Erreur serveur (500): ${serverMessage || "Erreur serveur. Veuillez contacter l'administrateur."}`;
          
          console.error("🔴 Erreur serveur (500):", {
            message: serverMessage,
            fullData: responseData,
            status: error?.response?.status,
            statusText: error?.response?.statusText,
          });
          
          // Si le message est trop long, le tronquer pour l'affichage
          if (errorMessage.length > 200) {
            errorMessage = `Erreur serveur (500): ${serverMessage.substring(0, 200)}... (voir la console pour plus de détails)`;
          }
        }
      } else if (error?.response?.status === 404) {
        errorMessage = "L'utilisateur avec cet email n'existe pas. Veuillez vérifier l'adresse email.";
      } else if (error?.response?.status === 409) {
        errorMessage = "Cet utilisateur a déjà accès à cet événement.";
      } else if (error?.response?.status === 400) {
        errorMessage = error?.response?.data?.message || "Données invalides. Vérifiez les informations saisies.";
      } else if (error?.response?.status === 403) {
        errorMessage = "Vous n'avez pas la permission d'ajouter des accès à cet événement.";
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
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setDialogOpen(false);
                        setEmail("");
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
