import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, ArrowLeft, CheckCircle2, XCircle, Info, Users, Ship, Flag, MapPin, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UpdateResult {
  event_id: string;
  name: string;
  new_categories_count: number;
  new_crews_count: number;
  new_participants_count: number;
  total_participants_count: number;
  new_distances_count: number;
  new_categories?: Array<{
    id: string;
    code: string;
    label: string;
    age_group: string | null;
    gender: string;
    boat_seats: number | null;
    has_coxswain: boolean;
    distance_id: string | null;
  }>;
  new_distances?: Array<{
    id: string;
    meters: number | null;
    is_time_based: boolean;
    duration_seconds: number | null;
    is_relay: boolean;
    relay_count: number | null;
    label: string;
  }>;
  new_crews?: Array<{
    id: string;
    category_id: string;
    category_code: string;
    category_label: string;
    club_name: string;
    club_code: string;
    status: number;
  }>;
  new_participants?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    license_number: string | null;
    gender: string;
    club_name: string;
    crew_id: string;
    crew_club: string;
    is_coxswain: boolean;
    seat_position: number | null;
  }>;
}

export default function EventUpdatePage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<any>(null);
  const [manifestationId, setManifestationId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    if (!eventId) return;
    
    try {
      setLoadingEvent(true);
      const res = await api.get(`/events/${eventId}`);
      const data = res.data.data;
      setEvent(data);
      // Récupérer le manifestation_id depuis l'événement (peut être dans différents champs)
      setManifestationId(data.manifestation_id || data.ffaviron_id || data.external_id || "");
    } catch (err: any) {
      console.error("Erreur chargement événement:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'événement.",
        variant: "destructive",
      });
    } finally {
      setLoadingEvent(false);
    }
  };

  const handleUpdate = async () => {
    if (!eventId || !manifestationId) {
      toast({
        title: "Erreur",
        description: "L'ID de la manifestation FFAviron est requis.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setUpdateResult(null);

    try {
      const response = await api.post(
        `/import/manifestation/${manifestationId}/update`,
        {
          event_id: eventId,
        }
      );

      if (response.data.status === "success") {
        setUpdateResult(response.data.data);
        toast({
          title: "Succès",
          description: "L'événement a été mis à jour avec succès.",
        });
      } else {
        throw new Error(response.data.message || "Erreur lors de la mise à jour");
      }
    } catch (err: any) {
      console.error("Erreur mise à jour:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.details?.message ||
        err?.message ||
        "Une erreur est survenue lors de la mise à jour";
      setError(errorMessage);
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingEvent) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/event/${eventId}`)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <RefreshCw className="w-8 h-8" />
            Mise à jour depuis FFAviron
          </h1>
          <p className="text-muted-foreground mt-1">
            Synchronisez votre événement avec les dernières données de l'API FFAviron
          </p>
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!manifestationId ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                L'ID de la manifestation FFAviron n'a pas été trouvé pour cet événement. 
                Veuillez contacter un administrateur pour configurer cet événement.
              </AlertDescription>
            </Alert>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Cette action va synchroniser votre événement avec les dernières données de l'API FFAviron.
                Seuls les nouveaux éléments seront ajoutés, sans modifier les données existantes.
              </p>
              <Button
                onClick={handleUpdate}
                disabled={loading || !manifestationId || !eventId}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mise à jour en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Mettre à jour l'événement
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Erreur */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Résultats */}
      {updateResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Résultats de la mise à jour
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Statistiques globales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Flag className="w-5 h-5" />}
                label="Nouvelles catégories"
                value={updateResult.new_categories_count}
                color="text-blue-600"
                bgColor="bg-blue-100"
              />
              <StatCard
                icon={<Ship className="w-5 h-5" />}
                label="Nouveaux équipages"
                value={updateResult.new_crews_count}
                color="text-indigo-600"
                bgColor="bg-indigo-100"
              />
              <StatCard
                icon={<Users className="w-5 h-5" />}
                label="Nouveaux participants"
                value={updateResult.new_participants_count}
                color="text-green-600"
                bgColor="bg-green-100"
              />
              <StatCard
                icon={<MapPin className="w-5 h-5" />}
                label="Nouvelles distances"
                value={updateResult.new_distances_count}
                color="text-purple-600"
                bgColor="bg-purple-100"
              />
            </div>

            {/* Détails des nouvelles catégories */}
            {updateResult.new_categories && updateResult.new_categories.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Flag className="w-5 h-5" />
                  Nouvelles catégories ({updateResult.new_categories.length})
                </h3>
                <ScrollArea className="h-[200px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {updateResult.new_categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{cat.label}</div>
                          <div className="text-sm text-muted-foreground">
                            Code: {cat.code} • {cat.gender} • {cat.age_group || "N/A"}
                            {cat.boat_seats && ` • ${cat.boat_seats} places`}
                            {cat.has_coxswain && " • Avec barreur"}
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Détails des nouvelles distances */}
            {updateResult.new_distances && updateResult.new_distances.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Nouvelles distances ({updateResult.new_distances.length})
                </h3>
                <ScrollArea className="h-[150px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {updateResult.new_distances.map((dist) => (
                      <div
                        key={dist.id}
                        className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{dist.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {dist.meters}m {dist.is_relay && `• Relais ${dist.relay_count}x`}
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Détails des nouveaux équipages */}
            {updateResult.new_crews && updateResult.new_crews.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Ship className="w-5 h-5" />
                  Nouveaux équipages ({updateResult.new_crews.length})
                </h3>
                <ScrollArea className="h-[300px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {updateResult.new_crews.map((crew) => (
                      <div
                        key={crew.id}
                        className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{crew.club_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {crew.category_label} • Code: {crew.club_code}
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Détails des nouveaux participants */}
            {updateResult.new_participants && updateResult.new_participants.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Nouveaux participants ({updateResult.new_participants.length})
                </h3>
                <div className="mb-2 text-sm text-muted-foreground">
                  Total participants liés aux nouveaux équipages: {updateResult.total_participants_count}
                </div>
                <ScrollArea className="h-[300px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {updateResult.new_participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {participant.first_name} {participant.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {participant.license_number && `Licence: ${participant.license_number} • `}
                            {participant.gender} • {participant.club_name}
                            {participant.is_coxswain && " • Barreur"}
                            {participant.seat_position && ` • Position: ${participant.seat_position}`}
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Message si rien n'a été ajouté */}
            {updateResult.new_categories_count === 0 &&
              updateResult.new_crews_count === 0 &&
              updateResult.new_participants_count === 0 &&
              updateResult.new_distances_count === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Aucun nouvel élément n'a été ajouté. L'événement est déjà à jour avec les données de l'API FFAviron.
                  </AlertDescription>
                </Alert>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
  bgColor?: string;
}) {
  return (
    <div className={`p-4 rounded-lg border-2 ${bgColor || "bg-gray-100"} ${color || "text-gray-600"}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded ${bgColor || "bg-gray-200"}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

