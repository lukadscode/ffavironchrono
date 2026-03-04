import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { publicApi } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import { Timer, MapPin, Calendar, TrendingUp, Clock, Award, Users, Search, Filter, X } from "lucide-react";
import dayjs from "dayjs";

const DEFAULT_EVENT_IMAGE = "https://www.sports.gouv.fr/sites/default/files/2022-08/photo-2-emmelieke-odul-jpeg-813.jpeg";

type Event = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  race_type?: string;
  is_finished?: boolean;
  cover_url?: string;
  image_url?: string;
};

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
        // Debug: afficher les événements pour vérifier qu'ils sont bien récupérés
        console.log("Événements récupérés:", eventsData.length);
        eventsData.forEach((e: Event) => {
          const endDate = dayjs(e.end_date);
          const today = dayjs();
          console.log(`Événement: ${e.name}, end_date: ${e.end_date}, is_finished: ${e.is_finished}, est passé: ${endDate.isBefore(today)}`);
        });
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

    // Trier par date (plus récents en premier)
    return filtered.sort((a, b) => {
      const dateA = dayjs(a.end_date || a.start_date);
      const dateB = dayjs(b.end_date || b.start_date);
      return dateB.diff(dateA);
    });
  }, [events, searchQuery, selectedType]);

  // Événements en cours aujourd'hui (courses de la journée)
  const todayEvents = useMemo(() => {
    const today = dayjs().startOf("day");
    return filteredEvents.filter((e) => {
      if (e.is_finished) return false;
      const startDate = dayjs(e.start_date).startOf("day");
      const endDate = dayjs(e.end_date).startOf("day");
      // Événement qui a lieu aujourd'hui
      return (
        (startDate.isBefore(today) || startDate.isSame(today)) &&
        (endDate.isAfter(today) || endDate.isSame(today))
      );
    });
  }, [filteredEvents]);

  // Événements en cours (mais pas uniquement aujourd'hui)
  const ongoingEvents = useMemo(() => {
    const today = dayjs();
    const todayStart = dayjs().startOf("day");
    return filteredEvents.filter((e) => {
      if (e.is_finished) return false;
      const startDate = dayjs(e.start_date);
      const endDate = dayjs(e.end_date);
      const startDateStart = startDate.startOf("day");
      const endDateStart = endDate.startOf("day");
      // Vérifier si c'est aujourd'hui
      const isToday =
        (startDateStart.isBefore(todayStart) || startDateStart.isSame(todayStart)) &&
        (endDateStart.isAfter(todayStart) || endDateStart.isSame(todayStart));
      // En cours mais pas aujourd'hui uniquement
      return startDate.isBefore(today) && endDate.isAfter(today) && !isToday;
    });
  }, [filteredEvents]);

  // Événements à venir
  const upcomingEvents = useMemo(() => {
    return filteredEvents.filter((e) => {
      if (e.is_finished) return false;
      const startDate = dayjs(e.start_date);
      const today = dayjs();
      return startDate.isAfter(today);
    });
  }, [filteredEvents]);

  // Événements passés (archivés le lendemain de la fin de la compétition)
  const pastEvents = useMemo(() => {
    const today = dayjs().startOf("day");
    return filteredEvents.filter((e) => {
      // Si l'événement est marqué comme terminé, il est dans les archives
      if (e.is_finished) return true;

      const endDate = dayjs(e.end_date).startOf("day");
      // Un événement est passé si sa date de fin est avant aujourd'hui
      return endDate.isBefore(today);
    });
  }, [filteredEvents]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedType("all");
  };

  const hasActiveFilters = searchQuery || selectedType !== "all";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[400px] sm:min-h-[500px] md:min-h-[600px] flex items-center text-white">
        {/* Image de fond */}
        <div className="absolute inset-0">
          <img
            src={DEFAULT_EVENT_IMAGE}
            alt="Compétition d'aviron"
            className="w-full h-full object-cover"
          />
          {/* Overlay avec dégradé */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/85 via-blue-800/80 to-blue-900/85"></div>
        </div>
        
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4 sm:mb-6 text-xs sm:text-sm">
              <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium">FFAviron - Résultats des compétitions</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 leading-tight break-words">
              Suivez les résultats
              <span className="block bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">
                des compétitions
              </span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-blue-100 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-4">
              Consultez les résultats, les classements et suivez en direct toutes les compétitions d'aviron organisées 
              par la Fédération Française d'Aviron.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6 mt-8 sm:mt-12 px-4">
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300 flex-shrink-0" />
                <div className="text-left">
                  <div className="text-xs sm:text-sm text-blue-200">Temps réel</div>
                  <div className="text-base sm:text-lg font-bold">0.001s</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300 flex-shrink-0" />
                <div className="text-left">
                  <div className="text-xs sm:text-sm text-blue-200">Précision</div>
                  <div className="text-base sm:text-lg font-bold">100%</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300 flex-shrink-0" />
                <div className="text-left">
                  <div className="text-xs sm:text-sm text-blue-200">Compétitions</div>
                  <div className="text-base sm:text-lg font-bold">{events.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-10 md:space-y-14">
        {/* Barre de recherche inspirée du bandeau de navigation intermédiaire */}
        <section className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
          <div className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-500 font-semibold">
              Live results
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Compétitions d&apos;aviron
            </h2>
            <p className="text-sm text-slate-500 max-w-xl">
              Recherchez une compétition, filtrez par type d&apos;événement et
              accédez aux lives, aux prochaines courses et aux archives.
            </p>
          </div>
          <Card className="w-full md:w-[420px] shadow-sm border-slate-200/70">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="search" className="text-xs font-medium text-slate-600">
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
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="type" className="text-xs font-medium text-slate-600">
                    Type
                  </Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger id="type" className="h-9 text-xs">
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="indoor">Indoor</SelectItem>
                      <SelectItem value="aviron">Aviron</SelectItem>
                      <SelectItem value="mer">Mer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="mt-4 md:mt-6 h-9 text-xs gap-1"
                >
                  <X className="w-3 h-3" />
                  Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Bloc LIVE / NEXT UP comme sur le wireframe */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* LIVE (aujourd'hui + en cours) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 font-semibold">
                  Live
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                {todayEvents.length + ongoingEvents.length} compétitions
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : todayEvents.length + ongoingEvents.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="py-8 flex flex-col items-start gap-2">
                  <p className="text-sm font-medium text-slate-700">
                    Aucune compétition en direct pour le moment.
                  </p>
                  <p className="text-xs text-slate-500">
                    Consultez les prochaines compétitions dans la colonne &quot;Next up&quot;.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                {/* Grande carte principale */}
                <div className="space-y-4">
                  {(todayEvents[0] || ongoingEvents[0]) && (
                    <EventCard
                      event={(todayEvents[0] || ongoingEvents[0]) as Event}
                      status={todayEvents[0] ? "today" : "ongoing"}
                    />
                  )}
                </div>

                {/* Autres lives compactes */}
                <div className="space-y-3">
                  {[...todayEvents.slice(1), ...ongoingEvents.slice(1)]
                    .slice(0, 3)
                    .map((event) => (
                      <Card
                        key={event.id}
                        className="group overflow-hidden border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer"
                      >
                        <Link to={`/public/event/${event.id}`}>
                          <CardContent className="py-3 px-3 flex items-center gap-3">
                            <div className="relative h-14 w-20 rounded-md overflow-hidden bg-slate-900/80">
                              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/60 via-teal-500/40 to-slate-900" />
                              <Timer className="absolute inset-0 m-auto w-5 h-5 text-white/90 opacity-80" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                                {event.name}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {dayjs(event.start_date).format("DD MMM")} -{" "}
                                  {dayjs(event.end_date).format("DD MMM")}
                                </span>
                              </p>
                            </div>
                          </CardContent>
                        </Link>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* NEXT UP (à venir) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-600 font-semibold">
                Next up
              </p>
              <span className="text-[11px] text-slate-500">
                {upcomingEvents.length} compétitions
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : upcomingEvents.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="py-8 flex flex-col items-start gap-2">
                  <p className="text-sm font-medium text-slate-700">
                    Aucune compétition planifiée.
                  </p>
                  <p className="text-xs text-slate-500">
                    De nouveaux événements apparaîtront ici dès leur publication.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 4).map((event, index) => (
                  <Card
                    key={event.id}
                    className={`group overflow-hidden border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer ${
                      index === 0 ? "bg-emerald-500 text-white" : "bg-white"
                    }`}
                  >
                    <Link to={`/public/event/${event.id}`}>
                      <CardContent className="py-4 px-4 flex flex-col gap-1.5">
                        <p
                          className={`text-xs font-semibold line-clamp-2 ${
                            index === 0
                              ? "text-white"
                              : "text-slate-900 group-hover:text-emerald-700"
                          }`}
                        >
                          {event.name}
                        </p>
                        <p
                          className={`text-[11px] flex items-center gap-1.5 ${
                            index === 0 ? "text-emerald-50" : "text-slate-500"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>
                            {dayjs(event.start_date).format("DD MMM")} -{" "}
                            {dayjs(event.end_date).format("DD MMM")}
                          </span>
                        </p>
                        <p
                          className={`text-[11px] flex items-center gap-1.5 ${
                            index === 0 ? "text-emerald-50" : "text-slate-500"
                          }`}
                        >
                          <MapPin className="w-3 h-3" />
                          <span className="line-clamp-1">{event.location}</span>
                        </p>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Grille des compétitions (mix live / next / archives) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-600 font-semibold">
              All events
            </p>
            <span className="text-[11px] text-slate-500">
              {filteredEvents.length} compétitions trouvées
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                Aucune compétition trouvée
              </h3>
              <p className="text-sm text-slate-500">
                Modifiez vos critères de recherche ou revenez plus tard.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filteredEvents.map((event) => {
                const today = dayjs().startOf("day");
                const start = dayjs(event.start_date).startOf("day");
                const end = dayjs(event.end_date).startOf("day");

                let status: "today" | "ongoing" | "upcoming" | "past" = "upcoming";
                if (event.is_finished || end.isBefore(today)) {
                  status = "past";
                } else if (
                  (start.isBefore(today) || start.isSame(today)) &&
                  (end.isAfter(today) || end.isSame(today))
                ) {
                  status = "today";
                } else if (start.isBefore(today) && end.isAfter(today)) {
                  status = "ongoing";
                } else if (start.isAfter(today)) {
                  status = "upcoming";
                }

                return <EventCard key={event.id} event={event} status={status} />;
              })}
            </div>
          )}
        </section>

        {/* Bandeau bas comme la grande bannière */}
        {filteredEvents.length > 0 && (
          <section className="mt-4">
            <Card className="relative overflow-hidden border-0 shadow-xl rounded-2xl bg-slate-950">
              <div className="absolute inset-0">
                <img
                  src={filteredEvents[0].cover_url || filteredEvents[0].image_url || DEFAULT_EVENT_IMAGE}
                  alt={filteredEvents[0].name}
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent" />
              </div>
              <CardContent className="relative z-10 px-6 md:px-10 py-10 md:py-14 flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
                <div className="flex-1 space-y-3 max-w-xl">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-semibold">
                    Focus event
                  </p>
                  <h3 className="text-2xl md:text-3xl font-semibold text-white leading-tight">
                    {filteredEvents[0].name}
                  </h3>
                  <p className="text-sm md:text-base text-slate-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {dayjs(filteredEvents[0].start_date).format("DD MMM YYYY")} -{" "}
                      {dayjs(filteredEvents[0].end_date).format("DD MMM YYYY")}
                    </span>
                  </p>
                  <p className="text-xs md:text-sm text-slate-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span className="line-clamp-2">{filteredEvents[0].location}</span>
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 md:px-8"
                  >
                    <Link to={`/public/event/${filteredEvents[0].id}`}>
                      Accéder au live
                    </Link>
                  </Button>
                  <p className="text-[11px] text-slate-300 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>Résultats officiels FFAviron</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

function EventCard({ event, status }: { event: Event; status: "today" | "ongoing" | "upcoming" | "past" }) {
  const isToday = status === "today";
  const isOngoing = status === "ongoing";
  const isUpcoming = status === "upcoming";
  const isPast = status === "past";

  const statusConfig = {
    today: {
      badge: "Aujourd'hui",
      badgeColor: "bg-orange-100 text-orange-700 border-orange-200",
      accent: "border-orange-500",
      pulse: true,
    },
    ongoing: {
      badge: "En cours",
      badgeColor: "bg-green-100 text-green-700 border-green-200",
      accent: "border-green-500",
      pulse: true,
    },
    upcoming: {
      badge: "À venir",
      badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
      accent: "border-blue-500",
      pulse: false,
    },
    past: {
      badge: "Terminé",
      badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
      accent: "border-slate-300",
      pulse: false,
    },
  };

  const config = statusConfig[status];
  const daysUntil = isUpcoming ? dayjs(event.start_date).diff(dayjs(), "day") : null;

  return (
    <Link to={`/public/event/${event.id}`}>
      <Card
        className={`group relative overflow-hidden h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 ${config.accent} ${
          config.pulse ? "ring-2 ring-green-500/20" : ""
        }`}
      >
        {/* Badges de statut et type */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 flex-wrap justify-end">
          <span
            className={`px-1.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm ${config.badgeColor} ${
              config.pulse ? "animate-pulse" : ""
            }`}
          >
            {config.badge}
          </span>
          {event.race_type && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm bg-purple-100 text-purple-700 border-purple-200 capitalize">
              {event.race_type}
            </span>
          )}
        </div>

        {/* Image/Header avec gradient */}
        <div className="relative h-24 sm:h-28 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 overflow-hidden">
          {event.cover_url || event.image_url ? (
            <>
              <img
                src={event.cover_url || event.image_url}
                alt={event.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "";
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-blue-900/40"></div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
              
              {/* Icône Timer au centre */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </>
          )}

          {/* Overlay au hover */}
          <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/20 transition-colors"></div>
        </div>

        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">
            {event.name}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-2 px-3 pb-3">
          {/* Informations */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-1.5">
              <Calendar className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700">Dates</div>
                <div className="text-xs text-muted-foreground leading-tight">
                  {dayjs(event.start_date).format("DD MMM")} -{" "}
                  {dayjs(event.end_date).format("DD MMM YYYY")}
                </div>
                {daysUntil !== null && daysUntil >= 0 && (
                  <div className="text-xs text-blue-600 font-medium mt-0.5">
                    Dans {daysUntil === 0 ? "aujourd'hui" : `${daysUntil}j`}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <MapPin className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700">Lieu</div>
                <div className="text-xs text-muted-foreground line-clamp-2 leading-tight">{event.location}</div>
              </div>
            </div>
          </div>

          {/* Bouton d'action */}
          <Button
            className="w-full mt-2 h-7 text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors"
            variant={isToday || isOngoing ? "default" : "outline"}
            size="sm"
          >
            {isToday && "En direct"}
            {isOngoing && "En direct"}
            {isUpcoming && "Détails"}
            {isPast && "Résultats"}
            <Timer className="w-3 h-3 ml-1" />
          </Button>
        </CardContent>

        {/* Effet de brillance au hover */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
        </div>
      </Card>
    </Link>
  );
}
