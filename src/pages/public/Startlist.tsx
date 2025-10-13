import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dayjs from "dayjs";

type RaceCrew = {
  id: string;
  lane: number;
  crew: {
    id: string;
    club_name: string;
    club_code: string;
  };
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  lane_count: number;
  race_crews: RaceCrew[];
};

export default function Startlist() {
  const { eventId } = useParams();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const res = await api.get(`/races/event/${eventId}`);
        const sorted = (res.data.data || []).sort(
          (a: Race, b: Race) => a.race_number - b.race_number
        );
        setRaces(sorted);
      } catch (err) {
        console.error("Erreur chargement courses", err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchRaces();
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Startlist des courses</h2>

      {races.map((race) => (
        <Card key={race.id}>
          <CardHeader className="bg-slate-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Course {race.race_number} - {race.name}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {dayjs(race.start_time).format("HH:mm")}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-semibold">Couloir</th>
                    <th className="text-left py-2 px-4 font-semibold">Club</th>
                    <th className="text-left py-2 px-4 font-semibold">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {(race.race_crews || [])
                    .sort((a, b) => a.lane - b.lane)
                    .map((rc) => (
                      <tr key={rc.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{rc.lane}</td>
                        <td className="py-3 px-4">{rc.crew?.club_name}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {rc.crew?.club_code}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {(!race.race_crews || race.race_crews.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                Aucun équipage inscrit
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {races.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          Aucune course programmée
        </p>
      )}
    </div>
  );
}
