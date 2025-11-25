import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { login } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "@/components/layout/AuthLayout";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login: loginContext, user } = useAuth();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [hasTriggeredLogin, setHasTriggeredLogin] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tokens = await login(identifier, password);
      await loginContext(tokens);
      setHasTriggeredLogin(true);
      toast({
        title: "Connexion réussie",
        description: "Bienvenue 👋",
      });
    } catch (err) {
      toast({
        title: "Erreur de connexion",
        description: "Email/licence ou mot de passe invalide.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (hasTriggeredLogin && user) {
      navigate("/dashboard");
    }
  }, [user, hasTriggeredLogin, navigate]);

  return (
    <AuthLayout>
      <Card className="shadow-lg w-full max-w-sm mx-auto">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl text-center">Connexion</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="identifier">Email ou licence</Label>
              <Input
                id="identifier"
                placeholder="Email ou licence"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs sm:text-sm text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Se connecter
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-4">
            Pas encore de compte ?{" "}
            <a href="/register" className="underline hover:text-primary">
              S'inscrire
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

