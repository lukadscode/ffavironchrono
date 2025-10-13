import { useEffect, useState } from "react";
import { useParams, Link, Outlet, useLocation } from "react-router-dom";
import api from "@/lib/axios";
import dayjs from "dayjs";

type Event = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
};

export default function PublicEvent() {
  const { eventId } = useParams();
  const location = useLocation();
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/events/${eventId}`);
        setEvent(res.data.data);
      } catch (err) {
        console.error("Erreur chargement événement", err);
      }
    };

    if (eventId) fetchEvent();
  }, [eventId]);

  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{event?.name}</h1>
              <p className="text-sm text-slate-600 mt-1">
                {event?.location} • {dayjs(event?.start_date).format("DD/MM/YYYY")} -{" "}
                {dayjs(event?.end_date).format("DD/MM/YYYY")}
              </p>
            </div>
            <Link
              to="/public/events"
              className="text-sm text-slate-600 hover:text-slate-900 transition"
            >
              ← Retour aux événements
            </Link>
          </div>

          <nav className="flex gap-1 mt-6 border-b border-slate-200">
            <Link
              to={`/public/event/${eventId}/live`}
              className={`px-6 py-3 font-medium transition border-b-2 ${
                isActive("/live")
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              Live
            </Link>
            <Link
              to={`/public/event/${eventId}/startlist`}
              className={`px-6 py-3 font-medium transition border-b-2 ${
                isActive("/startlist")
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              Startlist
            </Link>
            <Link
              to={`/public/event/${eventId}/results`}
              className={`px-6 py-3 font-medium transition border-b-2 ${
                isActive("/results")
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              Résultats
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
