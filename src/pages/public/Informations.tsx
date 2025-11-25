import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Clock, Trophy, Users, Info as InfoIcon } from "lucide-react";
import dayjs from "dayjs";

type Event = {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  location: string;
  race_type?: string;
};

export default function Informations() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await publicApi.get(`/events/${eventId}`);
        setEvent(res.data.data);
      } catch (err) {
        console.error("Erreur chargement événement", err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Chargement des informations...</p>
        </div>
      </div>
    );
  }

  const startDate = event ? dayjs(event.start_date) : null;
  const endDate = event ? dayjs(event.end_date) : null;
  const isSameDay = startDate && endDate ? startDate.isSame(endDate, "day") : false;

  return (
    <div className="space-y-6">
      {/* Informations de l'événement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InfoIcon className="w-5 h-5" />
            Informations de l'événement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {event?.description && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Dates</h3>
                <p className="text-muted-foreground">
                  {startDate && endDate
                    ? isSameDay
                      ? startDate.format("dddd D MMMM YYYY")
                      : `Du ${startDate.format("D MMMM YYYY")} au ${endDate.format("D MMMM YYYY")}`
                    : ""}
                </p>
                {startDate && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {isSameDay
                      ? `À partir de ${startDate.format("HH:mm")}`
                      : `Du ${startDate.format("HH:mm")} au ${endDate?.format("HH:mm")}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Lieu</h3>
                <p className="text-muted-foreground">{event?.location}</p>
              </div>
            </div>

            {event?.race_type && (
              <div className="flex items-start gap-3">
                <Trophy className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Type de course</h3>
                  <p className="text-muted-foreground">{event.race_type}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

