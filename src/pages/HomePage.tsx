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
        setEvents(res.data.data || []);
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
      return (startDate.isBefore(today) || startDate.isSame(today)) && 
             (endDate.isAfter(today) || endDate.isSame(today));
    });
  }, [filteredEvents]);

  // Événements en cours (mais pas aujourd'hui)
  const ongoingEvents = useMemo(() => {
    const today = dayjs();
    const todayStart = dayjs().startOf("day");
    return filteredEvents.filter((e) => {
      if (e.is_finished) return false;
      const startDate = dayjs(e.start_date);
      const endDate = dayjs(e.end_date);
      const startDateStart = dayjs(e.start_date).startOf("day");
      const endDateStart = dayjs(e.end_date).startOf("day");
      // Vérifier si c'est aujourd'hui
      const isToday = startDateStart.isSame(todayStart) ||
                     (startDateStart.isBefore(todayStart) || startDateStart.isSame(todayStart)) &&
                     (endDateStart.isAfter(todayStart) || endDateStart.isSame(todayStart));
      // En cours mais pas aujourd'hui
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

  // Événements passés (archivés le lendemain de la compétition)
  const pastEvents = useMemo(() => {
    const today = dayjs().startOf("day");
    return filteredEvents.filter((e) => {
      if (e.is_finished) return true;
      const endDate = dayjs(e.end_date).startOf("day");
      // Archiver le lendemain de la fin de la compétition
      const archiveDate = endDate.add(1, "day");
      return archiveDate.isBefore(today);
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

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        {/* Barre de recherche et filtres */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-600" />
              <CardTitle className="text-lg">Rechercher et filtrer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Barre de recherche */}
              <div className="space-y-2">
                <Label htmlFor="search">Recherche</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="Nom de l'événement, lieu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filtre par type */}
              <div className="space-y-2">
                <Label htmlFor="type">Type d'événement</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id="type">
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

            {/* Bouton réinitialiser */}
            {hasActiveFilters && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Réinitialiser les filtres
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Événements en cours aujourd'hui (courses de la journée) */}
        {todayEvents.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-orange-600 rounded-full"></div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">En cours aujourd'hui</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-orange-600 to-transparent"></div>
            </div>
            
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {todayEvents.map((event) => (
                <EventCard key={event.id} event={event} status="today" />
              ))}
            </div>
          </section>
        )}

        {/* Événements en cours */}
        {ongoingEvents.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">En cours</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-blue-600 to-transparent"></div>
            </div>
            
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {ongoingEvents.map((event) => (
                <EventCard key={event.id} event={event} status="ongoing" />
              ))}
            </div>
          </section>
        )}

        {/* Événements à venir */}
        {upcomingEvents.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-green-600 rounded-full"></div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">À venir</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-green-600 to-transparent"></div>
            </div>
            
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} status="upcoming" />
              ))}
            </div>
          </section>
        )}

        {/* Événements passés */}
        {pastEvents.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-slate-400 rounded-full"></div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Archives</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-slate-400 to-transparent"></div>
            </div>
            
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} status="past" />
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-lg text-muted-foreground">Chargement des événements...</p>
            </div>
          </div>
        ) : filteredEvents.length === 0 && !loading ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-6">
              <Calendar className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {hasActiveFilters ? "Aucun événement trouvé" : "Aucun événement disponible"}
            </h3>
            <p className="text-lg text-muted-foreground">
              {hasActiveFilters
                ? "Essayez de modifier vos critères de recherche."
                : "Les prochaines compétitions seront affichées ici."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        ) : null}
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
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
          
          {/* Icône Timer au centre */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </div>

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
