import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Search,
  Building2,
  Award,
  User,
  Hash,
  Loader2,
  ArrowRight,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";

type Crew = {
  club_name: string;
  category: {
    code: string;
    label?: string;
  };
};

type CrewParticipant = {
  Crew: Crew;
  crew?: Crew;
};

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  club_name: string;
  license_number?: string;
  gender?: string;
  CrewParticipants?: CrewParticipant[];
  crew_participants?: CrewParticipant[];
};

export default function ParticipantsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

  useEffect(() => {
    async function fetchParticipants() {
      if (!eventId) {
        console.error("❌ eventId manquant dans l'URL");
        setLoading(false);
        return;
      }

      try {
        console.log("🔍 Récupération des participants pour l'événement:", eventId);
        const res = await api.get(`/participants/event/${eventId}`);
        console.log("✅ Réponse API participants:", res.data);
        
        const participantsData = res.data.data ?? [];
        
        // S'assurer que nous n'affichons que les participants de cet événement
        // Gérer les différentes structures possibles
        const filteredParticipants = participantsData.filter((p: Participant) => {
          const crewParticipants = p.crew_participants || p.CrewParticipants || [];
          return crewParticipants.length > 0;
        });
        
        console.log(`📊 ${filteredParticipants.length} participant(s) trouvé(s) pour l'événement ${eventId}`);
        setParticipants(filteredParticipants);
      } catch (err: any) {
        console.error("❌ Erreur chargement participants:", err);
        console.error("❌ Détails:", err.response?.data);
        console.error("❌ Status:", err.response?.status);
        setParticipants([]);
        toast({
          title: "Erreur",
          description: "Impossible de charger les participants",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchParticipants();
  }, [eventId, toast]);

  // Filtrage et tri
  const filteredAndSortedParticipants = useMemo(() => {
    let filtered = [...participants];

    // Filtrage par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        const club = (p.club_name || "").toLowerCase();
        const license = (p.license_number || "").toLowerCase();
        return (
          fullName.includes(query) ||
          club.includes(query) ||
          license.includes(query)
        );
      });
    }

    // Tri par catégorie puis par nom
    return filtered.sort((a, b) => {
      const crewA = a.crew_participants?.[0]?.crew || 
                    a.crew_participants?.[0]?.Crew ||
                    a.CrewParticipants?.[0]?.Crew ||
                    a.CrewParticipants?.[0]?.crew;
      const crewB = b.crew_participants?.[0]?.crew || 
                    b.crew_participants?.[0]?.Crew ||
                    b.CrewParticipants?.[0]?.Crew ||
                    b.CrewParticipants?.[0]?.crew;
      
      const codeA = crewA?.category?.code ?? "";
      const codeB = crewB?.category?.code ?? "";
      
      if (codeA !== codeB) {
        return codeA.localeCompare(codeB);
      }
      
      return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
    });
  }, [participants, searchQuery]);

  // Statistiques
  const stats = useMemo(() => {
    const total = participants.length;
    const uniqueClubs = new Set(participants.map((p) => p.club_name).filter(Boolean)).size;
    const uniqueCategories = new Set(
      participants
        .map((p) => {
          const crew = p.crew_participants?.[0]?.crew || 
                       p.crew_participants?.[0]?.Crew ||
                       p.CrewParticipants?.[0]?.Crew ||
                       p.CrewParticipants?.[0]?.crew;
          return crew?.category?.code;
        })
        .filter(Boolean)
    ).size;

    return { total, uniqueClubs, uniqueCategories };
  }, [participants]);

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
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 text-white p-6 shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Users className="w-8 h-8" />
            Participants
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <div className="text-sm text-purple-100 mb-1">Total participants</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <div className="text-sm text-purple-100 mb-1">Clubs représentés</div>
              <div className="text-3xl font-bold">{stats.uniqueClubs}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <div className="text-sm text-purple-100 mb-1">Catégories</div>
              <div className="text-3xl font-bold">{stats.uniqueCategories}</div>
            </div>
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
                placeholder="Rechercher par nom, club ou numéro de licence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
        </CardContent>
      </Card>

      {/* Liste des participants */}
      {filteredAndSortedParticipants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-semibold text-muted-foreground mb-2">
              {searchQuery ? "Aucun résultat trouvé" : "Aucun participant pour le moment"}
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
          {filteredAndSortedParticipants.map((p) => {
            const crew = p.crew_participants?.[0]?.crew || 
                         p.crew_participants?.[0]?.Crew ||
                         p.CrewParticipants?.[0]?.Crew ||
                         p.CrewParticipants?.[0]?.crew;
            const category = crew?.category;
            const crewName = crew?.club_name;

            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-500 group"
                onClick={() => navigate(`/event/${eventId}/participants/${p.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1 group-hover:text-purple-600 transition-colors">
                        {p.last_name} {p.first_name}
                      </h3>
                      {p.license_number && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Hash className="w-3.5 h-3.5" />
                          <span className="font-mono">{p.license_number}</span>
                        </div>
                      )}
                    </div>
                    {p.gender && (
                      <div className="flex-shrink-0">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                          {p.gender}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {p.club_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{p.club_name}</span>
                      </div>
                    )}

                    {category && (
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium text-slate-700">
                            {category.label || category.code}
                          </span>
                          {category.code && category.code !== category.label && (
                            <span className="text-muted-foreground ml-1">({category.code})</span>
                          )}
                        </div>
                      </div>
                    )}

                    {crewName && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Équipage: {crewName}</span>
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
                        navigate(`/event/${eventId}/participants/${p.id}`);
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead>Sexe</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Équipage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedParticipants.map((p) => {
                    const crew = p.crew_participants?.[0]?.crew || 
                                 p.crew_participants?.[0]?.Crew ||
                                 p.CrewParticipants?.[0]?.Crew ||
                                 p.CrewParticipants?.[0]?.crew;
                    const category = crew?.category;
                    const crewName = crew?.club_name;

                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/event/${eventId}/participants/${p.id}`)}
                      >
                        <TableCell className="font-semibold">{p.last_name}</TableCell>
                        <TableCell>{p.first_name}</TableCell>
                        <TableCell>
                          {p.license_number ? (
                            <span className="font-mono text-sm">{p.license_number}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.gender ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                              {p.gender}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {p.club_name ? (
                              <>
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span>{p.club_name}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {category ? (
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm">
                                  {category.label || category.code}
                                </div>
                                {category.code && category.code !== category.label && (
                                  <div className="text-xs text-muted-foreground">{category.code}</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {crewName ? (
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span>{crewName}</span>
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
                              navigate(`/event/${eventId}/participants/${p.id}`);
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
      {searchQuery && filteredAndSortedParticipants.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {filteredAndSortedParticipants.length} résultat{filteredAndSortedParticipants.length > 1 ? 's' : ''} trouvé{filteredAndSortedParticipants.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
