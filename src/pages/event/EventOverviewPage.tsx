import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import {
  CalendarDays,
  MapPin,
  Users,
  Flag,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function EventOverviewPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    name: "",
    location: "",
    start_date: "",
    end_date: "",
    website_url: "",
  });

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await api.get(`/events/${eventId}`);
        const data = res.data.data;
        setEvent(data);
        setForm({
          name: data.name,
          location: data.location,
          start_date: data.start_date.slice(0, 10),
          end_date: data.end_date.slice(0, 10),
          website_url: data.website_url || "",
        });
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de charger l’événement.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [eventId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      const res = await api.put(`/events/${eventId}`, form);
      setEvent(res.data.data);
      setEditing(false);
      toast({
        title: "Événement mis à jour",
        description: "Les modifications ont été enregistrées.",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Mise à jour impossible",
        variant: "destructive",
      });
    }
  };

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (!event) return <p className="text-red-500">Événement introuvable</p>;

  const isPast = new Date(event.end_date) < new Date();
  const isOngoing =
    new Date(event.start_date) <= new Date() &&
    new Date(event.end_date) >= new Date();

  return (
    <div className="space-y-8 p-4 md:p-6 rounded-lg">
      {/* Image de couverture */}
      <div className="relative w-full h-56 md:h-72 lg:h-80 rounded-xl overflow-hidden shadow">
        <img
          src={event.cover_url || "https://scontent-cdg4-2.xx.fbcdn.net/v/t39.30808-6/514405895_1143508564484096_3200406033265014122_n.jpg?stp=dst-jpg_s960x960_tt6&_nc_cat=107&ccb=1-7&_nc_sid=cc71e4&_nc_ohc=HPiCWrtgQgUQ7kNvwGgeg9V&_nc_oc=AdmVVbSWq36nfIF5-qyCM8jeKbFmgStxOU2LyUzKnx5RiWHFrRSuWaDLzQFwC8g7QI9WttPiUKVKXVNpnUr-Ggja&_nc_zt=23&_nc_ht=scontent-cdg4-2.xx&_nc_gid=QgDC6ZdG_LbIYIQ_Ttv3jw&oh=00_AfM0f43bAxavOQsTn75AljbgCvEAbsD3prUCCt9bBSPzTQ&oe=686C35C0"}
          alt={event.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10 text-white p-6 flex flex-col justify-end">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            {event.name}
            {isOngoing && (
              <span className="bg-green-500/80 text-white text-xs px-2 py-0.5 rounded-full">
                En cours
              </span>
            )}
            {isPast && !isOngoing && (
              <span className="bg-gray-400/80 text-white text-xs px-2 py-0.5 rounded-full">
                Terminé
              </span>
            )}
          </h1>
          <p className="text-sm md:text-base text-gray-200">
            {event.organiser_name} • {event.location}
          </p>
          <p className="text-sm text-gray-300">
            {new Date(event.start_date).toLocaleDateString()} –{" "}
            {new Date(event.end_date).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Stats dynamiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Participants"
          value={event.stats?.participants ?? "–"}
        />
        <StatCard
          icon={<Flag className="w-4 h-4" />}
          label="Courses"
          value={event.stats?.races ?? "–"}
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Chronos saisis"
          value={event.stats?.timings ?? "–"}
        />
      </div>

      {/* Formulaire d'édition */}
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Modifier l’événement</h2>
          {!editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              ✏️ Modifier
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit}>Enregistrer</Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <Label>Nom</Label>
            <Input
              name="name"
              value={form.name}
              onChange={handleChange}
              disabled={!editing}
            />
          </div>
          <div>
            <Label>Lieu</Label>
            <Input
              name="location"
              value={form.location}
              onChange={handleChange}
              disabled={!editing}
            />
          </div>
          <div>
            <Label>Date de début</Label>
            <Input
              type="date"
              name="start_date"
              value={form.start_date}
              onChange={handleChange}
              disabled={!editing}
            />
          </div>
          <div>
            <Label>Date de fin</Label>
            <Input
              type="date"
              name="end_date"
              value={form.end_date}
              onChange={handleChange}
              disabled={!editing}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Site web</Label>
            <Input
              name="website_url"
              value={form.website_url}
              onChange={handleChange}
              disabled={!editing}
              placeholder="https://..."
            />
          </div>
        </div>
        {event.website_url && (
          <div className="pt-4">
            <a
              href={event.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Voir le site officiel
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white dark:bg-secondary rounded-xl shadow p-4 flex items-center gap-4">
      <div className="p-2 bg-muted rounded">{icon}</div>
      <div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
