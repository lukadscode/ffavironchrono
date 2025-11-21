import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dayjs from "dayjs";

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  race_phase?: {
    id: string;
    name: string;
  };
};

export default function IndoorPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) fetchRaces();
  }, [eventId]);

  const fetchRaces = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const racesData = res.data.data || [];
      const sorted = racesData.sort((a: Race, b: Race) => a.race_number - b.race_number);
      setRaces(sorted);
    } catch (err) {
      console.error("Erreur chargement courses", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "not_started":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">À venir</span>;
      case "in_progress":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">En cours</span>;
      case "non_official":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Non officiel</span>;
      case "official":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Officiel</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Indoor - Liste des courses</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground py-8">
            Aucune course disponible
          </p>
        ) : (
          races.map((race) => (
            <Card
              key={race.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/event/${eventId}/indoor/${race.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg">
                  Course {race.race_number} - {race.name}
                </CardTitle>
                {race.race_phase && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Phase: {race.race_phase.name}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {dayjs(race.start_time).format("HH:mm")}
                  </span>
                  {getStatusBadge(race.status)}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}


