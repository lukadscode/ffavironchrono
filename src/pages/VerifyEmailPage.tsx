import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/layout/AuthLayout";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import api from "@/lib/axios";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de vérification manquant. Veuillez utiliser le lien reçu par email.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        
        setStatus("success");
        setMessage(
          res.data?.message || 
          "Votre adresse email a été vérifiée avec succès ! Vous pouvez maintenant vous connecter."
        );
        
        toast({
          title: "Email vérifié",
          description: "Votre compte a été activé avec succès.",
        });

        // Rediriger vers la page de connexion après 3 secondes
        setTimeout(() => {
          navigate("/admin/login");
        }, 3000);
      } catch (err: any) {
        console.error("Erreur vérification email:", err);
        
        setStatus("error");
        const errorMessage =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Le lien de vérification est invalide ou a expiré. Veuillez demander un nouveau lien.";
        
        setMessage(errorMessage);
        
        toast({
          title: "Erreur de vérification",
          description: errorMessage,
          variant: "destructive",
        });
      }
    };

    verifyEmail();
  }, [searchParams, navigate, toast]);

  return (
    <AuthLayout>
      <Card className="shadow-lg w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === "loading" && (
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            )}
            {status === "error" && (
              <XCircle className="w-12 h-12 text-red-600" />
            )}
          </div>
          <CardTitle className="text-xl sm:text-2xl">
            {status === "loading" && "Vérification en cours..."}
            {status === "success" && "Email vérifié !"}
            {status === "error" && "Erreur de vérification"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            {status === "loading" && (
              <p className="text-sm sm:text-base text-muted-foreground">
                Veuillez patienter pendant la vérification de votre email...
              </p>
            )}
            {status === "success" && (
              <>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  {message}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Redirection vers la page de connexion dans quelques secondes...
                </p>
              </>
            )}
            {status === "error" && (
              <>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  {message}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Si vous avez besoin d'un nouveau lien de vérification, veuillez contacter l'administrateur.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {status === "success" && (
              <Button
                onClick={() => navigate("/admin/login")}
                className="w-full sm:w-auto sm:mx-auto"
              >
                Se connecter maintenant
              </Button>
            )}
            {status === "error" && (
              <>
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
                  <Link to="/register">Créer un compte</Link>
                </Button>
              </>
            )}
          </div>

          {status === "success" && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs sm:text-sm text-green-800 dark:text-green-200">
                  Votre compte est maintenant actif. Vous pouvez vous connecter avec votre email et votre mot de passe.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

