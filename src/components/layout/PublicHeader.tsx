import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Globe2, MoreHorizontal, Shield, User } from "lucide-react";

const MAIN_NAV_ITEMS = ["Item 1", "Item 2", "Item 3"];
const SUB_NAV_ITEMS = ["Item 2", "Item 3", "Item 4", "Item 5", "Item 6"];

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 text-white">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-3 pb-2 space-y-3">
        {/* Barre principale */}
        <div className="flex items-center justify-between gap-4">
          {/* Logo gauche */}
          <Link
            to="/"
            className="flex items-center gap-3 shrink-0 group"
          >
            <div className="h-9 w-auto flex items-center">
              <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-400/60 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-emerald-300">
                FFA
              </span>
            </div>
          </Link>

          {/* Menu centré */}
          <nav className="hidden md:flex items-center justify-center flex-1 gap-6 text-xs font-medium tracking-[0.18em] uppercase">
            {MAIN_NAV_ITEMS.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`relative pb-1 transition-colors ${
                  index === 0
                    ? "text-emerald-300"
                    : "text-slate-200/80 hover:text-white"
                }`}
              >
                {item}
                {index === 0 && (
                  <span className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </nav>

          {/* Icônes droite */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-400/20 hover:text-emerald-50 transition-colors"
              aria-label="Changer de langue"
            >
              <Globe2 className="w-4 h-4" />
            </button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex h-8 items-center gap-2 rounded-full border-slate-700 bg-slate-900/80 text-[11px] font-medium text-slate-100 hover:bg-slate-800 hover:border-emerald-400/70 px-3"
            >
              <Link to="/admin">
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>
            </Button>

            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/70 hover:text-emerald-100 transition-colors"
              aria-label="Profil"
            >
              <User className="w-4 h-4" />
            </button>

            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/70 hover:text-emerald-100 transition-colors"
              aria-label="Menu"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sous-navigation en bas du hero comme sur la maquette */}
        <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.18em]">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-slate-950 font-semibold">
            ■
          </span>

          <nav className="flex flex-wrap items-center gap-4 text-slate-300">
            {SUB_NAV_ITEMS.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`relative pb-0.5 transition-colors ${
                  index === 0
                    ? "text-emerald-300"
                    : "hover:text-white"
                }`}
              >
                {item}
                {index === 0 && (
                  <span className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
