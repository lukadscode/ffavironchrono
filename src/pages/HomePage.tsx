import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { publicApi } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import { Timer, MapPin, Calendar, Search, Filter, X, ArrowRight } from "lucide-react";
import dayjs from "dayjs";

type Event = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  race_type?: string;
  is_finished?: boolean;
};

type EventStatus = "today" | "ongoing" | "upcoming" | "past";

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await publicApi.get("/events");
        const eventsData = res.data.data || [];
        setEvents(eventsData);
      } catch (err) {
        console.error("Erreur chargement événements", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Fonction pour déterminer le type d'événement
  const getEventType = (raceType?: string): string => {
    if (!raceType) return "aviron";
    const typeLower = raceType.toLowerCase();
    if (typeLower.includes("indoor")) return "indoor";
    if (typeLower.includes("mer") || typeLower.includes("coastal")) return "mer";
    return "aviron";
  };

  // Déterminer le statut de l'événement (aujourd'hui, en cours, à venir, passé)
  const getEventStatus = (event: Event): EventStatus => {
    const today = dayjs();
    const todayStart = today.startOf("day");
    const startDate = dayjs(event.start_date);
    const endDate = dayjs(event.end_date);
    const startDateStart = startDate.startOf("day");
    const endDateStart = endDate.startOf("day");

    // Si explicitement marqué comme terminé, on le considère comme "past"
    if (event.is_finished) {
      return "past";
    }

    const isToday =
      (startDateStart.isBefore(todayStart) || startDateStart.isSame(todayStart)) &&
      (endDateStart.isAfter(todayStart) || endDateStart.isSame(todayStart));

    if (isToday) {
      return "today";
    }

    if (startDate.isBefore(today) && endDate.isAfter(today)) {
      return "ongoing";
    }

    if (startDate.isAfter(today)) {
      return "upcoming";
    }

    return "past";
  };

  // Filtrer et trier les événements
  const filteredEvents = useMemo(() => {
    let filtered = events.filter((e) => {
      // Filtre par recherche
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = e.name.toLowerCase().includes(query);
        const matchesLocation = e.location?.toLowerCase().includes(query);
        if (!matchesName && !matchesLocation) return false;
      }

      // Filtre par type
      if (selectedType !== "all") {
        const eventType = getEventType(e.race_type);
        if (eventType !== selectedType) return false;
      }

      return true;
    });

    // Trier par date (plus récents / prochains en premier)
    return filtered.sort((a, b) => {
      const dateA = dayjs(a.end_date || a.start_date);
      const dateB = dayjs(b.end_date || b.start_date);
      return dateB.diff(dateA);
    });
  }, [events, searchQuery, selectedType]);

  const eventsWithStatus = useMemo(
    () =>
      filteredEvents.map((event) => ({
        ...event,
        _status: getEventStatus(event),
      })),
    [filteredEvents]
  );

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedType("all");
  };

  const hasActiveFilters = searchQuery || selectedType !== "all";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10">
        {/* Bandeau / titre de page (style "header de listing") */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Compétitions
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Liste des événements publics de la Fédération Française d&apos;Aviron.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>En direct / en cours</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
              <span>À venir</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
              <span>Terminé</span>
            </div>
          </div>
        </div>

        {/* Bloc "Filter & sort" à gauche + résumé à droite */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <CardTitle className="text-base sm:text-lg">
                  Filtrer et trier
                </CardTitle>
              </div>
              <div className="text-xs sm:text-sm text-slate-500">
                {eventsWithStatus.length} compétitions affichées
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Colonne filtres principaux */}
              <div className="space-y-3 md:col-span-2">
                {/* Recherche */}
                <div className="space-y-1.5">
                  <Label htmlFor="search" className="text-xs sm:text-sm">
                    Recherche
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="search"
                      placeholder="Nom de l'événement, lieu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                </div>

                {/* Type d'événement */}
                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-xs sm:text-sm">
                    Type d&apos;événement
                  </Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger id="type" className="text-sm">
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="indoor">Indoor</SelectItem>
                      <SelectItem value="aviron">Aviron</SelectItem>
                      <SelectItem value="mer">Mer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Colonne actions / reset */}
              <div className="flex flex-col items-stretch justify-between gap-3">
                <div className="space-y-1.5 text-xs sm:text-sm text-slate-500">
                  <p className="font-medium text-slate-700">
                    Résumé des filtres
                  </p>
                  <p>
                    Recherche :{" "}
                    <span className="font-mono">
                      {searchQuery ? `"${searchQuery}"` : "—"}
                    </span>
                  </p>
                  <p>
                    Type :{" "}
                    <span className="font-mono">
                      {selectedType === "all" ? "Tous" : selectedType}
                    </span>
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-2 text-xs sm:text-sm"
                  >
                    <X className="w-4 h-4" />
                    Réinitialiser
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tableau principal des compétitions (wireframe type "liste + filtres") */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">
                Liste des compétitions
              </CardTitle>
              <span className="text-xs sm:text-sm text-slate-500">
                Tri : plus récentes / prochaines en premier
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm sm:text-base text-slate-500">
                    Chargement des événements...
                  </p>
                </div>
              </div>
            ) : eventsWithStatus.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                  <Calendar className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-1">
                  {hasActiveFilters
                    ? "Aucun événement ne correspond aux filtres"
                    : "Aucun événement disponible"}
                </h3>
                <p className="text-sm sm:text-base text-slate-500 mb-3">
                  {hasActiveFilters
                    ? "Modifiez vos critères ou réinitialisez les filtres."
                    : "Les prochaines compétitions seront affichées ici."}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-slate-100 border-y border-slate-200">
                    <tr className="text-left text-slate-700">
                      <th className="px-3 sm:px-4 py-2 w-10">
                        <span className="sr-only">Sélection</span>
                      </th>
                      <th className="px-3 sm:px-4 py-2 font-semibold">
                        Nom
                      </th>
                      <th className="px-3 sm:px-4 py-2 font-semibold">
                        Dates
                      </th>
                      <th className="px-3 sm:px-4 py-2 font-semibold">
                        Lieu
                      </th>
                      <th className="px-3 sm:px-4 py-2 font-semibold">
                        Type
                      </th>
                      <th className="px-3 sm:px-4 py-2 font-semibold">
                        Statut
                      </th>
                      <th className="px-3 sm:px-4 py-2 text-right font-semibold">
                        Accès
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventsWithStatus.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}

function EventRow({ event }: { event: Event & { _status: EventStatus } }) {
  const status = event._status;
  const startDate = dayjs(event.start_date);
  const endDate = dayjs(event.end_date);

  const statusConfig: Record<
    EventStatus,
    { label: string; bg: string; dot: string }
  > = {
    today: {
      label: "Aujourd'hui",
      bg: "bg-orange-50 text-orange-800 border-orange-200",
      dot: "bg-orange-500",
    },
    ongoing: {
      label: "En cours",
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dot: "bg-emerald-500",
    },
    upcoming: {
      label: "À venir",
      bg: "bg-blue-50 text-blue-800 border-blue-200",
      dot: "bg-blue-500",
    },
    past: {
      label: "Terminé",
      bg: "bg-slate-50 text-slate-700 border-slate-200",
      dot: "bg-slate-400",
    },
  };

  const config = statusConfig[status];

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
      <td className="px-3 sm:px-4 py-2 align-top">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          aria-label="Sélectionner la compétition"
        />
      </td>
      <td className="px-3 sm:px-4 py-2 align-top">
        <div className="flex flex-col gap-0.5">
          <Link
            to={`/public/event/${event.id}`}
            className="font-medium text-slate-900 hover:text-blue-700 text-xs sm:text-sm"
          >
            {event.name}
          </Link>
          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-500">
            <Timer className="w-3 h-3" />
            <span>ID&nbsp;{event.id}</span>
          </div>
        </div>
      </td>
      <td className="px-3 sm:px-4 py-2 align-top text-[11px] sm:text-xs text-slate-700">
        <div>
          {startDate.format("DD MMM YYYY")}{" "}
          {startDate.isSame(endDate, "day") ? null : (
            <>
              <span className="text-slate-400">→</span>{" "}
              {endDate.format("DD MMM YYYY")}
            </>
          )}
        </div>
      </td>
      <td className="px-3 sm:px-4 py-2 align-top text-[11px] sm:text-xs text-slate-700 max-w-[160px] sm:max-w-xs">
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
          <span className="line-clamp-2">{event.location}</span>
        </div>
      </td>
      <td className="px-3 sm:px-4 py-2 align-top text-[11px] sm:text-xs text-slate-700 capitalize">
        {event.race_type || "—"}
      </td>
      <td className="px-3 sm:px-4 py-2 align-top">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] sm:text-xs font-medium ${config.bg}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
      </td>
      <td className="px-3 sm:px-4 py-2 align-top text-right">
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] sm:text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
        >
          <Link to={`/public/event/${event.id}`} className="inline-flex items-center gap-1">
            Ouvrir
            <ArrowRight className="w-3 h-3" />
          </Link>
        </Button>
      </td>
    </tr>
  );
}
