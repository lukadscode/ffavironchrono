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
  image_url?: string;
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
        const eventData = res.data.data;
        setEvent(eventData);
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
      <div className="flex flex-col min-h-screen bg-primary">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-lg text-primary-foreground">Chargement de l'événement...</p>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const eventImage = event?.cover_url || event?.image_url || DEFAULT_EVENT_IMAGE;

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
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section de l'événement (aligné sur la charte de la home) */}
      <section className="relative overflow-hidden min-h-[340px] sm:min-h-[420px] md:min-h-[460px] lg:min-h-[500px] flex items-center text-white">
        {/* Image de fond */}
        <div className="absolute inset-0">
          <img
            src={eventImage}
            alt={event?.name || "Compétition d'aviron"}
            className="w-full h-full object-cover"
          />
          {/* Overlay avec dégradé sombre à gauche */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-transparent" />
        </div>

        {/* Contenu du Hero */}
        <div className="relative z-10 w-full">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 sm:py-10">
            <div className="max-w-3xl space-y-5 sm:space-y-6">
            {/* Badge retour */}
            <Link
              to="/"
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-primary/70 backdrop-blur-md border border-primary-foreground/30 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/80 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Retour à l'accueil</span>
              <span className="sm:hidden">Retour</span>
            </Link>

            {/* Titre et informations */}
              <div className="space-y-4 sm:space-y-5">
              <div>
                {event?.race_type && (
                  <span
                      className="inline-block px-3 sm:px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.18em] uppercase text-primary-foreground border border-accent/70 bg-accent/10 mb-3 sm:mb-4"
                    >
                      {event.race_type}
                    </span>
                  )}
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-semibold text-white mb-3 sm:mb-4 leading-tight drop-shadow">
                    {event?.name}
                  </h1>
                </div>

                {/* Informations de l'événement */}
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-primary/70 backdrop-blur-md rounded-lg border border-primary-foreground/20">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-accent" />
                    <span className="font-medium text-primary-foreground break-words">
                      {startDate && endDate
                        ? isSameDay
                          ? startDate.format("DD MMMM YYYY")
                          : `${startDate.format("DD MMM")} - ${endDate.format("DD MMM YYYY")}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-primary/70 backdrop-blur-md rounded-lg border border-primary-foreground/20">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-accent" />
                    <span className="font-medium text-primary-foreground break-words">
                      {event?.location}
                    </span>
                  </div>
                  {(isOngoing || isUpcoming) && (
                    <div
                      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-lg border backdrop-blur-md text-xs sm:text-sm ${
                        isOngoing
                          ? "bg-accent border-accent/60 animate-pulse"
                          : "bg-primary border-primary-foreground/30"
                      }`}
                    >
                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-accent-foreground" />
                      <span className="font-semibold text-accent-foreground">
                        {isOngoing ? "En cours" : "À venir"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation des onglets - alignée sur la charte (barre sombre + souligné vert) */}
      <div className="bg-primary border-b border-primary-foreground/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <nav className="flex justify-center gap-6 sm:gap-8 text-[11px] sm:text-xs font-medium tracking-[0.18em] uppercase text-primary-foreground/70 overflow-x-auto py-2.5">
            <Link
              to={`/public/event/${eventId}/live`}
              onClick={() => setActiveTab("live")}
              className={`relative pb-1 flex items-center gap-2 whitespace-nowrap ${
                activeTab === "live" ? "text-accent" : "hover:text-primary-foreground"
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Live</span>
              {hasOngoingRaces && (
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              )}
              {activeTab === "live" && (
                <span className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-accent" />
              )}
            </Link>
            <Link
              to={`/public/event/${eventId}/startlist`}
              onClick={() => setActiveTab("startlist")}
              className={`relative pb-1 flex items-center gap-2 whitespace-nowrap ${
                activeTab === "startlist" ? "text-accent" : "hover:text-primary-foreground"
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Startlist</span>
              {activeTab === "startlist" && (
                <span className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-accent" />
              )}
            </Link>
            <Link
              to={`/public/event/${eventId}/results`}
              onClick={() => setActiveTab("results")}
              className={`relative pb-1 flex items-center gap-2 whitespace-nowrap ${
                activeTab === "results" ? "text-accent" : "hover:text-primary-foreground"
              }`}
            >
              <Trophy className="w-3 h-3" />
              <span>Résultats</span>
              {activeTab === "results" && (
                <span className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-accent" />
              )}
            </Link>
            <Link
              to={`/public/event/${eventId}/informations`}
              onClick={() => setActiveTab("informations")}
              className={`relative pb-1 flex items-center gap-2 whitespace-nowrap ${
                activeTab === "informations" ? "text-accent" : "hover:text-primary-foreground"
              }`}
            >
              <Info className="w-3 h-3" />
              <span>Infos</span>
              {activeTab === "informations" && (
                <span className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-accent" />
              )}
            </Link>
          </nav>
        </div>
      </div>

      {/* Notifications */}
      <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-4 sm:pt-6">
        <NotificationDisplay eventId={eventId} />
      </div>

      {/* Contenu principal */}
      <main className="flex-1 max-w-6xl mx-auto px-4 lg:px-6 py-4 sm:py-6 md:py-8 lg:py-10">
        {activeTab === "live" && <Live />}
        {activeTab === "startlist" && <Startlist />}
        {activeTab === "results" && <Results />}
        {activeTab === "informations" && <Informations />}
      </main>

      <PublicFooter />
    </div>
  );
}
