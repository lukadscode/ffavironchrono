import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/layout/AuthLayout";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "@/api/auth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer votre adresse email ou numéro de licence.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      
      setIsSuccess(true);
      
      toast({
        title: "Email envoyé",
        description: "Si cette adresse existe dans notre système, vous recevrez un email avec les instructions de réinitialisation.",
      });
    } catch (err: any) {
      console.error("Erreur demande réinitialisation:", err);
      
      // Ne pas révéler si l'email existe ou non pour la sécurité
      // On affiche toujours un message de succès
      setIsSuccess(true);
      
      toast({
        title: "Demande envoyée",
        description: "Si cette adresse existe dans notre système, vous recevrez un email avec les instructions de réinitialisation.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout>
        <Card className="shadow-lg w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl">Email envoyé !</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Vérifiez votre boîte mail
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-3">
              <p className="text-sm sm:text-base text-muted-foreground">
                Si l'adresse <strong>{email}</strong> existe dans notre système, 
                vous avez reçu un email avec les instructions pour réinitialiser votre mot de passe.
              </p>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-left space-y-2">
                    <p className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-200">
                      📧 Vérifiez votre boîte mail
                    </p>
                    <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                      Le lien de réinitialisation est valide pendant <strong>1 heure</strong>.
                    </p>
                    <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                      Si vous ne recevez pas l'email, vérifiez vos spams ou demandez un nouveau lien.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                asChild
                variant="outline"
                className="w-full sm:flex-1"
              >
                <Link to="/admin/login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour à la connexion
                </Link>
              </Button>
              <Button
                onClick={() => {
                  setIsSuccess(false);
                  setEmail("");
                }}
                className="w-full sm:flex-1"
              >
                Envoyer un autre email
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
          <CardTitle className="text-xl sm:text-2xl text-center">Mot de passe oublié ?</CardTitle>
          <CardDescription className="text-sm sm:text-base text-center">
            Entrez votre adresse email ou numéro de licence. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email ou numéro de licence</Label>
              <Input
                id="email"
                type="text"
                placeholder="votre@email.com ou numéro de licence"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
                autoFocus
              />
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                <strong>🔒 Sécurité :</strong> Pour protéger votre compte, nous ne révélerons pas si cette adresse existe dans notre système. 
                Si elle existe, vous recevrez un email avec un lien valide pendant 1 heure.
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
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Envoyer le lien de réinitialisation
                </>
              )}
            </Button>

            <div className="text-center">
              <Button
                asChild
                variant="link"
                className="text-sm"
              >
                <Link to="/admin/login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour à la connexion
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

