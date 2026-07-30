import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import {
  type CaptureMode,
  type TimingProfile,
  type TimingProfileInput,
  CAPTURE_MODE_LABELS,
  listTimingProfiles,
  createTimingProfile,
  updateTimingProfile,
  deleteTimingProfile,
  setEventDefaultTimingProfile,
} from "@/api/timingProfiles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  SlidersHorizontal,
  Star,
  Trash2,
  Loader2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { AdminPage } from "@/components/layout/AdminPage";
import { StatCard } from "@/components/layout/StatCard";

const ALL_MODES: CaptureMode[] = ["lane_first", "top_first", "free_read", "crew_follow"];

function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

const DEFAULT_FORM: TimingProfileInput = {
  name: "",
  allowed_capture_modes: ALL_MODES,
  default_capture_mode: "lane_first",
  requires_lane_selection: true,
  allow_raw_capture: true,
  allow_status_shortcuts: true,
  allow_penalties: false,
  auto_start_on_first_detection: false,
  auto_dns_after_minutes: null,
  splits_enabled: false,
  is_default: false,
};

export default function TimingProfilesPage() {
  const { eventId } = useParams();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<TimingProfile[]>([]);
  const [eventDefaultId, setEventDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TimingProfile | null>(null);
  const [form, setForm] = useState<TimingProfileInput>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TimingProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchAll = async () => {
    if (!eventId) return;
    try {
      const [profilesRes, eventRes] = await Promise.all([
        listTimingProfiles(eventId),
        api.get(`/events/${eventId}`),
      ]);
      setProfiles(profilesRes.filter((p) => p.event_id === eventId));
      setEventDefaultId(eventRes.data.data?.timing_profile_id ?? null);
    } catch (err) {
      console.error("Erreur chargement profils de chronométrage:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les profils de chronométrage.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingProfile(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (profile: TimingProfile) => {
    setEditingProfile(profile);
    setForm({
      name: profile.name,
      allowed_capture_modes: profile.allowed_capture_modes,
      default_capture_mode: profile.default_capture_mode,
      requires_lane_selection: profile.requires_lane_selection,
      allow_raw_capture: profile.allow_raw_capture,
      allow_status_shortcuts: profile.allow_status_shortcuts,
      allow_penalties: profile.allow_penalties,
      auto_start_on_first_detection: profile.auto_start_on_first_detection,
      auto_dns_after_minutes: profile.auto_dns_after_minutes,
      splits_enabled: profile.splits_enabled,
      is_default: profile.is_default,
    });
    setDialogOpen(true);
  };

  const toggleMode = (mode: CaptureMode) => {
    setForm((prev) => {
      const has = prev.allowed_capture_modes.includes(mode);
      const next = has
        ? prev.allowed_capture_modes.filter((m) => m !== mode)
        : [...prev.allowed_capture_modes, mode];
      return {
        ...prev,
        allowed_capture_modes: next,
        default_capture_mode: next.includes(prev.default_capture_mode)
          ? prev.default_capture_mode
          : next[0] ?? prev.default_capture_mode,
      };
    });
  };

  const handleSave = async () => {
    if (!eventId || !form.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du profil est requis",
        variant: "destructive",
      });
      return;
    }
    if (form.allowed_capture_modes.length === 0) {
      toast({
        title: "Erreur",
        description: "Sélectionnez au moins un mode de capture",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingProfile) {
        const updated = await updateTimingProfile(editingProfile.id, form);
        setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        toast({ title: "Succès", description: "Profil mis à jour" });
      } else {
        const created = await createTimingProfile(eventId, form);
        setProfiles((prev) => [...prev, created]);
        toast({ title: "Succès", description: "Profil de chronométrage créé" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: getErrorMessage(err, "Erreur lors de l'enregistrement"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTimingProfile(deleteTarget.id);
      setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (eventDefaultId === deleteTarget.id) setEventDefaultId(null);
      setDeleteTarget(null);
      toast({ title: "Succès", description: "Profil supprimé" });
    } catch (err) {
      toast({
        title: "Erreur",
        description: getErrorMessage(err, "Erreur lors de la suppression"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetEventDefault = async (profileId: string) => {
    if (!eventId) return;
    try {
      await setEventDefaultTimingProfile(eventId, profileId);
      setEventDefaultId(profileId);
      toast({ title: "Succès", description: "Profil défini par défaut pour l'événement" });
    } catch (err) {
      toast({
        title: "Erreur",
        description: getErrorMessage(err, "Impossible de définir le profil par défaut"),
        variant: "destructive",
      });
    }
  };

  const defaultProfileCount = useMemo(
    () => profiles.filter((p) => p.is_default).length,
    [profiles]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
      </div>
    );
  }

  return (
    <AdminPage
      title="Profils de chronométrage"
      description="Configurez les règles de chronométrage (modes de capture, statuts rapides, pénalités...) — c'est ce qui donne toute liberté à l'organisateur sur le terrain."
      icon={SlidersHorizontal}
      actions={
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau profil
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Profils configurés" value={profiles.length} icon={SlidersHorizontal} />
        <StatCard label="Profils par défaut" value={defaultProfileCount} icon={Star} />
        <StatCard
          label="Profil par défaut événement"
          value={profiles.find((p) => p.id === eventDefaultId)?.name ?? "Profil système"}
          icon={Star}
        />
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <SlidersHorizontal className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-semibold text-muted-foreground mb-2">
              Aucun profil personnalisé
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Sans profil, le poste de chronométrage utilise un profil système permissif
              (tous les modes de capture activés). Créez un profil pour l'adapter à votre
              événement.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Créer un profil
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} className="border-2 hover:border-orange-300 transition-colors">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold">{profile.name}</h3>
                  <div className="flex gap-1">
                    {profile.id === eventDefaultId ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-300">
                        Défaut événement
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {profile.allowed_capture_modes.map((mode) => (
                    <span
                      key={mode}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        mode === profile.default_capture_mode
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {CAPTURE_MODE_LABELS[mode]}
                    </span>
                  ))}
                </div>

                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>{profile.allow_raw_capture ? "✓" : "✕"} Lecture brute sans couloir</li>
                  <li>{profile.allow_status_shortcuts ? "✓" : "✕"} Statuts rapides DNS/DNF/DSQ</li>
                  <li>{profile.allow_penalties ? "✓" : "✕"} Pénalités / bonifications</li>
                  <li>
                    {profile.auto_start_on_first_detection ? "✓" : "✕"} Départ auto 1ère détection
                  </li>
                  <li>{profile.splits_enabled ? "✓" : "✕"} Splits intermédiaires</li>
                  {profile.auto_dns_after_minutes ? (
                    <li>⏱ DNS auto après {profile.auto_dns_after_minutes} min</li>
                  ) : null}
                </ul>

                <div className="flex gap-2 pt-3 border-t">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(profile)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Modifier
                  </Button>
                  {profile.id !== eventDefaultId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetEventDefault(profile.id)}
                      title="Définir comme profil par défaut de l'événement"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </Button>
                  ) : null}
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(profile)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog création/édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Modifier le profil" : "Nouveau profil de chronométrage"}</DialogTitle>
            <DialogDescription>
              Ces règles s'appliquent au poste de chronométrage mobile lorsqu'il chronomètre
              une course de cet événement.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nom du profil *</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex : Sprint bassin, Fond avec pénalités..."
              />
            </div>

            <div className="space-y-2">
              <Label>Modes de capture autorisés *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODES.map((mode) => (
                  <label key={mode} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox
                      checked={form.allowed_capture_modes.includes(mode)}
                      onCheckedChange={() => toggleMode(mode)}
                    />
                    {CAPTURE_MODE_LABELS[mode]}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mode de capture par défaut</Label>
              <Select
                value={form.default_capture_mode}
                onValueChange={(v) => setForm((p) => ({ ...p, default_capture_mode: v as CaptureMode }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {form.allowed_capture_modes.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {CAPTURE_MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <ToggleRow
                label="Sélection du couloir requise"
                checked={form.requires_lane_selection}
                onChange={(v) => setForm((p) => ({ ...p, requires_lane_selection: v }))}
              />
              <ToggleRow
                label="Autoriser la lecture brute (sans couloir)"
                checked={form.allow_raw_capture}
                onChange={(v) => setForm((p) => ({ ...p, allow_raw_capture: v }))}
              />
              <ToggleRow
                label="Statuts rapides DNS / DNF / DSQ"
                checked={form.allow_status_shortcuts}
                onChange={(v) => setForm((p) => ({ ...p, allow_status_shortcuts: v }))}
              />
              <ToggleRow
                label="Pénalités / bonifications"
                checked={form.allow_penalties}
                onChange={(v) => setForm((p) => ({ ...p, allow_penalties: v }))}
              />
              <ToggleRow
                label="Départ auto à la 1ère détection"
                checked={form.auto_start_on_first_detection}
                onChange={(v) => setForm((p) => ({ ...p, auto_start_on_first_detection: v }))}
              />
              <ToggleRow
                label="Splits intermédiaires"
                checked={form.splits_enabled}
                onChange={(v) => setForm((p) => ({ ...p, splits_enabled: v }))}
              />
              <ToggleRow
                label="Profil par défaut du club/organisateur"
                checked={form.is_default}
                onChange={(v) => setForm((p) => ({ ...p, is_default: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-dns">DNS automatique après (minutes, optionnel)</Label>
              <Input
                id="auto-dns"
                type="number"
                min="1"
                value={form.auto_dns_after_minutes ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    auto_dns_after_minutes: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
                placeholder="Ex : 15"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingProfile ? "Enregistrer" : "Créer le profil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="pt-4">
              Êtes-vous sûr de vouloir supprimer le profil{" "}
              <span className="font-semibold text-red-600">"{deleteTarget?.name}"</span> ? Les
              courses qui l'utilisaient retomberont sur le profil par défaut de l'événement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
