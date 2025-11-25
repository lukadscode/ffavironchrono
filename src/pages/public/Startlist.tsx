import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import dayjs from "dayjs";
import { Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  license_number?: string;
  gender?: string;
  club_name?: string;
};

type CrewParticipant = {
  id: string;
  crew_id: string;
  participant_id: string;
  is_coxswain: boolean;
  seat_position: number;
  participant: Participant;
};

type Category = {
  id: string;
  code: string;
  label: string;
  age_group: string;
  gender: string;
  boat_seats: number;
  has_coxswain: boolean;
};

type RaceCrew = {
  id: string;
  race_id: string;
  crew_id: string;
  lane: number;
  status: string | null;
  crew: {
    id: string;
    event_id: string;
    category_id: string;
    status: number;
    club_name: string;
    club_code: string;
    coach_name: string | null;
    category: Category;
    crew_participants: CrewParticipant[];
  };
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  lane_count: number;
  race_phase_id?: string;
  race_phase?: {
    id: string;
    name: string;
  };
  race_crews: RaceCrew[];
};

type Phase = {
  id: string;
  name: string;
};

export default function Startlist() {
  const { eventId } = useParams();
  const [races, setRaces] = useState<Race[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedClub, setSelectedClub] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("🔍 Fetching startlist for event:", eventId);
        
        // Récupérer les phases
        const phasesRes = await publicApi.get(`/race-phases/${eventId}`);
        const phasesData = phasesRes.data.data || [];
        setPhases(phasesData);
        
        // Récupérer les courses
        const res = await publicApi.get(`/races/event/${eventId}`);
        console.log("📦 API Response:", res.data);
        
        const racesData = res.data.data || [];
        console.log("🏁 Number of races:", racesData.length);
        
        // Enrichir chaque course avec les race-crews complets (incluant participants)
        const enrichedRaces = await Promise.all(
          racesData.map(async (race: Race) => {
            try {
              const raceCrewsRes = await publicApi.get(`/race-crews/${race.id}`);
              const raceCrews = raceCrewsRes.data.data || [];
              console.log(`👥 Race ${race.id} crews:`, raceCrews);
              
              return {
                ...race,
                race_crews: raceCrews,
              };
            } catch (err) {
              console.error(`Erreur chargement race-crews pour course ${race.id}:`, err);
              return race;
            }
          })
        );
        
        const sorted = enrichedRaces.sort(
          (a: Race, b: Race) => (a.race_number || 0) - (b.race_number || 0)
        );
        console.log("✅ Sorted races with participants:", sorted);
        setRaces(sorted);
      } catch (err) {
        console.error("❌ Erreur chargement courses", err);
        if (err instanceof Error) {
          console.error("Error message:", err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchData();
  }, [eventId]);

  // Extraire les valeurs uniques pour les filtres
  const { uniqueClubs, uniqueCategories } = useMemo(() => {
    const clubs = new Map<string, string>(); // Map<club_code, club_name> pour afficher le nom mais filtrer par code
    const categories = new Set<string>();
    
    races.forEach((race) => {
      race.race_crews?.forEach((rc) => {
        if (rc.crew?.club_code) {
          // Utiliser club_code comme clé, stocker le nom pour affichage
          clubs.set(rc.crew.club_code, rc.crew.club_name || rc.crew.club_code);
        }
        if (rc.crew?.category?.label) {
          categories.add(rc.crew.category.label);
        }
      });
    });
    
    return {
      uniqueClubs: Array.from(clubs.entries())
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      uniqueCategories: Array.from(categories).sort(),
    };
  }, [races]);

  // Filtrer les courses et équipages
  const filteredRaces = useMemo(() => {
    return races
      .filter((race) => {
        // Filtre par phase
        if (selectedPhase !== "all" && race.race_phase_id !== selectedPhase) {
          return false;
        }
        
        // Filtre par recherche (nom de course, club, participant)
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesRace = race.name?.toLowerCase().includes(query);
            const matchesCrew = race.race_crews?.some((rc) => {
              const matchesClub = 
                rc.crew?.club_name?.toLowerCase().includes(query) ||
                rc.crew?.club_code?.toLowerCase().includes(query);
              const matchesParticipant = rc.crew?.crew_participants?.some((cp) => {
                const fullName = `${cp.participant?.first_name || ""} ${cp.participant?.last_name || ""}`.toLowerCase();
                const license = cp.participant?.license_number?.toLowerCase() || "";
                return fullName.includes(query) || license.includes(query);
              });
              return matchesClub || matchesParticipant;
            });
          
          if (!matchesRace && !matchesCrew) {
            return false;
          }
        }
        
        return true;
      })
      .map((race) => {
        // Filtrer les équipages dans chaque course
        const filteredCrews = (race.race_crews || []).filter((rc) => {
          // Filtre par club (par code)
          if (selectedClub !== "all" && rc.crew?.club_code !== selectedClub) {
            return false;
          }
          
          // Filtre par catégorie
          if (selectedCategory !== "all" && rc.crew?.category?.label !== selectedCategory) {
            return false;
          }
          
          // Filtre par recherche (déjà fait au niveau course, mais on peut affiner)
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesClub = 
              rc.crew?.club_name?.toLowerCase().includes(query) ||
              rc.crew?.club_code?.toLowerCase().includes(query);
            const matchesParticipant = rc.crew?.crew_participants?.some((cp) => {
              const fullName = `${cp.participant?.first_name || ""} ${cp.participant?.last_name || ""}`.toLowerCase();
              const license = cp.participant?.license_number?.toLowerCase() || "";
              return fullName.includes(query) || license.includes(query);
            });
            if (!matchesClub && !matchesParticipant) {
              return false;
            }
          }
          
          return true;
        });
        
        return {
          ...race,
          race_crews: filteredCrews,
        };
      })
      .filter((race) => race.race_crews.length > 0); // Ne garder que les courses avec des équipages après filtrage
  }, [races, searchQuery, selectedPhase, selectedClub, selectedCategory]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPhase("all");
    setSelectedClub("all");
    setSelectedCategory("all");
  };

  const hasActiveFilters = searchQuery || selectedPhase !== "all" || selectedClub !== "all" || selectedCategory !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Startlist des courses</h2>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="gap-2 w-full sm:w-auto"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Réinitialiser les filtres</span>
            <span className="sm:hidden">Réinitialiser</span>
          </Button>
        )}
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            <CardTitle className="text-base sm:text-lg">Filtres</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Recherche */}
            <div className="space-y-2">
              <Label htmlFor="search">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  placeholder="Nom, club, participant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtre par phase */}
            <div className="space-y-2">
              <Label htmlFor="phase">Phase</Label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger id="phase">
                  <SelectValue placeholder="Toutes les phases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les phases</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtre par club */}
            <div className="space-y-2">
              <Label htmlFor="club">Club</Label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger id="club">
                  <SelectValue placeholder="Tous les clubs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clubs</SelectItem>
                  {uniqueClubs.map((club) => (
                    <SelectItem key={club.code} value={club.code}>
                      {club.code} {club.name !== club.code && `- ${club.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtre par catégorie */}
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Toutes les catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des courses filtrées */}
      {filteredRaces.length > 0 ? (
        filteredRaces.map((race) => (
          <Card key={race.id}>
            <CardHeader className="bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Course {race.race_number} - {race.name}
                  </CardTitle>
                  {race.race_phase && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Phase: {race.race_phase.name}
                    </p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {dayjs(race.start_time).format("HH:mm")}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 font-semibold">Couloir</th>
                      <th className="text-left py-2 px-4 font-semibold">Code Club</th>
                      <th className="text-left py-2 px-4 font-semibold">Nom Club</th>
                      <th className="text-left py-2 px-4 font-semibold">Catégorie</th>
                      <th className="text-left py-2 px-4 font-semibold">Participants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {race.race_crews
                      .sort((a, b) => a.lane - b.lane)
                      .map((rc) => (
                        <tr key={rc.id} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium">{rc.lane}</td>
                          <td className="py-3 px-4 font-semibold">{rc.crew?.club_code}</td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {rc.crew?.club_name}
                          </td>
                          <td className="py-3 px-4">
                            {rc.crew?.category?.label ? (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {rc.crew.category.label}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {rc.crew?.crew_participants && rc.crew.crew_participants.length > 0 ? (
                              <div className="text-sm">
                                {rc.crew.crew_participants
                                  .sort((a, b) => a.seat_position - b.seat_position)
                                  .map((cp, idx) => {
                                    const firstName = cp.participant?.first_name || "";
                                    const lastName = cp.participant?.last_name || "";
                                    // Format : Prénom complet + Nom complet
                                    const displayName = firstName && lastName
                                      ? `${firstName} ${lastName}`
                                      : lastName || firstName;
                                    return (
                                      <span key={cp.id}>
                                        {idx > 0 && <span className="text-muted-foreground"> • </span>}
                                        <span className={cp.is_coxswain ? "font-semibold" : ""}>
                                          {displayName}
                                          {cp.is_coxswain && (
                                            <span className="text-muted-foreground ml-1 text-xs">(B)</span>
                                          )}
                                        </span>
                                      </span>
                                    );
                                  })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {race.race_crews.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun équipage ne correspond aux filtres
                </p>
              )}
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              {hasActiveFilters
                ? "Aucun résultat ne correspond aux filtres sélectionnés"
                : "Aucune course programmée"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
