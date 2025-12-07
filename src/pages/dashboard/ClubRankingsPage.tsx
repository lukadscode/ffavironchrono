import { useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trophy, Calendar, MapPin, Award, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

interface ClubRanking {
  id: string;
  club_name: string;
  club_code: string | null;
  total_points: number;
  rank: number | null;
  points_count: number;
}

interface EventRankings {
  event: {
    id: string;
    name: string;
    location: string;
    start_date: string;
    end_date: string;
    race_type: string;
  };
  rankings: ClubRanking[];
}

export default function ClubRankingsPage() {
  const [eventType, setEventType] = useState<string>("indoor");
  const [data, setData] = useState<EventRankings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "by-event">("global");

  useEffect(() => {
    fetchRankings();
  }, [eventType]);

  const fetchRankings = async () => {
    if (!eventType) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/rankings/clubs/by-type/${eventType}?ranking_type=indoor_points`);
      
      if (response.data.status === "success") {
        setData(response.data.data || []);
      } else {
        setError(response.data.message || "Erreur lors de la récupération des classements");
      }
    } catch (err: any) {
      console.error("Erreur récupération classements:", err);
      setError(err?.response?.data?.message || "Impossible de charger les classements");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculer le classement global (meilleur score par club)
  const globalRanking = useMemo(() => {
    const clubBestScores: Record<string, {
      club_name: string;
      club_code: string | null;
      best_points: number;
      best_event_name: string;
      best_event_date: string;
    }> = {};

    // Pour chaque événement, trouver le meilleur score de chaque club
    data.forEach((eventRankings) => {
      eventRankings.rankings.forEach((ranking) => {
        const key = ranking.club_name;
        
        // Si le club n'existe pas encore ou si ce score est meilleur
        if (!clubBestScores[key] || ranking.total_points > clubBestScores[key].best_points) {
          clubBestScores[key] = {
            club_name: ranking.club_name,
            club_code: ranking.club_code,
            best_points: ranking.total_points,
            best_event_name: eventRankings.event.name,
            best_event_date: eventRankings.event.start_date,
          };
        }
      });
    });

    // Trier par points décroissants et ajouter le rang
    return Object.values(clubBestScores)
      .sort((a, b) => b.best_points - a.best_points)
      .map((club, index) => ({
        ...club,
        global_rank: index + 1,
      }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des classements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Classements des Clubs</h1>
        <p className="text-muted-foreground">
          Consultez les classements des clubs par type d'événement
        </p>
      </div>

      {/* Sélecteur de type d'événement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Type d'événement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Sélectionner un type d'événement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indoor">Indoor</SelectItem>
              <SelectItem value="mer">Mer</SelectItem>
              <SelectItem value="rivière">Rivière</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Onglets */}
      <div className="mb-6">
        <div className="flex gap-2 border-b bg-muted/30">
          <button
            onClick={() => setActiveTab("global")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "global"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Award className="w-4 h-4" />
            Classement général
          </button>
          <button
            onClick={() => setActiveTab("by-event")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "by-event"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Trophy className="w-4 h-4" />
            Classement par événement
          </button>
        </div>
      </div>

      {/* Classement Global */}
      {activeTab === "global" && globalRanking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Classement Global ({eventType.toUpperCase()})
            </CardTitle>
            <CardDescription>
              Classement basé sur le meilleur score de chaque club parmi tous les événements
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-20 text-center font-semibold">Rang</TableHead>
                    <TableHead className="min-w-[250px] font-semibold">Club</TableHead>
                    <TableHead className="w-32 text-center font-semibold">Meilleur score</TableHead>
                    <TableHead className="min-w-[200px] font-semibold">Événement</TableHead>
                    <TableHead className="w-32 text-center font-semibold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {globalRanking.map((club) => (
                    <TableRow
                      key={club.club_name}
                      className={`${
                        club.global_rank === 1 ? "bg-amber-50 dark:bg-amber-950/20" :
                        club.global_rank === 2 ? "bg-slate-50 dark:bg-slate-900/20" :
                        club.global_rank === 3 ? "bg-amber-100 dark:bg-amber-900/20" : ""
                      }`}
                    >
                      <TableCell className="text-center">
                        <span className="font-bold text-lg text-primary">
                          {club.global_rank}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {club.club_name}
                        </div>
                        {club.club_code && (
                          <div className="text-sm text-muted-foreground">
                            {club.club_code}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-xl text-primary">
                          {club.best_points.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {club.best_event_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm text-muted-foreground">
                          {dayjs(club.best_event_date).format("DD/MM/YYYY")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "global" && globalRanking.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun classement global disponible pour ce type d'événement.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Classements par Événement */}
      {activeTab === "by-event" && data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun classement disponible pour ce type d'événement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.map((eventRankings) => (
            <Card key={eventRankings.event.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      {eventRankings.event.name}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {dayjs(eventRankings.event.start_date).format("DD/MM/YYYY")}
                          {!dayjs(eventRankings.event.start_date).isSame(
                            dayjs(eventRankings.event.end_date),
                            "day"
                          ) && (
                            <> - {dayjs(eventRankings.event.end_date).format("DD/MM/YYYY")}</>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{eventRankings.event.location}</span>
                      </div>
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm" className="ml-4">
                    <Link to={`/event/${eventRankings.event.id}/results`}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Voir le détail
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-20 text-center font-semibold">Rang</TableHead>
                        <TableHead className="min-w-[250px] font-semibold">Club</TableHead>
                        <TableHead className="w-32 text-center font-semibold">Total points</TableHead>
                        <TableHead className="w-32 text-center font-semibold">Nb points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventRankings.rankings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Aucun classement disponible pour cet événement
                          </TableCell>
                        </TableRow>
                      ) : (
                        eventRankings.rankings.map((ranking) => (
                          <TableRow
                            key={ranking.id}
                            className={`${
                              ranking.rank === 1 ? "bg-amber-50 dark:bg-amber-950/20" :
                              ranking.rank === 2 ? "bg-slate-50 dark:bg-slate-900/20" :
                              ranking.rank === 3 ? "bg-amber-100 dark:bg-amber-900/20" : ""
                            }`}
                          >
                            <TableCell className="text-center">
                              {ranking.rank !== null ? (
                                <span className="font-bold text-lg text-primary">
                                  {ranking.rank}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {ranking.club_name}
                              </div>
                              {ranking.club_code && (
                                <div className="text-sm text-muted-foreground">
                                  {ranking.club_code}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-bold text-xl text-primary">
                                {ranking.total_points.toFixed(1)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-muted-foreground">
                                {ranking.points_count} point{ranking.points_count > 1 ? "s" : ""}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

