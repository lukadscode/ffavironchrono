import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4 group">
            <div>
              <h1 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition">
                FFAviron Chronométrage
              </h1>
              <p className="text-xs text-slate-600">Système de gestion des compétitions</p>
            </div>
          </Link>
          <Button
            asChild
            variant="outline"
            className="hidden sm:flex items-center gap-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
          >
            <Link to="/admin">
              <Shield className="w-4 h-4" />
              Accès administrateur
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}


