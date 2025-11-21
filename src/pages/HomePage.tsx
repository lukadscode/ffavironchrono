import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { publicApi } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import { Timer, MapPin, Calendar, TrendingUp, Clock, Award, Users } from "lucide-react";
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

  const upcomingEvents = events.filter(
    (e) => !e.is_finished && dayjs(e.start_date).isAfter(dayjs())
  );
  const ongoingEvents = events.filter(
    (e) => !e.is_finished && dayjs(e.start_date).isBefore(dayjs()) && dayjs(e.end_date).isAfter(dayjs())
  );
  const pastEvents = events.filter((e) => e.is_finished || dayjs(e.end_date).isBefore(dayjs()));

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[500px] md:min-h-[600px] flex items-center text-white">
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
        
        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
              <Timer className="w-5 h-5" />
              <span className="text-sm font-medium">Système de Chronométrage Professionnel</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Chronométrage
              <span className="block bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">
                d'Excellence
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
              Suivez les compétitions d'aviron en temps réel. Résultats précis, classements instantanés, 
              chronométrage de pointe pour chaque course.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-12">
              <div className="flex items-center gap-3 px-6 py-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                <Clock className="w-6 h-6 text-cyan-300" />
                <div className="text-left">
                  <div className="text-sm text-blue-200">Temps réel</div>
                  <div className="text-lg font-bold">0.001s</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 px-6 py-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                <TrendingUp className="w-6 h-6 text-cyan-300" />
                <div className="text-left">
                  <div className="text-sm text-blue-200">Précision</div>
                  <div className="text-lg font-bold">100%</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 px-6 py-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                <Award className="w-6 h-6 text-cyan-300" />
                <div className="text-left">
                  <div className="text-sm text-blue-200">Compétitions</div>
                  <div className="text-lg font-bold">{events.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 container mx-auto px-4 py-16">
        {/* Événements en cours */}
        {ongoingEvents.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-8 bg-blue-600 rounded-full"></div>
              <h2 className="text-3xl font-bold text-slate-900">En cours</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-blue-600 to-transparent"></div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {ongoingEvents.map((event) => (
                <EventCard key={event.id} event={event} status="ongoing" />
              ))}
            </div>
          </section>
        )}

        {/* Événements à venir */}
        {upcomingEvents.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-8 bg-green-600 rounded-full"></div>
              <h2 className="text-3xl font-bold text-slate-900">À venir</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-green-600 to-transparent"></div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} status="upcoming" />
              ))}
            </div>
          </section>
        )}

        {/* Événements passés */}
        {pastEvents.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-8 bg-slate-400 rounded-full"></div>
              <h2 className="text-3xl font-bold text-slate-900">Archives</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-slate-400 to-transparent"></div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        ) : events.length === 0 && !loading ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-6">
              <Calendar className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Aucun événement disponible</h3>
            <p className="text-lg text-muted-foreground">
              Les prochaines compétitions seront affichées ici.
            </p>
          </div>
        ) : null}
      </main>

      <PublicFooter />
    </div>
  );
}

function EventCard({ event, status }: { event: Event; status: "ongoing" | "upcoming" | "past" }) {
  const isOngoing = status === "ongoing";
  const isUpcoming = status === "upcoming";
  const isPast = status === "past";

  const statusConfig = {
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
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 flex-wrap justify-end">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${config.badgeColor} ${
              config.pulse ? "animate-pulse" : ""
            }`}
          >
            {config.badge}
          </span>
          {event.race_type && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm bg-purple-100 text-purple-700 border-purple-200 capitalize">
              {event.race_type}
            </span>
          )}
        </div>

        {/* Image/Header avec gradient */}
        <div className="relative h-48 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
          
          {/* Icône Timer au centre */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Timer className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Overlay au hover */}
          <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/20 transition-colors"></div>
        </div>

        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {event.name}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Informations */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700">Dates</div>
                <div className="text-sm text-muted-foreground">
                  {dayjs(event.start_date).format("DD MMM YYYY")} -{" "}
                  {dayjs(event.end_date).format("DD MMM YYYY")}
                </div>
                {daysUntil !== null && daysUntil >= 0 && (
                  <div className="text-xs text-blue-600 font-medium mt-1">
                    Dans {daysUntil === 0 ? "aujourd'hui" : `${daysUntil} jour${daysUntil > 1 ? "s" : ""}`}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700">Lieu</div>
                <div className="text-sm text-muted-foreground line-clamp-2">{event.location}</div>
              </div>
            </div>
          </div>

          {/* Bouton d'action */}
          <Button
            className="w-full mt-4 group-hover:bg-blue-600 group-hover:text-white transition-colors"
            variant={isOngoing ? "default" : "outline"}
          >
            {isOngoing && "Suivre en direct"}
            {isUpcoming && "Voir les détails"}
            {isPast && "Voir les résultats"}
            <Timer className="w-4 h-4 ml-2" />
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
