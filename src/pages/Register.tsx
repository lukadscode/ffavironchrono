import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { register } from "@/api/auth";
import { useNavigate } from "react-router-dom";
import AuthLayout from "@/components/layout/AuthLayout";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    num_license: "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation basique
    if (!form.name || !form.email || !form.password) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    if (form.password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await register(form);
      
      // Gérer le cas où l'utilisateur existait déjà et était inactif (retour 200)
      // Le backend retourne un message spécifique dans ce cas
      const isUpdate = response?.message?.includes("mis à jour") || 
                       response?.message?.includes("vérifier votre email");
      
      if (isUpdate) {
        toast({
          title: "Compte mis à jour",
          description: response.message || "Votre compte a été mis à jour. Veuillez vérifier votre email pour l'activer.",
        });
      } else {
        toast({
          title: "Inscription réussie",
          description: "Un email de vérification a été envoyé. Veuillez vérifier votre boîte mail pour activer votre compte.",
        });
      }
      
      navigate("/admin/login");
    } catch (err: any) {
      console.error("Erreur inscription:", err);
      
      // Cas spécial : erreur 500 "authentification failed" mais les données sont modifiées en BDD
      // Cela indique que l'opération a réussi mais qu'il y a eu un problème (probablement l'envoi d'email)
      if (err?.response?.status === 500) {
        const errorMsg = err?.response?.data?.message || err?.response?.data?.error || "";
        const hasData = err?.response?.data?.data || err?.response?.data?.id;
        
        // Si le message contient "authentification failed" ou similaire, mais que les données sont modifiées
        // OU si la réponse contient des données malgré l'erreur (succès partiel)
        if (hasData || 
            errorMsg.toLowerCase().includes("authentification") || 
            errorMsg.toLowerCase().includes("failed") ||
            errorMsg.toLowerCase().includes("email")) {
          toast({
            title: "Inscription partiellement réussie",
            description: "Votre compte a été créé/mis à jour, mais il y a eu un problème lors de l'envoi de l'email de vérification. Vous pouvez essayer de vous connecter ou contacter l'administrateur pour activer votre compte.",
            variant: "default",
          });
          // On redirige quand même vers la page de connexion
          navigate("/admin/login");
          return;
        }
      }
      
      // Gérer les erreurs spécifiques
      let errorMessage = "Vérifiez les champs ou essayez plus tard.";
      
      if (err?.response?.status === 400) {
        const backendMessage = err?.response?.data?.message || err?.response?.data?.error;
        if (backendMessage?.toLowerCase().includes("déjà utilisé") || 
            backendMessage?.toLowerCase().includes("already")) {
          errorMessage = "Cet email ou numéro de licence est déjà utilisé par un compte actif.";
        } else {
          errorMessage = backendMessage || "Données invalides. Vérifiez les informations saisies.";
        }
      } else if (err?.response?.status === 500) {
        errorMessage = err?.response?.data?.message || 
                      err?.response?.data?.error || 
                      "Une erreur serveur est survenue. Si votre compte a été créé, vous pouvez essayer de vous connecter.";
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      toast({
        title: "Erreur à l'inscription",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <AuthLayout>
      <Card className="shadow-lg w-full max-w-sm mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Créer un compte</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="jean@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label htmlFor="num_license">Licence (optionnelle)</Label>
              <Input
                id="num_license"
                name="num_license"
                value={form.num_license}
                onChange={handleChange}
                placeholder="123456789"
              />
            </div>
            <Button type="submit" className="w-full">
              Créer le compte
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-4">
            Vous avez déjà un compte ?{" "}
            <a href="/admin/login" className="underline hover:text-primary">
              Se connecter
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
