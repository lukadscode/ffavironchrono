import { useEffect, useState, useMemo } from "react";
import { Outlet, useParams, NavLink } from "react-router-dom";
import clsx from "clsx";
import { useEventRole } from "@/hooks/useEventRole";
import { ROLE_PERMISSIONS } from "@/router/EventProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  Home,
  Users,
  Flag,
  Timer,
  Shield,
  Rows,
  MapPin,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Gavel,
  Activity,
  Bell,
  FileDown,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import api from "@/lib/axios";
import { Menu } from "lucide-react";

const logout = () => {
  localStorage.clear();
  window.location.href = "/";
};

const allNavItems = [
  { to: "", label: "Accueil", icon: Home, permission: "overview" },
  { to: "permissions", label: "Droits", icon: Shield, permission: "permissions" },
  { to: "participants", label: "Participants", icon: Users, permission: "participants" },
  { to: "crews", label: "Équipages", icon: Rows, permission: "crews" },
  { to: "distances", label: "Distances", icon: MapPin, permission: "distances" },
  { to: "races", label: "Courses", icon: Flag, permission: "races" },
  { to: "racePhases", label: "Phases", icon: Flag, permission: "racePhases" },
  { to: "notifications", label: "Notifications", icon: Bell, permission: "notifications" },
  { to: "timingPoint", label: "Points", icon: Timer, permission: "timingPoint" },
  { to: "timing", label: "Chrono", icon: Timer, permission: "timing" },
  { to: "arbitres", label: "Arbitres", icon: Gavel, permission: "arbitres" },
  { to: "indoor", label: "Indoor", icon: Activity, permission: "indoor" },
  { to: "export", label: "Exports", icon: FileDown, permission: "overview" },
];

export default function EventAdminLayout() {
  const { eventId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const eventRole = useEventRole();

  const [eventName, setEventName] = useState<string>("");

  // Vérifier si l'utilisateur est admin global
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Filtrer les éléments de navigation selon les permissions
  const navItems = useMemo(() => {
    // Les admins globaux voient tout
    if (isGlobalAdmin) return allNavItems;
    
    if (!eventRole) return allNavItems.filter(item => item.permission === "overview");
    
    // L'organisateur voit tout
    if (eventRole === "organiser") return allNavItems;
    
    // Pour les autres rôles, filtrer selon les permissions
    const permissions = ROLE_PERMISSIONS[eventRole] || [];
    return allNavItems.filter(item => permissions.includes(item.permission));
  }, [eventRole, isGlobalAdmin]);

  useEffect(() => {
    if (!eventId) return;
    api
      .get(`/events/${eventId}`)
      .then((res) => {
        setEventName(res.data.data.name || `Événement ${eventId}`);
      })
      .catch(() => {
        setEventName(`Événement ${eventId}`);
      });
  }, [eventId]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* SIDEBAR */}
      <aside
        className={clsx(
          "border-r bg-muted/40 transition-all duration-300 flex flex-col hidden md:flex",
          collapsed ? "w-16 md:w-20" : "w-64"
        )}
      >
        {/* LOGO + TOGGLE */}
        <div className="p-3 sm:p-4 border-b flex items-center justify-between">
          <h1 className={clsx("font-bold tracking-wide transition-all", collapsed ? "text-sm" : "text-base sm:text-lg")}>
            {!collapsed ? "FFAVIRON - TIMING" : "FFA"}
          </h1>
          <Button onClick={() => setCollapsed(!collapsed)} size="icon" variant="ghost" className="h-8 w-8 sm:h-9 sm:w-9">
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* NAVIGATION */}
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === ""}
                className={({ isActive }) =>
                  clsx(
                    "group flex items-center gap-2 sm:gap-3 rounded px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>

        {/* FOOTER ACTIONS */}
        <div className="p-3 sm:p-4 border-t mt-auto flex flex-col gap-2">
          <Button
            onClick={logout}
            variant="ghost"
            className="w-full flex items-center gap-2 text-red-600 hover:text-red-700 text-xs sm:text-sm"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">Se déconnecter</span>}
          </Button>

          <Button
            onClick={toggleTheme}
            variant="ghost"
            className="w-full flex items-center gap-2 text-xs sm:text-sm"
          >
            {theme === "dark" ? <Moon className="w-4 h-4 flex-shrink-0" /> : <Sun className="w-4 h-4 flex-shrink-0" />}
            {!collapsed && <span className="truncate">{theme === "dark" ? "Mode sombre" : "Mode clair"}</span>}
          </Button>
        </div>
      </aside>

      {/* TOPBAR + CONTENT */}
      <div className="flex-1 flex flex-col w-full md:w-auto">
        <header className="h-12 sm:h-14 border-b flex items-center px-3 sm:px-4 md:px-6 justify-between bg-background/95 sticky top-0 z-30">
          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-80 p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b">
                    <h1 className="text-lg sm:text-xl font-bold">
                      {collapsed ? "FFA" : "FFAVIRON - TIMING"}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                      {eventName}
                    </p>
                  </div>
                  <ScrollArea className="flex-1">
                    <nav className="p-2 space-y-1">
                      {navItems.map(({ to, label, icon: Icon }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={to === ""}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            clsx(
                              "group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-muted hover:text-foreground"
                            )
                          }
                        >
                          <Icon className="w-4 h-4" />
                          <span>{label}</span>
                        </NavLink>
                      ))}
                    </nav>
                  </ScrollArea>
                  <div className="p-4 border-t space-y-2">
                    <Button
                      onClick={logout}
                      variant="ghost"
                      className="w-full flex items-center gap-2 text-red-600 hover:text-red-700 text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Se déconnecter
                    </Button>
                    <Button
                      onClick={toggleTheme}
                      variant="ghost"
                      className="w-full flex items-center gap-2 text-sm"
                    >
                      {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      {theme === "dark" ? "Mode sombre" : "Mode clair"}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-xs sm:text-sm text-muted-foreground font-semibold truncate">
              {eventName}
            </span>
          </div>
          {/* Desktop Event Name */}
          <div className="hidden md:block text-xs sm:text-sm text-muted-foreground font-semibold truncate">
            {eventName}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 bg-slate-100 dark:bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
