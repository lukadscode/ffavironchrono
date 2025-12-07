import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Building2, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Types basés sur la documentation API
interface Category {
  id: string;
  code: string | null;
  label: string | null;
  age_group: string | null;
  gender: "Homme" | "Femme" | "Mixte" | null;
}

interface Result {
  race_id: string;
  race_number: number;
  phase_id: string;
  phase_name: string;
  crew_id: string;
  lane: number;
  club_name: string | null;
  club_code: string | null;
  position: number | null;
  finish_time: string | null;
  final_time: string | null;
  has_timing: boolean;
}

interface CategoryResult {
  category: Category;
  results: Result[];
}

interface ClubResult {
  club_id: string;
  club_name: string;
  club_code: string | null;
  results: Array<Result & { category: Category }>;
}

/**
 * Convertit un temps en millisecondes (string) en format lisible
 */
function formatTime(finalTime: string | null): string | null {
  if (!finalTime) return null;
  
  const ms = parseInt(finalTime, 10);
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  }
  
  return `${seconds}.${milliseconds.toString().padStart(3, "0")}`;
}

export default function EventResultsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [categoryResults, setCategoryResults] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"categories" | "clubs">("categories");

  useEffect(() => {
    const fetchResults = async () => {
      if (!eventId) return;

      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/events/${eventId}/results-by-category`);
        
        if (response.data.status === "error") {
          throw new Error(response.data.message || "Erreur lors de la récupération des résultats");
        }

        setCategoryResults(response.data.data || []);
      } catch (err: any) {
        console.error("Erreur récupération résultats:", err);
        setError(
          err?.response?.data?.message || 
          err?.message || 
          "Impossible de charger les résultats"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [eventId]);

  // Grouper les résultats par club
  const clubResults = useMemo(() => {
    const clubMap = new Map<string, ClubResult>();

    categoryResults.forEach((categoryResult) => {
      categoryResult.results.forEach((result) => {
        if (!result.club_name) return;

        const clubId = result.club_code || result.club_name;
        
        if (!clubMap.has(clubId)) {
          clubMap.set(clubId, {
            club_id: clubId,
            club_name: result.club_name,
            club_code: result.club_code,
            results: [],
          });
        }

        clubMap.get(clubId)!.results.push({
          ...result,
          category: categoryResult.category,
        });
      });
    });

    // Trier les clubs par nom
    return Array.from(clubMap.values()).sort((a, b) => 
      a.club_name.localeCompare(b.club_name)
    );
  }, [categoryResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des résultats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Résultats de l'événement</h1>
        <p className="text-muted-foreground">
          Consultez les résultats organisés par catégorie ou par club
        </p>
      </div>

      <div className="mb-6">
        <div className="flex gap-2 border-b bg-muted/30">
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "categories"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Trophy className="w-4 h-4" />
            Par catégories
          </button>
          <button
            onClick={() => setActiveTab("clubs")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "clubs"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Par clubs
          </button>
        </div>
      </div>

      {activeTab === "categories" && (
        <div className="mt-6">
          {categoryResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Aucun résultat disponible pour cet événement.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {categoryResults.map((categoryResult) => (
                <Card key={categoryResult.category.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      {categoryResult.category.label || categoryResult.category.code || "Catégorie inconnue"}
                      {categoryResult.category.gender && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({categoryResult.category.gender})
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-20 text-center font-semibold">Position</TableHead>
                            <TableHead className="min-w-[200px] font-semibold">Club</TableHead>
                            <TableHead className="w-24 text-center font-semibold">Course</TableHead>
                            <TableHead className="min-w-[150px] font-semibold">Phase</TableHead>
                            <TableHead className="w-20 text-center font-semibold">Couloir</TableHead>
                            <TableHead className="w-32 text-right font-semibold">Temps</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryResult.results.map((result) => (
                            <TableRow 
                              key={`${result.crew_id}-${result.race_id}`}
                              className={`${
                                result.position === 1 ? "bg-amber-50 dark:bg-amber-950/20" :
                                result.position === 2 ? "bg-slate-50 dark:bg-slate-900/20" :
                                result.position === 3 ? "bg-amber-100 dark:bg-amber-900/20" : ""
                              }`}
                            >
                              <TableCell className="text-center">
                                {result.position !== null ? (
                                  <span className="font-bold text-lg text-primary">
                                    {result.position}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  {result.club_name || "N/A"}
                                </div>
                                {result.club_code && (
                                  <div className="text-sm text-muted-foreground">
                                    {result.club_code}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {result.race_number}
                              </TableCell>
                              <TableCell>
                                {result.phase_name || "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                {result.lane}
                              </TableCell>
                              <TableCell className="text-right">
                                {result.has_timing ? (
                                  <span className="font-mono font-semibold">
                                    {formatTime(result.final_time) || "-"}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic text-sm">
                                    DNS/DNF
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "clubs" && (
        <div className="mt-6">
          {clubResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Aucun résultat disponible pour cet événement.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {clubResults.map((clubResult) => (
                <Card key={clubResult.club_id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      {clubResult.club_name}
                      {clubResult.club_code && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({clubResult.club_code})
                        </span>
                      )}
                      <span className="text-sm font-normal text-muted-foreground ml-auto">
                        {clubResult.results.length} résultat{clubResult.results.length > 1 ? "s" : ""}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="min-w-[180px] font-semibold">Catégorie</TableHead>
                            <TableHead className="w-20 text-center font-semibold">Position</TableHead>
                            <TableHead className="w-24 text-center font-semibold">Course</TableHead>
                            <TableHead className="min-w-[150px] font-semibold">Phase</TableHead>
                            <TableHead className="w-20 text-center font-semibold">Couloir</TableHead>
                            <TableHead className="w-32 text-right font-semibold">Temps</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clubResult.results
                            .sort((a, b) => {
                              // Trier par catégorie puis par position
                              const catCompare = (a.category.label || a.category.code || "").localeCompare(
                                b.category.label || b.category.code || ""
                              );
                              if (catCompare !== 0) return catCompare;
                              return (a.position || 999) - (b.position || 999);
                            })
                            .map((result) => (
                              <TableRow 
                                key={`${result.crew_id}-${result.race_id}`}
                              >
                                <TableCell>
                                  <div className="font-medium">
                                    {result.category.label || result.category.code || "N/A"}
                                  </div>
                                  {result.category.gender && (
                                    <div className="text-sm text-muted-foreground">
                                      {result.category.gender}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {result.position !== null ? (
                                    <span className="font-bold text-lg text-primary">
                                      {result.position}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {result.race_number}
                                </TableCell>
                                <TableCell>
                                  {result.phase_name || "-"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {result.lane}
                                </TableCell>
                                <TableCell className="text-right">
                                  {result.has_timing ? (
                                    <span className="font-mono font-semibold">
                                      {formatTime(result.final_time) || "-"}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic text-sm">
                                      DNS/DNF
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

