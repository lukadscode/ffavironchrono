import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Building2, Loader2, AlertCircle, FileSpreadsheet, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import dayjs from "dayjs";

// Types basés sur la documentation API
interface Category {
  id: string;
  code: string | null;
  label: string | null;
  age_group: string | null;
  gender: "Homme" | "Femme" | "Mixte" | null;
}

interface Participant {
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  license_number: string | null;
  seat_position: number | null;
  is_coxswain: boolean;
}

// Type unifié pour les résultats (normal et indoor)
interface UnifiedResult {
  race_id: string;
  race_number: number;
  race_name?: string | null;
  phase_id?: string;
  phase_name?: string | null;
  crew_id: string | null;
  lane?: number;
  club_name: string | null;
  club_code: string | null;
  position: number | null; // place pour indoor, position pour normal
  finish_time?: string | null;
  final_time?: string | null; // string pour normal
  time_display?: string | null; // pour indoor
  time_ms?: number | null; // pour indoor
  has_timing?: boolean;
  // Champs spécifiques indoor
  distance?: number | null;
  distance_info?: {
    id: string;
    meters: number | null;
    is_relay: boolean;
    relay_count: number | null;
    label: string;
  } | null;
  avg_pace?: string | null;
  spm?: number | null;
  calories?: number | null;
  // Points (pour indoor)
  points?: number | null;
  is_eligible_for_points?: boolean;
  // Participants (pour indoor)
  participants?: Participant[];
}

interface CategoryResult {
  category: Category;
  results: UnifiedResult[];
}

interface ClubResult {
  club_id: string;
  club_name: string;
  club_code: string | null;
  results: Array<UnifiedResult & { category: Category }>;
}

/**
 * Convertit un temps en millisecondes (string ou number) en format lisible
 */
function formatTime(finalTime: string | number | null | undefined): string | null {
  if (finalTime === null || finalTime === undefined) return null;
  
  const ms = typeof finalTime === "string" ? parseInt(finalTime, 10) : finalTime;
  if (isNaN(ms)) return null;
  
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
  const [activeTab, setActiveTab] = useState<"categories" | "clubs" | "club-ranking">("categories");
  const [isIndoor, setIsIndoor] = useState<boolean>(false);
  const [clubRanking, setClubRanking] = useState<Array<{
    id: string;
    club_name: string;
    club_code: string | null;
    total_points: number;
    rank: number | null;
    points_count: number;
    results_count: number;
  }>>([]);
  const [eventName, setEventName] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchResults = async () => {
      if (!eventId) return;

      try {
        setLoading(true);
        setError(null);

        // D'abord, déterminer le type d'événement
        let isIndoorEvent = false;
        try {
          const eventRes = await api.get(`/events/${eventId}`);
          const eventData = eventRes.data.data || eventRes.data;
          const raceType = eventData.race_type?.toLowerCase() || "";
          isIndoorEvent = raceType.includes("indoor");
          setIsIndoor(isIndoorEvent);
          setEventName(eventData.name || "");
          
          // Récupérer le classement des clubs depuis l'API (uniquement pour indoor)
          if (isIndoorEvent) {
            try {
              const rankingRes = await api.get(`/rankings/event/${eventId}/ranking?ranking_type=indoor_points`);
              if (rankingRes.data.status === "success") {
                setClubRanking(rankingRes.data.data || []);
              }
            } catch (rankingErr) {
              console.error("Erreur récupération classement clubs:", rankingErr);
              setClubRanking([]);
            }
          } else {
            setClubRanking([]);
          }
        } catch (err) {
          console.error("Erreur vérification type événement", err);
        }

        // Utiliser la bonne API selon le type d'événement
        let response;
        if (isIndoorEvent) {
          // API pour les résultats indoor
          response = await api.get(`/indoor-results/event/${eventId}/bycategorie`);
        } else {
          // API pour les résultats normaux
          response = await api.get(`/events/${eventId}/results-by-category`);
        }
        
        if (response.data.status === "error") {
          throw new Error(response.data.message || "Erreur lors de la récupération des résultats");
        }

        // Normaliser les résultats pour un format unifié
        const rawData = response.data.data || [];
        const normalizedResults: CategoryResult[] = rawData.map((catResult: any) => ({
          category: catResult.category,
          results: catResult.results.map((r: any) => {
            // Normaliser selon le type d'événement
            if (isIndoorEvent) {
              // Format indoor - utiliser position (classement catégorie) au lieu de place
              return {
                race_id: r.race_id,
                race_number: r.race_number,
                race_name: r.race_name,
                crew_id: r.crew_id,
                club_name: r.crew?.club_name || null,
                club_code: r.crew?.club_code || null,
                position: r.position, // Position dans le classement de la catégorie
                time_display: r.time_display,
                time_ms: r.time_ms,
                has_timing: r.time_ms !== null && r.time_ms !== undefined,
                distance: r.distance,
                distance_info: r.distance_info || null,
                avg_pace: r.avg_pace,
                spm: r.spm,
                calories: r.calories,
                points: r.points || null,
                is_eligible_for_points: r.is_eligible_for_points || false,
                participants: r.crew?.participants || [],
              };
            } else {
              // Format normal
              return {
                race_id: r.race_id,
                race_number: r.race_number,
                phase_id: r.phase_id,
                phase_name: r.phase_name,
                crew_id: r.crew_id,
                lane: r.lane,
                club_name: r.club_name,
                club_code: r.club_code,
                position: r.position,
                finish_time: r.finish_time,
                final_time: r.final_time,
                has_timing: r.has_timing,
              };
            }
          }),
        }));

        setCategoryResults(normalizedResults);
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

        const clubId = result.club_code || result.club_name || "unknown";
        
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

  // Fonction d'export Excel pour les résultats par catégories
  const exportCategoriesToExcel = () => {
    const exportData: any[] = [];
    
    categoryResults.forEach((categoryResult) => {
      categoryResult.results.forEach((result) => {
        exportData.push({
          "Catégorie": categoryResult.category.label || categoryResult.category.code || "",
          "Code Catégorie": categoryResult.category.code || "",
          "Genre": categoryResult.category.gender || "",
          "Position": result.position || "-",
          "Club": result.club_name || "",
          "Code Club": result.club_code || "",
          "Course": result.race_name || `Course ${result.race_number}`,
          ...(isIndoor ? {
            "Participants": result.participants?.map((p: any) => 
              `${p.last_name?.toUpperCase() || ""}, ${p.first_name || ""}`
            ).join(" • ") || "",
            "Temps": result.time_display || "-",
            "Distance": result.distance_info?.label || (result.distance ? `${result.distance}m` : "-"),
            "Allure": result.avg_pace || "-",
            "SPM": result.spm || "-",
            "Points": result.is_eligible_for_points && result.points !== null ? result.points : "-",
          } : {
            "Phase": result.phase_name || "-",
            "Couloir": result.lane || "-",
            "Temps": result.time_display || formatTime(result.final_time || result.time_ms) || "-",
          }),
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Résultats par catégories");
    
    const fileName = `resultats_categories_${eventName || "event"}_${dayjs().format("YYYY-MM-DD")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Export Excel réussi",
      description: "Fichier Excel téléchargé",
    });
  };

  // Fonction d'export Excel pour les résultats par clubs
  const exportClubsToExcel = () => {
    const exportData: any[] = [];
    
    clubResults.forEach((clubResult) => {
      clubResult.results.forEach((result) => {
        exportData.push({
          "Club": clubResult.club_name,
          "Code Club": clubResult.club_code || "",
          "Catégorie": result.category.label || result.category.code || "",
          "Code Catégorie": result.category.code || "",
          "Genre": result.category.gender || "",
          "Position": result.position || "-",
          "Course": result.race_name || `Course ${result.race_number}`,
          ...(isIndoor ? {
            "Participants": result.participants?.map((p: any) => 
              `${p.last_name?.toUpperCase() || ""}, ${p.first_name || ""}`
            ).join(" • ") || "",
            "Temps": result.time_display || "-",
            "Distance": result.distance_info?.label || (result.distance ? `${result.distance}m` : "-"),
            "Allure": result.avg_pace || "-",
            "SPM": result.spm || "-",
            "Points": result.is_eligible_for_points && result.points !== null ? result.points : "-",
          } : {
            "Phase": result.phase_name || "-",
            "Couloir": result.lane || "-",
            "Temps": result.time_display || formatTime(result.final_time || result.time_ms) || "-",
          }),
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Résultats par clubs");
    
    const fileName = `resultats_clubs_${eventName || "event"}_${dayjs().format("YYYY-MM-DD")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Export Excel réussi",
      description: "Fichier Excel téléchargé",
    });
  };

  // Fonction d'export Excel pour le classement des clubs
  const exportClubRankingToExcel = () => {
    const exportData = clubRanking.map((club) => ({
      "Rang": club.rank || "-",
      "Club": club.club_name,
      "Code Club": club.club_code || "",
      "Total points": club.total_points.toFixed(1),
      "Nombre de points": club.points_count,
      "Nombre de résultats": club.results_count,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Classement clubs");
    
    const fileName = `classement_clubs_${eventName || "event"}_${dayjs().format("YYYY-MM-DD")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Export Excel réussi",
      description: "Fichier Excel téléchargé",
    });
  };

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
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex gap-2 border-b bg-muted/30 flex-1">
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
            {isIndoor && (
              <button
                onClick={() => setActiveTab("club-ranking")}
                className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === "club-ranking"
                    ? "border-primary text-primary bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Trophy className="w-4 h-4" />
                Classement clubs
              </button>
            )}
          </div>
          <Button
            onClick={() => {
              if (activeTab === "categories") exportCategoriesToExcel();
              else if (activeTab === "clubs") exportClubsToExcel();
              else if (activeTab === "club-ranking" && isIndoor) exportClubRankingToExcel();
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <Download className="w-4 h-4" />
            Excel
          </Button>
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
                            {!isIndoor && (
                              <>
                                <TableHead className="min-w-[150px] font-semibold">Phase</TableHead>
                                <TableHead className="w-20 text-center font-semibold">Couloir</TableHead>
                              </>
                            )}
                            {isIndoor && (
                              <TableHead className="min-w-[200px] font-semibold">Participants</TableHead>
                            )}
                            <TableHead className="w-32 text-right font-semibold">Temps</TableHead>
                            {isIndoor && (
                              <>
                                <TableHead className="w-24 text-right font-semibold">Distance</TableHead>
                                <TableHead className="w-24 text-right font-semibold">Allure</TableHead>
                                <TableHead className="w-20 text-center font-semibold">SPM</TableHead>
                                <TableHead className="w-20 text-center font-semibold">Points</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryResult.results.map((result) => {
                            // Formater les participants pour l'affichage
                            const participantsDisplay = result.participants && result.participants.length > 0
                              ? result.participants
                                  .sort((a, b) => {
                                    if (a.is_coxswain && !b.is_coxswain) return 1;
                                    if (!a.is_coxswain && b.is_coxswain) return -1;
                                    return (a.seat_position || 0) - (b.seat_position || 0);
                                  })
                                  .map((p) => {
                                    const name = `${p.last_name?.toUpperCase() || ""}, ${p.first_name || ""}`;
                                    const position = p.is_coxswain ? " (B)" : ` (${p.seat_position})`;
                                    return `${name}${position}`;
                                  })
                                  .join(" • ")
                              : null;

                            return (
                              <TableRow 
                                key={`${result.crew_id || "unknown"}-${result.race_id}`}
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
                                  {result.race_name || `Course ${result.race_number}`}
                                </TableCell>
                                {!isIndoor && (
                                  <>
                                    <TableCell>
                                      {result.phase_name || "-"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {result.lane || "-"}
                                    </TableCell>
                                  </>
                                )}
                                {isIndoor && (
                                  <TableCell className="text-sm">
                                    {participantsDisplay || "Aucun participant"}
                                  </TableCell>
                                )}
                                <TableCell className="text-right">
                                  {(result.has_timing !== false && (result.time_display || result.final_time || result.time_ms)) ? (
                                    <span className="font-mono font-semibold">
                                      {result.time_display || formatTime(result.final_time || result.time_ms) || "-"}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic text-sm">
                                      DNS/DNF
                                    </span>
                                  )}
                                </TableCell>
                                {isIndoor && (
                                  <>
                                    <TableCell className="text-right">
                                      {result.distance_info?.label || (result.distance ? `${result.distance}m` : "-")}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {result.avg_pace || "-"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {result.spm || "-"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {result.is_eligible_for_points && result.points !== null ? (
                                        <span className="font-bold text-primary">
                                          {result.points}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            );
                          })}
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
                            {!isIndoor && (
                              <>
                                <TableHead className="min-w-[150px] font-semibold">Phase</TableHead>
                                <TableHead className="w-20 text-center font-semibold">Couloir</TableHead>
                              </>
                            )}
                            {isIndoor && (
                              <TableHead className="min-w-[200px] font-semibold">Participants</TableHead>
                            )}
                            <TableHead className="w-32 text-right font-semibold">Temps</TableHead>
                            {isIndoor && (
                              <>
                                <TableHead className="w-24 text-right font-semibold">Distance</TableHead>
                                <TableHead className="w-24 text-right font-semibold">Allure</TableHead>
                                <TableHead className="w-20 text-center font-semibold">SPM</TableHead>
                                <TableHead className="w-20 text-center font-semibold">Points</TableHead>
                              </>
                            )}
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
                            .map((result) => {
                              // Formater les participants pour l'affichage
                              const participantsDisplay = result.participants && result.participants.length > 0
                                ? result.participants
                                    .sort((a, b) => {
                                      if (a.is_coxswain && !b.is_coxswain) return 1;
                                      if (!a.is_coxswain && b.is_coxswain) return -1;
                                      return (a.seat_position || 0) - (b.seat_position || 0);
                                    })
                                    .map((p) => {
                                      const name = `${p.last_name?.toUpperCase() || ""}, ${p.first_name || ""}`;
                                      const position = p.is_coxswain ? " (B)" : ` (${p.seat_position})`;
                                      return `${name}${position}`;
                                    })
                                    .join(" • ")
                                : null;

                              return (
                                <TableRow 
                                  key={`${result.crew_id || "unknown"}-${result.race_id}`}
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
                                    {result.race_name || `Course ${result.race_number}`}
                                  </TableCell>
                                  {!isIndoor && (
                                    <>
                                      <TableCell>
                                        {result.phase_name || "-"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {result.lane || "-"}
                                      </TableCell>
                                    </>
                                  )}
                                  {isIndoor && (
                                    <TableCell className="text-sm">
                                      {participantsDisplay || "Aucun participant"}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-right">
                                    {(result.has_timing !== false && (result.time_display || result.final_time || result.time_ms)) ? (
                                      <span className="font-mono font-semibold">
                                        {result.time_display || formatTime(result.final_time || result.time_ms) || "-"}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground italic text-sm">
                                        DNS/DNF
                                      </span>
                                    )}
                                  </TableCell>
                                  {isIndoor && (
                                    <>
                                      <TableCell className="text-right">
                                        {result.distance_info?.label || (result.distance ? `${result.distance}m` : "-")}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {result.avg_pace || "-"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {result.spm || "-"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {result.is_eligible_for_points && result.points !== null ? (
                                          <span className="font-bold text-primary">
                                            {result.points}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                      </TableCell>
                                    </>
                                  )}
                                </TableRow>
                              );
                            })}
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

      {activeTab === "club-ranking" && isIndoor && (
        <div className="mt-6">
          {clubRanking.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Aucun classement disponible. Les points ne sont attribués que pour les distances éligibles (2000m, 500m, relais 8x250m).</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Classement des clubs par points
                </CardTitle>
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
                        <TableHead className="w-32 text-center font-semibold">Nb résultats</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clubRanking.map((club) => (
                        <TableRow 
                          key={club.club_code || club.club_name}
                          className={`${
                            club.rank === 1 ? "bg-amber-50 dark:bg-amber-950/20" :
                            club.rank === 2 ? "bg-slate-50 dark:bg-slate-900/20" :
                            club.rank === 3 ? "bg-amber-100 dark:bg-amber-900/20" : ""
                          }`}
                        >
                          <TableCell className="text-center">
                            <span className="font-bold text-lg text-primary">
                              {club.rank}
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
                              {club.total_points.toFixed(1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-muted-foreground">
                              {club.points_count} point{club.points_count > 1 ? "s" : ""}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-muted-foreground">
                              {club.results_count} résultat{club.results_count > 1 ? "s" : ""}
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
        </div>
      )}
    </div>
  );
}

