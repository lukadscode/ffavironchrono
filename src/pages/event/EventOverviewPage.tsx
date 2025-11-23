import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";

const DEFAULT_EVENT_IMAGE =
  "https://www.sports.gouv.fr/sites/default/files/2022-08/photo-2-emmelieke-odul-jpeg-813.jpeg";

export default function EventOverviewPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const [form, setForm] = useState({
    name: "",
    location: "",
    start_date: "",
    end_date: "",
    website_url: "",
  });

  useEffect(() => {
    fetchEvent();
    fetchStats();
  }, [eventId]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const res = await api.put(`/events/${eventId}`, form);
      setEvent(res.data.data);
      setEditing(false);
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
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden shadow-lg">
        <img
          src={eventImage}
          alt={event.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_EVENT_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold">{event.name}</h1>
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
              <div className="flex items-center gap-4 text-sm md:text-base text-gray-200 flex-wrap">
                {event.organiser_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>{event.organiser_name}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    {dayjs(event.start_date).format("DD MMM YYYY")} –{" "}
                    {dayjs(event.end_date).format("DD MMM YYYY")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  Site web
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
              <QuickLinkButton
                icon={<Users className="w-4 h-4" />}
                label="Participants"
                onClick={() => navigate(`/event/${eventId}/participants`)}
              />
              <QuickLinkButton
                icon={<Ship className="w-4 h-4" />}
                label="Équipages"
                onClick={() => navigate(`/event/${eventId}/crews`)}
              />
              <QuickLinkButton
                icon={<Flag className="w-4 h-4" />}
                label="Courses"
                onClick={() => navigate(`/event/${eventId}/races`)}
              />
              <QuickLinkButton
                icon={<Timer className="w-4 h-4" />}
                label="Chronométrage"
                onClick={() => navigate(`/event/${eventId}/timing`)}
              />
              <QuickLinkButton
                icon={<Award className="w-4 h-4" />}
                label="Arbitres"
                onClick={() => navigate(`/event/${eventId}/arbitres`)}
              />
              <QuickLinkButton
                icon={<UserCheck className="w-4 h-4" />}
                label="Permissions"
                onClick={() => navigate(`/event/${eventId}/permissions`)}
              />
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
