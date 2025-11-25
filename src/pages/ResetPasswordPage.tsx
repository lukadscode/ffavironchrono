import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/layout/AuthLayout";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, Lock } from "lucide-react";
import api from "@/lib/axios";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setStatus("error");
      setErrorMessage("Token de réinitialisation manquant. Veuillez utiliser le lien reçu par email.");
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!password || !confirmPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      setStatus("error");
      setErrorMessage("Token invalide.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post("/auth/reset-password", {
        token,
        password,
      });

      setStatus("success");
      
      toast({
        title: "Mot de passe réinitialisé",
        description: "Votre mot de passe a été modifié avec succès.",
      });

      // Rediriger vers la page de connexion après 3 secondes
      setTimeout(() => {
        navigate("/admin/login");
      }, 3000);
    } catch (err: any) {
      console.error("Erreur réinitialisation mot de passe:", err);
      
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Le lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.";
      
      setStatus("error");
      setErrorMessage(errorMsg);
      
      toast({
        title: "Erreur",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "success") {
    return (
      <AuthLayout>
        <Card className="shadow-lg w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <CardTitle className="text-xl sm:text-2xl">Mot de passe réinitialisé !</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Votre mot de passe a été modifié avec succès.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm sm:text-base text-muted-foreground text-center">
              Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Redirection vers la page de connexion dans quelques secondes...
            </p>
            <Button
              onClick={() => navigate("/admin/login")}
              className="w-full"
            >
              Se connecter maintenant
            </Button>
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs sm:text-sm text-green-800 dark:text-green-200">
                  Pour votre sécurité, pensez à utiliser un mot de passe fort et unique.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  if (status === "error") {
    return (
      <AuthLayout>
        <Card className="shadow-lg w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
            <CardTitle className="text-xl sm:text-2xl">Erreur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm sm:text-base text-muted-foreground text-center">
              {errorMessage}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Le lien de réinitialisation est valide pendant 1 heure. Si vous avez besoin d'un nouveau lien, veuillez demander une nouvelle réinitialisation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                asChild
                variant="outline"
                className="w-full sm:flex-1"
              >
                <Link to="/admin/login">Retour à la connexion</Link>
              </Button>
              <Button
                asChild
                className="w-full sm:flex-1"
              >
                <Link to="/forgot-password">Demander un nouveau lien</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="shadow-lg w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl text-center">Réinitialiser le mot de passe</CardTitle>
          <CardDescription className="text-sm sm:text-base text-center">
            Entrez votre nouveau mot de passe ci-dessous.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="pr-10"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Répétez le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="pr-10"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                <strong>🔒 Sécurité :</strong> Votre mot de passe doit contenir au moins 6 caractères. 
                Le lien de réinitialisation est valide pendant 1 heure.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Réinitialisation en cours...
                </>
              ) : (
                "Réinitialiser le mot de passe"
              )}
            </Button>

            <div className="text-center">
              <Button
                asChild
                variant="link"
                className="text-sm"
              >
                <Link to="/admin/login">Retour à la connexion</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

