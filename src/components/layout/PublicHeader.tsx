import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 sm:gap-4 group min-w-0 flex-1">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                FFAviron Chronométrage
              </h1>
              <p className="text-xs text-slate-600 hidden sm:block">Système de gestion des compétitions</p>
            </div>
          </Link>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:flex items-center gap-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-sm flex-shrink-0"
          >
            <Link to="/admin">
              <Shield className="w-4 h-4" />
              <span className="hidden md:inline">Accès administrateur</span>
              <span className="md:hidden">Admin</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}


