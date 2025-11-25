import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import api, { publicApi } from "@/lib/axios";
import dayjs from "dayjs";
import { Calendar, MapPin, ArrowLeft, Trophy, Clock, Users, Info } from "lucide-react";
import PublicFooter from "@/components/layout/PublicFooter";
import Live from "./Live";
import Startlist from "./Startlist";
import Results from "./Results";
import Informations from "./Informations";
import NotificationDisplay from "@/components/notifications/NotificationDisplay";

const DEFAULT_EVENT_IMAGE = "https://www.sports.gouv.fr/sites/default/files/2022-08/photo-2-emmelieke-odul-jpeg-813.jpeg";

type Event = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  race_type?: string;
  cover_url?: string;
};

type Race = {
  id: string;
  status: string;
  start_time: string;
};

export default function PublicEvent() {
  const { eventId } = useParams();
  const location = useLocation();
  const [event, setEvent] = useState<Event | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"live" | "startlist" | "results" | "informations">("live");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/events/${eventId}`);
        setEvent(res.data.data);
      } catch (err) {
        console.error("Erreur chargement événement", err);
      }
    };

    const fetchRaces = async () => {
      try {
        const res = await publicApi.get(`/races/event/${eventId}`);
        const racesData = res.data.data || [];
        setRaces(racesData);
        
        // Déterminer l'onglet actif par défaut
        const hasOngoingRaces = racesData.some((r: Race) => r.status === "in_progress");
        const hasFinishedRaces = racesData.some((r: Race) => r.status === "finished" || r.status === "official" || r.status === "non_official");
        
        if (hasOngoingRaces) {
          setActiveTab("live");
        } else if (hasFinishedRaces) {
          setActiveTab("results");
        } else {
          setActiveTab("startlist");
        }
      } catch (err) {
        console.error("Erreur chargement courses", err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
      fetchRaces();
    }
  }, [eventId]);

  // Déterminer l'onglet actif depuis l'URL
  useEffect(() => {
    if (location.pathname.includes("/live")) setActiveTab("live");
    else if (location.pathname.includes("/startlist")) setActiveTab("startlist");
    else if (location.pathname.includes("/results")) setActiveTab("results");
    else if (location.pathname.includes("/informations")) setActiveTab("informations");
  }, [location]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Chargement de l'événement...</p>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const eventImage = event?.cover_url || DEFAULT_EVENT_IMAGE;

  const startDate = event ? dayjs(event.start_date) : null;
  const endDate = event ? dayjs(event.end_date) : null;
  const isSameDay = startDate && endDate ? startDate.isSame(endDate, "day") : false;
  const isOngoing = startDate && endDate
    ? startDate.isBefore(dayjs()) && endDate.isAfter(dayjs())
    : false;
  const isUpcoming = startDate ? startDate.isAfter(dayjs()) : false;

  const hasOngoingRaces = races.some((r) => r.status === "in_progress");
  const hasRaces = races.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Hero Section de l'événement */}
      <section className="relative overflow-hidden min-h-[400px] sm:min-h-[500px] md:min-h-[600px] flex items-center">
        {/* Image de fond */}
        <div className="absolute inset-0">
          <img
            src={eventImage}
            alt={event?.name || "Compétition d'aviron"}
            className="w-full h-full object-cover"
          />
          {/* Overlay avec dégradé */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/85 via-blue-800/80 to-blue-900/85"></div>
        </div>

        {/* Contenu du Hero */}
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16 relative z-10">
          <div className="max-w-4xl">
            {/* Badge retour */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs sm:text-sm font-medium mb-4 sm:mb-6 hover:bg-white/30 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Retour à l'accueil</span>
              <span className="sm:hidden">Retour</span>
            </Link>

            {/* Titre et informations */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                {event?.race_type && (
                  <span
                    className={`inline-block px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold text-white mb-3 sm:mb-4 ${
                      event.race_type.toLowerCase().includes("rivière") || event.race_type.toLowerCase().includes("rivier")
                        ? "bg-cyan-500/90"
                        : event.race_type.toLowerCase().includes("mer") || event.race_type.toLowerCase().includes("sea")
                        ? "bg-blue-600/90"
                        : event.race_type.toLowerCase().includes("indoor") || event.race_type.toLowerCase().includes("salle")
                        ? "bg-purple-500/90"
                        : "bg-slate-500/90"
                    }`}
                  >
                    {event.race_type}
                  </span>
                )}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 sm:mb-4 drop-shadow-2xl break-words">
                  {event?.name}
                </h1>
              </div>

              {/* Informations de l'événement */}
              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4 md:gap-6 text-white">
                <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 text-xs sm:text-sm">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="font-medium break-words">
                    {startDate && endDate
                      ? isSameDay
                        ? startDate.format("DD MMMM YYYY")
                        : `${startDate.format("DD MMM")} - ${endDate.format("DD MMM YYYY")}`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 text-xs sm:text-sm">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="font-medium break-words">{event?.location}</span>
                </div>
                {(isOngoing || isUpcoming) && (
                  <div
                    className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-lg border backdrop-blur-md text-xs sm:text-sm ${
                      isOngoing
                        ? "bg-green-500/90 border-green-400/50 animate-pulse"
                        : "bg-blue-500/90 border-blue-400/50"
                    }`}
                  >
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="font-medium">
                      {isOngoing ? "En cours" : "À venir"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation des onglets - Centré et discret */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-2 sm:px-4">
          <nav className="flex justify-center gap-1 sm:gap-2 py-2 sm:py-3 overflow-x-auto">
            <Link
              to={`/public/event/${eventId}/live`}
              onClick={() => setActiveTab("live")}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap ${
                activeTab === "live"
                  ? "text-blue-600 bg-blue-50 shadow-sm"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Live</span>
                {hasOngoingRaces && (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </div>
            </Link>
            <Link
              to={`/public/event/${eventId}/startlist`}
              onClick={() => setActiveTab("startlist")}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap ${
                activeTab === "startlist"
                  ? "text-blue-600 bg-blue-50 shadow-sm"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Startlist</span>
                <span className="sm:hidden">Liste</span>
              </div>
            </Link>
            <Link
              to={`/public/event/${eventId}/results`}
              onClick={() => setActiveTab("results")}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap ${
                activeTab === "results"
                  ? "text-blue-600 bg-blue-50 shadow-sm"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Résultats</span>
              </div>
            </Link>
            <Link
              to={`/public/event/${eventId}/informations`}
              onClick={() => setActiveTab("informations")}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap ${
                activeTab === "informations"
                  ? "text-blue-600 bg-blue-50 shadow-sm"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Info className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Informations</span>
                <span className="sm:hidden">Infos</span>
              </div>
            </Link>
          </nav>
        </div>
      </div>

      {/* Notifications */}
      <div className="container mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <NotificationDisplay eventId={eventId} />
      </div>

      {/* Contenu principal */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 lg:py-12">
        {activeTab === "live" && <Live />}
        {activeTab === "startlist" && <Startlist />}
        {activeTab === "results" && <Results />}
        {activeTab === "informations" && <Informations />}
      </main>

      <PublicFooter />
    </div>
  );
}
