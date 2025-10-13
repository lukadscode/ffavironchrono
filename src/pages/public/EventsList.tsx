import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dayjs from "dayjs";

type Event = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
};

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get("/events");
        setEvents(res.data.data || []);
      } catch (err) {
        console.error("Erreur chargement événements", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Événements</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Link key={event.id} to={`/public/event/${event.id}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-xl">{event.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <span className="font-semibold">Dates:</span>{" "}
                    {dayjs(event.start_date).format("DD/MM/YYYY")} -{" "}
                    {dayjs(event.end_date).format("DD/MM/YYYY")}
                  </p>
                  <p>
                    <span className="font-semibold">Lieu:</span> {event.location}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {events.length === 0 && (
        <p className="text-center text-muted-foreground mt-8">
          Aucun événement disponible
        </p>
      )}
    </div>
  );
}
