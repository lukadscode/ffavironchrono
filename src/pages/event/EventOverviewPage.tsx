import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import {
  CalendarDays,
  MapPin,
  Users,
  Flag,
  Clock,
  ExternalLink,
  Edit,
  Save,
  X,
  Building2,
  Trophy,
  Timer,
  Settings,
  Loader2,
  Ship,
  UserCheck,
  Award,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useEventRole } from "@/hooks/useEventRole";
import { ROLE_PERMISSIONS } from "@/router/EventProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import dayjs from "dayjs";

const DEFAULT_EVENT_IMAGE =
  "https://www.sports.gouv.fr/sites/default/files/2022-08/photo-2-emmelieke-odul-jpeg-813.jpeg";

export default function EventOverviewPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventRole = useEventRole();
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<{
    categoriesWithoutDistance: any[];
    phasesWithUnassignedCrews: Array<{ phaseId: string; phaseName: string; count: number }>;
  }>({
    categoriesWithoutDistance: [],
    phasesWithUnassignedCrews: [],
  });

  const [form, setForm] = useState({
    name: "",
    location: "",
    start_date: "",
    end_date: "",
    website_url: "",
    is_visible: true,
    is_finished: false,
  });

  useEffect(() => {
    fetchEvent();
    fetchStats();
    fetchAlerts();
  }, [eventId]);

  // Rafraîchir les alertes automatiquement toutes les 30 secondes
  useEffect(() => {
    if (!eventId) return;

    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, [eventId, fetchAlerts]);

  // Rafraîchir les alertes quand la page redevient visible
  useEffect(() => {
    if (!eventId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAlerts();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [eventId, fetchAlerts]);

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      const data = res.data.data;
      setEvent(data);
      setForm({
        name: data.name || "",
        location: data.location || "",
        start_date: data.start_date ? data.start_date.slice(0, 10) : "",
        end_date: data.end_date ? data.end_date.slice(0, 10) : "",
        website_url: data.website_url || "",
        is_visible: data.is_visible !== undefined ? data.is_visible : true,
        is_finished: data.is_finished !== undefined ? data.is_finished : false,
      });
    } catch (err: any) {
      console.error("Erreur chargement événement:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'événement.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Récupérer les statistiques depuis différentes API
      const [participantsRes, crewsRes, racesRes, timingsRes] = await Promise.all([
        api.get(`/participants/event/${eventId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/crews/event/${eventId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/races/event/${eventId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/timings/event/${eventId}`).catch(() => ({ data: { data: [] } })),
      ]);

      setStats({
        participants: participantsRes.data.data?.length || 0,
        crews: crewsRes.data.data?.length || 0,
        races: racesRes.data.data?.length || 0,
        timings: timingsRes.data.data?.length || 0,
      });
    } catch (err) {
      console.error("Erreur chargement statistiques:", err);
    }
  };

  const fetchAlerts = useCallback(async () => {
    if (!eventId) return;
    
    try {
      // Vérifier les catégories sans distance
      const categoriesRes = await api.get(`/categories/event/${eventId}/with-crews`).catch(() => ({ data: { data: [] } }));
      const categories = categoriesRes.data.data || [];
      const categoriesWithoutDistance = categories.filter((cat: any) => 
        cat.crew_count > 0 && (!cat.distance_id || cat.distance_id === null)
      );

      // Vérifier les phases avec équipages non affectés
      const phasesRes = await api.get(`/race-phases/${eventId}`).catch(() => ({ data: { data: [] } }));
      const phases = phasesRes.data.data || [];
      
      const phasesWithUnassignedCrews: Array<{ phaseId: string; phaseName: string; count: number }> = [];
      
      for (const phase of phases) {
        try {
          // Récupérer les courses de la phase
          const racesRes = await api.get(`/races/event/${eventId}`).catch(() => ({ data: { data: [] } }));
          const allRaces = racesRes.data.data || [];
          const phaseRaces = allRaces.filter((race: any) => race.race_phase?.id === phase.id);
          
          // Récupérer tous les équipages de l'événement
          const crewsRes = await api.get(`/crews/event/${eventId}`).catch(() => ({ data: { data: [] } }));
          const allCrews = crewsRes.data.data || [];
          
          // Récupérer les équipages affectés aux courses de cette phase
          const assignedCrewIds = new Set<string>();
          phaseRaces.forEach((race: any) => {
            if (race.race_crews) {
              race.race_crews.forEach((rc: any) => {
                if (rc.crew_id) {
                  assignedCrewIds.add(rc.crew_id);
                }
              });
            }
          });
          
          // Compter les équipages non affectés
          const unassignedCrews = allCrews.filter((crew: any) => !assignedCrewIds.has(crew.id));
          
          if (unassignedCrews.length > 0) {
            phasesWithUnassignedCrews.push({
              phaseId: phase.id,
              phaseName: phase.name,
              count: unassignedCrews.length,
            });
          }
        } catch (err) {
          console.error(`Erreur vérification phase ${phase.id}:`, err);
        }
      }

      setAlerts({
        categoriesWithoutDistance,
        phasesWithUnassignedCrews,
      });
    } catch (err) {
      console.error("Erreur chargement alertes:", err);
    }
  }, [eventId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm({ 
      ...form, 
      [name]: type === "checkbox" ? checked : value 
    });
  };


  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      // Construire le payload en omettant website_url si vide
      const payload: any = {
        name: form.name,
        location: form.location,
        start_date: form.start_date,
        end_date: form.end_date,
        is_visible: form.is_visible,
        is_finished: form.is_finished,
      };
      
      // N'inclure website_url que s'il n'est pas vide
      if (form.website_url && form.website_url.trim() !== "") {
        payload.website_url = form.website_url.trim();
      }
      
      const res = await api.put(`/events/${eventId}`, payload);
      setEvent(res.data.data);
      setEditing(false);
      
      // Rafraîchir les alertes après la mise à jour
      await fetchAlerts();
      
      toast({
        title: "Succès",
        description: "L'événement a été mis à jour avec succès.",
      });
    } catch (err: any) {
      console.error("Erreur mise à jour:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Erreur lors de la mise à jour";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (event) {
      setForm({
        name: event.name || "",
        location: event.location || "",
        start_date: event.start_date ? event.start_date.slice(0, 10) : "",
        end_date: event.end_date ? event.end_date.slice(0, 10) : "",
        website_url: event.website_url || "",
        is_visible: event.is_visible !== undefined ? event.is_visible : true,
        is_finished: event.is_finished !== undefined ? event.is_finished : false,
      });
    }
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-semibold text-red-600">
            Événement introuvable
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPast = new Date(event.end_date) < new Date();
  const isOngoing =
    new Date(event.start_date) <= new Date() &&
    new Date(event.end_date) >= new Date();
  const isUpcoming = new Date(event.start_date) > new Date();

  const eventImage = event.image_url || event.cover_url || DEFAULT_EVENT_IMAGE;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Section */}
      <div className="relative w-full h-48 sm:h-64 md:h-80 rounded-xl overflow-hidden shadow-lg">
        <img
          src={eventImage}
          alt={event.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_EVENT_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold break-words">{event.name}</h1>
                {isOngoing && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white border border-green-400">
                    En cours
                  </span>
                )}
                {isUpcoming && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white border border-blue-400">
                    À venir
                  </span>
                )}
                {isPast && !isOngoing && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-500 text-white border border-gray-400">
                    Terminé
                  </span>
                )}
                {event.race_type && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/80 text-white border border-purple-400">
                    {event.race_type}
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm md:text-base text-gray-200">
                {event.organiser_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="break-words">{event.organiser_name}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="break-words">{event.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">
                    {dayjs(event.start_date).format("DD MMM YYYY")} –{" "}
                    {dayjs(event.end_date).format("DD MMM YYYY")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {(alerts.categoriesWithoutDistance.length > 0 || alerts.phasesWithUnassignedCrews.length > 0) && (
        <Card className="border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-200">
                <AlertTriangle className="w-5 h-5 text-orange-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-900 mb-3">
                  Avertissements
                </h3>
                <div className="space-y-2">
                  {alerts.categoriesWithoutDistance.length > 0 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-orange-800 font-medium">
                          {alerts.categoriesWithoutDistance.length} {alerts.categoriesWithoutDistance.length === 1 ? "catégorie" : "catégories"} non affectée{alerts.categoriesWithoutDistance.length > 1 ? "s" : ""} à une distance
                        </p>
                        <p className="text-xs text-orange-700 mt-1">
                          {alerts.categoriesWithoutDistance.map((cat: any) => cat.label || cat.code).join(", ")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 border-orange-300 text-orange-700 hover:bg-orange-200"
                          onClick={() => navigate(`/event/${eventId}/distances`)}
                        >
                          Voir les distances
                        </Button>
                      </div>
                    </div>
                  )}
                  {alerts.phasesWithUnassignedCrews.length > 0 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-orange-800 font-medium">
                          Équipages non affectés dans {alerts.phasesWithUnassignedCrews.length} {alerts.phasesWithUnassignedCrews.length === 1 ? "phase" : "phases"}
                        </p>
                        <div className="text-xs text-orange-700 mt-1 space-y-1">
                          {alerts.phasesWithUnassignedCrews.map((phase) => (
                            <div key={phase.phaseId}>
                              {phase.phaseName}: {phase.count} {phase.count === 1 ? "équipage" : "équipages"} non affecté{phase.count > 1 ? "s" : ""}
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 border-orange-300 text-orange-700 hover:bg-orange-200"
                          onClick={() => navigate(`/event/${eventId}/racePhases`)}
                        >
                          Voir les phases
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Participants"
          value={stats?.participants ?? event.stats?.participants ?? "–"}
          color="text-blue-600"
          bgColor="bg-blue-100"
          onClick={() => navigate(`/event/${eventId}/participants`)}
        />
        <StatCard
          icon={<Ship className="w-5 h-5" />}
          label="Équipages"
          value={stats?.crews ?? event.stats?.crews ?? "–"}
          color="text-indigo-600"
          bgColor="bg-indigo-100"
          onClick={() => navigate(`/event/${eventId}/crews`)}
        />
        <StatCard
          icon={<Flag className="w-5 h-5" />}
          label="Courses"
          value={stats?.races ?? event.stats?.races ?? "–"}
          color="text-green-600"
          bgColor="bg-green-100"
          onClick={() => navigate(`/event/${eventId}/races`)}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Timings"
          value={stats?.timings ?? event.stats?.timings ?? "–"}
          color="text-orange-600"
          bgColor="bg-orange-100"
          onClick={() => navigate(`/event/${eventId}/timing`)}
        />
      </div>

      {/* Informations et édition */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Informations générales */}
        <Card className="shadow-md border-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Informations générales
              </h2>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold text-muted-foreground">
                  Nom de l'événement
                </Label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  disabled={!editing}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-muted-foreground">
                  Lieu
                </Label>
                <Input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  disabled={!editing}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">
                    Date de début
                  </Label>
                  <Input
                    type="date"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                    disabled={!editing}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">
                    Date de fin
                  </Label>
                  <Input
                    type="date"
                    name="end_date"
                    value={form.end_date}
                    onChange={handleChange}
                    disabled={!editing}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold text-muted-foreground">
                  Site web (optionnel)
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    name="website_url"
                    value={form.website_url}
                    onChange={handleChange}
                    disabled={!editing}
                    placeholder="https://..."
                  />
                  {form.website_url && (
                    <Button
                      variant="outline"
                      size="icon"
                      asChild
                      className="flex-shrink-0"
                    >
                      <a
                        href={form.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ouvrir le site web"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_visible"
                  checked={form.is_visible}
                  onCheckedChange={(checked) => setForm({ ...form, is_visible: checked as boolean })}
                  disabled={!editing}
                />
                <Label
                  htmlFor="is_visible"
                  className="text-sm font-semibold text-muted-foreground cursor-pointer"
                >
                  Rendre l'événement visible publiquement
                </Label>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="is_finished"
                    className="text-sm font-semibold text-muted-foreground cursor-pointer"
                  >
                    Marquer l'événement comme terminé
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Les événements terminés seront archivés et affichés dans les archives
                  </p>
                </div>
                <Switch
                  id="is_finished"
                  checked={form.is_finished}
                  onCheckedChange={(checked) => setForm({ ...form, is_finished: checked })}
                  disabled={!editing}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accès rapide */}
        <Card className="shadow-md border-2">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600" />
              Accès rapide
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {/* Participants - organisateur et éditeur */}
              {(isGlobalAdmin || eventRole === "organiser" || eventRole === "editor") && (
                <QuickLinkButton
                  icon={<Users className="w-4 h-4" />}
                  label="Participants"
                  onClick={() => navigate(`/event/${eventId}/participants`)}
                />
              )}
              {/* Équipages - organisateur et éditeur */}
              {(isGlobalAdmin || eventRole === "organiser" || eventRole === "editor") && (
                <QuickLinkButton
                  icon={<Ship className="w-4 h-4" />}
                  label="Équipages"
                  onClick={() => navigate(`/event/${eventId}/crews`)}
                />
              )}
              {/* Courses - organisateur et éditeur */}
              {(isGlobalAdmin || eventRole === "organiser" || eventRole === "editor") && (
                <QuickLinkButton
                  icon={<Flag className="w-4 h-4" />}
                  label="Courses"
                  onClick={() => navigate(`/event/${eventId}/races`)}
                />
              )}
              {/* Chronométrage - organisateur et chronométreur */}
              {(isGlobalAdmin || eventRole === "organiser" || eventRole === "timing") && (
                <QuickLinkButton
                  icon={<Timer className="w-4 h-4" />}
                  label="Chronométrage"
                  onClick={() => navigate(`/event/${eventId}/timing`)}
                />
              )}
              {/* Arbitres - organisateur et arbitre */}
              {(isGlobalAdmin || eventRole === "organiser" || eventRole === "referee") && (
                <QuickLinkButton
                  icon={<Award className="w-4 h-4" />}
                  label="Arbitres"
                  onClick={() => navigate(`/event/${eventId}/arbitres`)}
                />
              )}
              {/* Permissions - organisateur uniquement */}
              {(isGlobalAdmin || eventRole === "organiser") && (
                <QuickLinkButton
                  icon={<UserCheck className="w-4 h-4" />}
                  label="Permissions"
                  onClick={() => navigate(`/event/${eventId}/permissions`)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
  bgColor?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`shadow-md border-2 transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-lg hover:border-purple-400" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${bgColor || "bg-purple-100"} ${color || "text-purple-600"}`}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold mb-1">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLinkButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300 transition-colors"
      onClick={onClick}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}
