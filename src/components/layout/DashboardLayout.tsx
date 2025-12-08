import { Outlet, NavLink } from "react-router-dom";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Menu, LogOut, Home, Calendar, User, Settings, Trophy, Users, Tag, Building2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils"; // utile pour combiner les classes conditionnelles

export default function DashboardLayout() {
  const { logout, user } = useAuth();

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperAdmin = user?.role === "superadmin";

  const navLinks = [
    { to: "/dashboard", label: "Accueil", icon: Home },
    { to: "/dashboard/profile", label: "Profil", icon: User },
    // Afficher le lien de gestion des événements seulement pour les admins
    ...(isAdmin
      ? [{ to: "/dashboard/events-management", label: "Gestion événements", icon: Settings }]
      : []),
    // Afficher le lien de gestion des catégories seulement pour les admins
    ...(isAdmin
      ? [{ to: "/dashboard/categories-management", label: "Gestion catégories", icon: Tag }]
      : []),
    // Afficher le lien de gestion des clubs seulement pour les admins
    ...(isAdmin
      ? [{ to: "/dashboard/clubs-management", label: "Gestion clubs", icon: Building2 }]
      : []),
    // Afficher le lien des classements des clubs seulement pour les admins
    ...(isAdmin
      ? [{ to: "/dashboard/club-rankings", label: "Classements clubs", icon: Trophy }]
      : []),
    // Afficher le lien des statistiques seulement pour les admins
    ...(isAdmin
      ? [{ to: "/dashboard/event-statistics", label: "Statistiques", icon: BarChart3 }]
      : []),
    // Afficher le lien de gestion des templates de scoring seulement pour les superadmins
    ...(isSuperAdmin
      ? [{ to: "/dashboard/scoring-templates", label: "Templates de scoring", icon: Trophy }]
      : []),
    // Afficher le lien de gestion des utilisateurs seulement pour les superadmins
    ...(isSuperAdmin
      ? [{ to: "/dashboard/users-management", label: "Gestion utilisateurs", icon: Users }]
      : []),
  ];

  const NavItem = ({ to, label, icon: Icon }: { to: string; label: string; icon: any }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base",
          isActive 
            ? "bg-muted font-semibold text-foreground" 
            : "text-foreground hover:bg-muted"
        )
      }
    >
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col w-64 border-r bg-muted/30 p-4 space-y-4">
        <h1 className="text-lg sm:text-xl font-bold pl-2 text-primary">FFAVIRON - TIMING</h1>
        <nav className="flex flex-col gap-1">
          {navLinks.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </nav>
        <Button
          onClick={logout}
          variant="ghost"
          className="mt-auto flex items-center gap-2 text-red-600 hover:text-red-700 text-sm"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </Button>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-3 sm:p-4 border-b bg-muted/40 sticky top-0 z-40">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-80 p-0">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <h1 className="text-lg sm:text-xl font-bold text-primary">FFAVIRON - TIMING</h1>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {navLinks.map((link) => (
                  <NavItem key={link.to} {...link} />
                ))}
              </nav>
              <div className="p-4 border-t">
                <Button
                  onClick={logout}
                  variant="ghost"
                  className="w-full flex items-center gap-2 text-red-600 hover:text-red-700 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <span className="text-base sm:text-lg font-semibold text-primary truncate flex-1 ml-2">Tableau de bord</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 bg-slate-100 dark:bg-background">
        <Outlet />
      </main>
    </div>
  );
}
