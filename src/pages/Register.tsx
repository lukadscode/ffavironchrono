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
    try {
      await register(form);
      toast({
        title: "Inscription réussie",
        description: "Vous pouvez maintenant vous connecter.",
      });
      navigate("/login");
    } catch {
      toast({
        title: "Erreur à l'inscription",
        description: "Vérifiez les champs ou essayez plus tard.",
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
            <a href="/login" className="underline hover:text-primary">
              Se connecter
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
