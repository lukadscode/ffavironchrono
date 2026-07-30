import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CalendarDays, MapPin, Search, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdminPage } from "@/components/layout/AdminPage";

type EventItem = {
  id: string;
  name: string;
  location?: string;
  start_date: string;
  end_date: string;
  role?: string;
  race_type?: string;
};

type FilterTab = "all" | "upcoming" | "past";

const ROLE_LABELS: Record<string, string> = {
  organiser: "Organisateur",
  editor: "Éditeur",
  referee: "Arbitre",
  timing: "Chronométreur",
  viewer: "Lecteur",
};

function isUpcoming(event: EventItem) {
  const end = new Date(event.end_date);
  end.setHours(23, 59, 59, 999);
  return end >= new Date();
}

export default function EventsPage() {
  const { user } = useAuth();
  const events: EventItem[] = user?.events || [];
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((event) => {
        if (tab === "upcoming" && !isUpcoming(event)) return false;
        if (tab === "past" && isUpcoming(event)) return false;
        if (!q) return true;
        return (
          event.name?.toLowerCase().includes(q) ||
          event.location?.toLowerCase().includes(q) ||
          event.role?.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );
  }, [events, query, tab]);

  const counts = useMemo(
    () => ({
      all: events.length,
      upcoming: events.filter(isUpcoming).length,
      past: events.filter((e) => !isUpcoming(e)).length,
    }),
    [events]
  );

  return (
    <AdminPage
      title="Mes événements"
      description="Compétitions auxquelles vous participez ou que vous gérez."
      icon={CalendarDays}
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ["all", "Tous"],
              ["upcoming", "À venir"],
              ["past", "Passés"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={tab === key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(key)}
            >
              {label}
              <span className="ml-1.5 text-xs opacity-70">({counts[key]})</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucun événement ne correspond à votre recherche.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => (
            <Card key={event.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug line-clamp-2">
                    {event.name}
                  </CardTitle>
                  {event.role && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {ROLE_LABELS[event.role] || event.role}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span>
                      {new Date(event.start_date).toLocaleDateString("fr-FR")}
                      {" → "}
                      {new Date(event.end_date).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                  )}
                  {event.race_type && (
                    <p className="text-xs uppercase tracking-wide">
                      {event.race_type}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <Button asChild className="flex-1" variant="default">
                    <Link to={`/event/${event.id}`}>Administration</Link>
                  </Button>
                  <Button asChild size="icon" variant="outline">
                    <Link
                      to={`/public/event/${event.id}/live`}
                      target="_blank"
                      rel="noreferrer"
                      title="Page publique"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
