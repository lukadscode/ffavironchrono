import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dayjs from "dayjs";

type RaceResult = {
  crew_id: string;
  lane: number;
  position: number;
  final_time: string;
  club_name: string;
  club_code: string;
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  results: RaceResult[];
};

export default function Results() {
  const { eventId } = useParams();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await api.get(`/races/event/${eventId}`);
        const racesData = res.data.data || [];

        const racesWithResults = await Promise.all(
          racesData.map(async (race: any) => {
            if (race.status === "not_started" || race.status === "in_progress") {
              return { ...race, results: [] };
            }

            try {
              const resultsRes = await api.get(`/race-results/race/${race.id}`);
              const results = resultsRes.data.data || [];

              const enriched = results.map((r: any) => {
                const raceCrew = (race.race_crews || []).find(
                  (rc: any) => rc.crew_id === r.crew_id
                );
                return {
                  ...r,
                  club_name: raceCrew?.crew?.club_name || "N/A",
                  club_code: raceCrew?.crew?.club_code || "N/A",
                  lane: raceCrew?.lane || 0,
                };
              });

              return {
                ...race,
                results: enriched.sort((a: any, b: any) => a.position - b.position),
              };
            } catch {
              return { ...race, results: [] };
            }
          })
        );

        const sorted = racesWithResults
          .filter((r) => r.results.length > 0)
          .sort((a, b) => a.race_number - b.race_number);

        setRaces(sorted);
      } catch (err) {
        console.error("Erreur chargement résultats", err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchResults();
  }, [eventId]);

  const formatTime = (ms: string) => {
    const totalMs = parseInt(ms, 10);
    if (isNaN(totalMs)) return "N/A";

    const totalSeconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = totalMs % 1000;

    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
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
      <h2 className="text-2xl font-bold text-slate-900">Résultats</h2>

      {races.map((race) => (
        <Card key={race.id}>
          <CardHeader className="bg-slate-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Course {race.race_number} - {race.name}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {dayjs(race.start_time).format("HH:mm")}
                </span>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    race.status === "official"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {race.status === "official" ? "Officiel" : "Non officiel"}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-semibold">Position</th>
                    <th className="text-left py-2 px-4 font-semibold">Couloir</th>
                    <th className="text-left py-2 px-4 font-semibold">Club</th>
                    <th className="text-left py-2 px-4 font-semibold">Code</th>
                    <th className="text-right py-2 px-4 font-semibold">Temps</th>
                  </tr>
                </thead>
                <tbody>
                  {race.results.map((result) => (
                    <tr
                      key={result.crew_id}
                      className={`border-b hover:bg-slate-50 ${
                        result.position === 1
                          ? "bg-yellow-50"
                          : result.position === 2
                            ? "bg-gray-50"
                            : result.position === 3
                              ? "bg-orange-50"
                              : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold">{result.position}</td>
                      <td className="py-3 px-4">{result.lane}</td>
                      <td className="py-3 px-4">{result.club_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {result.club_code}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        {formatTime(result.final_time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {races.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          Aucun résultat disponible
        </p>
      )}
    </div>
  );
}
