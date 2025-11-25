import { Outlet, NavLink } from "react-router-dom";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Menu, LogOut, Home, Calendar, User, Settings, Trophy } from "lucide-react";
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
    // Afficher le lien de gestion des templates de scoring seulement pour les superadmins
    ...(isSuperAdmin
      ? [{ to: "/dashboard/scoring-templates", label: "Templates de scoring", icon: Trophy }]
      : []),
  ];

  const NavItem = ({ to, label, icon: Icon }: { to: string; label: string; icon: any }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors",
          isActive 
            ? "bg-muted font-semibold text-foreground" 
            : "text-foreground hover:bg-muted"
        )
      }
    >
      <Icon className="w-5 h-5" />
      {label}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col w-64 border-r bg-muted/30 p-4 space-y-4">
        <h1 className="text-xl font-bold pl-2 text-primary">Acme Inc.</h1>
        <nav className="flex flex-col gap-1">
          {navLinks.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </nav>
        <Button
          onClick={logout}
          variant="ghost"
          className="mt-auto flex items-center gap-2 text-red-600 hover:text-red-700"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </Button>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-muted/40">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <h1 className="text-xl font-bold mb-4">Acme Inc.</h1>
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <NavItem key={link.to} {...link} />
              ))}
              <Button
                onClick={logout}
                variant="ghost"
                className="flex items-center gap-2 text-red-600 hover:text-red-700 mt-4"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
        <span className="text-lg font-semibold text-primary">Tableau de bord</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-slate-100 dark:bg-background">
        <Outlet />
      </main>
    </div>
  );
}
