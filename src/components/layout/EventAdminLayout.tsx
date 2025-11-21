import { useEffect, useState } from "react";
import { Outlet, useParams, NavLink } from "react-router-dom";
import clsx from "clsx";
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
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import api from "@/lib/axios";

const logout = () => {
  localStorage.clear();
  window.location.href = "/";
};

const navItems = [
  { to: "", label: "Accueil", icon: Home },
  { to: "permissions", label: "Droits", icon: Shield },
  { to: "participants", label: "Participants", icon: Users },
  { to: "crews", label: "Équipages", icon: Rows },
  { to: "distances", label: "Distances", icon: MapPin },
  { to: "races", label: "Courses", icon: Flag },
  { to: "racePhases", label: "Phases", icon: Flag },
  { to: "timingPoint", label: "Points", icon: Timer },
  { to: "timing", label: "Chrono", icon: Timer },
  { to: "arbitres", label: "Arbitres", icon: Gavel },
  { to: "indoor", label: "Indoor", icon: Activity },
];

export default function EventAdminLayout() {
  const { eventId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const [eventName, setEventName] = useState<string>("");

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
          "border-r bg-muted/40 transition-all duration-300 flex flex-col",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* LOGO + TOGGLE */}
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-wide">
            {!collapsed ? "FFAviron" : "FFA"}
          </h1>
          <Button onClick={() => setCollapsed(!collapsed)} size="icon" variant="ghost">
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-neutral-50 " />
            ) : (
              <ChevronLeft className="w-4 h-4 text-neutral-50 " />
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
                    "group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-primary text-veut"
                      : "hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t mt-auto flex flex-col gap-2">
          <Button
            onClick={logout}
            variant="ghost"
            className="w-full flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && "Se déconnecter"}
          </Button>

          <Button
            onClick={toggleTheme}
            variant="ghost"
            className="w-full flex items-center gap-2 text-neutral-50 hover:text-neutral-950"
          >
            {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {!collapsed && (theme === "dark" ? "Mode sombre" : "Mode clair")}
          </Button>
        </div>
      </aside>

      {/* TOPBAR + CONTENT */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center px-6 justify-end bg-background/95">
          <div className="text-sm text-muted-foreground font-semibold truncate">
            {eventName}
          </div>
        </header>

        <main className="flex-1 p-6 bg-slate-100 dark:bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
