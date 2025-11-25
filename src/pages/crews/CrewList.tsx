import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Rows,
  Search,
  Building2,
  Award,
  Users,
  Hash,
  ArrowRight,
  LayoutGrid,
  Table as TableIcon,
  Plus,
} from "lucide-react";

export default function CrewList() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [crews, setCrews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

  useEffect(() => {
    async function fetchCrews() {
      if (!eventId) {
        setLoading(false);
        return;
      }

      try {
        console.log("🔍 Récupération des équipages pour l'événement:", eventId);
        const res = await api.get(`/crews/event/${eventId}`);
        console.log("✅ Réponse API crews:", res.data);
        
        const crewsData = res.data.data || [];
        
        // Trier par catégorie puis par club
        const sorted = crewsData.sort((a: any, b: any) => {
          const codeA = a.category?.code || "";
          const codeB = b.category?.code || "";
          if (codeA !== codeB) {
            return codeA.localeCompare(codeB);
          }
          return (a.club_name || "").localeCompare(b.club_name || "");
        });
        
        setCrews(sorted);
      } catch (err: any) {
        console.error("❌ Erreur chargement crews:", err);
        console.error("❌ Détails:", err.response?.data);
        console.error("❌ Status:", err.response?.status);
        setCrews([]);
        toast({
          title: "Erreur",
          description: "Impossible de charger les équipages",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchCrews();
  }, [eventId, toast]);

  // Filtrage et tri
  const filteredAndSortedCrews = useMemo(() => {
    let filtered = [...crews];

    // Filtrage par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((crew) => {
        const club = (crew.club_name || "").toLowerCase();
        const clubCode = (crew.club_code || "").toLowerCase();
        const categoryCode = (crew.category?.code || "").toLowerCase();
        const categoryLabel = (crew.category?.label || "").toLowerCase();
        return (
          club.includes(query) ||
          clubCode.includes(query) ||
          categoryCode.includes(query) ||
          categoryLabel.includes(query)
        );
      });
    }

    return filtered;
  }, [crews, searchQuery]);

  // Vérifier si les données de participants sont disponibles
  const hasParticipantsData = useMemo(() => {
    return crews.some((crew) => {
      const participants = crew.crew_participants || 
                          crew.CrewParticipants || 
                          crew.crewParticipants;
      return participants && Array.isArray(participants) && participants.length > 0;
    });
  }, [crews]);

  // Statistiques
  const stats = useMemo(() => {
    const total = crews.length;
    const uniqueClubs = new Set(crews.map((c) => c.club_name).filter(Boolean)).size;
    const uniqueCategories = new Set(
      crews.map((c) => c.category?.code).filter(Boolean)
    ).size;
    
    let totalParticipants = 0;
    if (hasParticipantsData) {
      totalParticipants = crews.reduce((sum, crew) => {
        const participants = crew.crew_participants || 
                            crew.CrewParticipants || 
                            crew.crewParticipants || 
                            [];
        return sum + (Array.isArray(participants) ? participants.length : 0);
      }, 0);
    }

    return { total, uniqueClubs, uniqueCategories, totalParticipants, hasParticipantsData };
  }, [crews, hasParticipantsData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white p-4 sm:p-6 shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Rows className="w-8 h-8" />
            Équipages
          </h1>

          <div className={`grid grid-cols-1 gap-4 ${stats.hasParticipantsData ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <div className="text-sm text-blue-100 mb-1">Total équipages</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <div className="text-sm text-blue-100 mb-1">Clubs représentés</div>
              <div className="text-3xl font-bold">{stats.uniqueClubs}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <div className="text-sm text-blue-100 mb-1">Catégories</div>
              <div className="text-3xl font-bold">{stats.uniqueCategories}</div>
            </div>
            {stats.hasParticipantsData && (
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
                <div className="text-sm text-blue-100 mb-1">Total participants</div>
                <div className="text-3xl font-bold">{stats.totalParticipants}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barre de recherche et toggle d'affichage */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Rechercher par club, code club ou catégorie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => navigate(`/event/${eventId}/crews/new`)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvel équipage
              </Button>
              <div className="flex gap-2 border rounded-lg p-1 bg-muted">
                <Button
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="flex-1"
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Cartes
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="flex-1"
                >
                  <TableIcon className="w-4 h-4 mr-2" />
                  Tableau
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des équipages */}
      {filteredAndSortedCrews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Rows className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-semibold text-muted-foreground mb-2">
              {searchQuery ? "Aucun résultat trouvé" : "Aucun équipage pour le moment"}
            </p>
            {searchQuery && (
              <p className="text-sm text-muted-foreground">
                Essayez avec d'autres mots-clés
              </p>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        // Vue en cartes
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedCrews.map((crew) => {
            const participants = crew.crew_participants || 
                                crew.CrewParticipants || 
                                crew.crewParticipants || 
                                [];
            const participantsCount = participants.length;

            return (
              <Card
                key={crew.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-500 group"
                onClick={() => navigate(`/event/${eventId}/crews/${crew.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1 group-hover:text-blue-600 transition-colors">
                        {crew.club_name || "Club inconnu"}
                      </h3>
                      {crew.club_code && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Hash className="w-3.5 h-3.5" />
                          <span className="font-mono">{crew.club_code}</span>
                        </div>
                      )}
                    </div>
                    {crew.category && (
                      <div className="flex-shrink-0">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                          {crew.category.code}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {crew.category && (
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium text-slate-700">
                            {crew.category.label || crew.category.code}
                          </span>
                          {crew.category.code && crew.category.code !== crew.category.label && (
                            <span className="text-muted-foreground ml-1">({crew.category.code})</span>
                          )}
                        </div>
                      </div>
                    )}

                    {hasParticipantsData && participantsCount > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {participantsCount} participant{participantsCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}

                    {crew.category?.boat_seats && (
                      <div className="flex items-center gap-2 text-sm">
                        <Rows className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {crew.category.boat_seats} place{crew.category.boat_seats > 1 ? 's' : ''}
                          {crew.category.has_coxswain && " (avec barreur)"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/event/${eventId}/crews/${crew.id}`);
                      }}
                    >
                      Voir les détails
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // Vue en tableau
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Code catégorie</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Code club</TableHead>
                    {hasParticipantsData && <TableHead>Participants</TableHead>}
                    <TableHead>Places</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedCrews.map((crew) => {
                    const participants = crew.crew_participants || 
                                        crew.CrewParticipants || 
                                        crew.crewParticipants || 
                                        [];
                    const participantsCount = participants.length;

                    return (
                      <TableRow
                        key={crew.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/event/${eventId}/crews/${crew.id}`)}
                      >
                        <TableCell>
                          {crew.category ? (
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">
                                {crew.category.label || crew.category.code || "—"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {crew.category?.code ? (
                            <span className="font-mono text-sm">{crew.category.code}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold">{crew.club_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {crew.club_code ? (
                            <span className="font-mono text-sm">{crew.club_code}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {hasParticipantsData && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span>{participantsCount}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          {crew.category?.boat_seats ? (
                            <div className="flex items-center gap-2">
                              <Rows className="w-4 h-4 text-muted-foreground" />
                              <span>
                                {crew.category.boat_seats}
                                {crew.category.has_coxswain && (
                                  <span className="text-muted-foreground text-xs ml-1">(+ barreur)</span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/event/${eventId}/crews/${crew.id}`);
                            }}
                          >
                            Voir
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compteur de résultats */}
      {searchQuery && filteredAndSortedCrews.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {filteredAndSortedCrews.length} résultat{filteredAndSortedCrews.length > 1 ? 's' : ''} trouvé{filteredAndSortedCrews.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
