import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full border-border">
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-6xl font-bold text-primary/20">404</p>
          <h1 className="text-xl font-semibold text-foreground">Page introuvable</h1>
          <p className="text-sm text-muted-foreground">
            La page demandée n'existe pas ou a été déplacée.
          </p>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
