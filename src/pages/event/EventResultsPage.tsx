import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Pas de composant Tabs disponible, on utilise des boutons pour basculer
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
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "categories"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="w-4 h-4" />
            Par catégories
          </button>
          <button
            onClick={() => setActiveTab("clubs")}
            className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "clubs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-semibold">Position</th>
                            <th className="text-left p-2 font-semibold">Club</th>
                            <th className="text-left p-2 font-semibold">Course</th>
                            <th className="text-left p-2 font-semibold">Phase</th>
                            <th className="text-left p-2 font-semibold">Couloir</th>
                            <th className="text-left p-2 font-semibold">Temps</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryResult.results.map((result, idx) => (
                            <tr 
                              key={`${result.crew_id}-${result.race_id}`}
                              className={`border-b hover:bg-muted/50 ${
                                result.position === 1 ? "bg-amber-50" :
                                result.position === 2 ? "bg-gray-50" :
                                result.position === 3 ? "bg-amber-100" : ""
                              }`}
                            >
                              <td className="p-2">
                                {result.position !== null ? (
                                  <span className="font-bold text-primary">
                                    {result.position}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-2">
                                {result.club_name}
                                {result.club_code && (
                                  <span className="text-muted-foreground ml-1">
                                    ({result.club_code})
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                Course {result.race_number}
                              </td>
                              <td className="p-2">
                                {result.phase_name}
                              </td>
                              <td className="p-2">
                                {result.lane}
                              </td>
                              <td className="p-2">
                                {result.has_timing ? (
                                  <span className="font-mono">
                                    {formatTime(result.final_time) || "-"}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic">
                                    DNS/DNF
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-semibold">Catégorie</th>
                            <th className="text-left p-2 font-semibold">Position</th>
                            <th className="text-left p-2 font-semibold">Course</th>
                            <th className="text-left p-2 font-semibold">Phase</th>
                            <th className="text-left p-2 font-semibold">Couloir</th>
                            <th className="text-left p-2 font-semibold">Temps</th>
                          </tr>
                        </thead>
                        <tbody>
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
                              <tr 
                                key={`${result.crew_id}-${result.race_id}`}
                                className="border-b hover:bg-muted/50"
                              >
                                <td className="p-2">
                                  {result.category.label || result.category.code || "N/A"}
                                </td>
                                <td className="p-2">
                                  {result.position !== null ? (
                                    <span className="font-bold text-primary">
                                      {result.position}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                                <td className="p-2">
                                  Course {result.race_number}
                                </td>
                                <td className="p-2">
                                  {result.phase_name}
                                </td>
                                <td className="p-2">
                                  {result.lane}
                                </td>
                                <td className="p-2">
                                  {result.has_timing ? (
                                    <span className="font-mono">
                                      {formatTime(result.final_time) || "-"}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic">
                                      DNS/DNF
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
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

