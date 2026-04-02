import { useEffect, useState, useRef, useMemo } from "react";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Save, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CrewInfoEditInitial = {
  club_name?: string;
  club_code?: string;
  category_id?: string;
  coach_name?: string;
};

type CategoryRow = {
  id: string;
  code: string;
  label: string;
  boat_seats: number;
  has_coxswain: boolean;
};

type ClubRow = { nom: string; code: string };

export function CrewInfoEditDialog({
  open,
  onOpenChange,
  eventId,
  crewId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | undefined;
  crewId: string | undefined;
  initial: CrewInfoEditInitial | null;
  /** Données équipage après GET /crews/:id */
  onSaved?: (crewData: any) => void;
}) {
  const { toast } = useToast();
  const [editForm, setEditForm] = useState({
    club_name: "",
    club_code: "",
    category_id: "",
    coach_name: "",
  });
  const [editCategories, setEditCategories] = useState<CategoryRow[]>([]);
  const [editClubs, setEditClubs] = useState<ClubRow[]>([]);
  const [loadingEditMeta, setLoadingEditMeta] = useState(false);
  const [savingCrewInfo, setSavingCrewInfo] = useState(false);
  const [clubPickerOpen, setClubPickerOpen] = useState(false);
  const [clubSearchQuery, setClubSearchQuery] = useState("");
  const clubPickerRef = useRef<HTMLDivElement>(null);
  const initialRef = useRef<CrewInfoEditInitial | null>(initial);
  initialRef.current = initial;

  const filteredClubs = useMemo(() => {
    const q = clubSearchQuery.trim().toLowerCase();
    if (!q) return editClubs;
    return editClubs.filter(
      (c) =>
        (c.nom || "").toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q)
    );
  }, [editClubs, clubSearchQuery]);

  useEffect(() => {
    if (!open) return;
    setClubSearchQuery("");
    setClubPickerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!clubPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (clubPickerRef.current && !clubPickerRef.current.contains(e.target as Node)) {
        setClubPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [clubPickerOpen]);

  useEffect(() => {
    if (!clubPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setClubPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [clubPickerOpen]);

  useEffect(() => {
    if (!open || !eventId || !crewId) return;

    const i = initialRef.current;
    if (i) {
      setEditForm({
        club_name: i.club_name || "",
        club_code: i.club_code || "",
        category_id: i.category_id || "",
        coach_name: i.coach_name || "",
      });
    }

    let cancelled = false;
    setLoadingEditMeta(true);
    Promise.all([api.get(`/event-categories/${eventId}`), api.get("/clubs")])
      .then(([catRes, clubRes]) => {
        if (cancelled) return;
        const eventCategoriesData = catRes.data.data || catRes.data || [];
        const formattedCategories = eventCategoriesData
          .map((eventCat: any) => {
            const category = eventCat.Category || eventCat.category;
            if (!category) return null;
            return {
              id: category.id,
              code: category.code || "",
              label: category.label || category.name || "",
              boat_seats: category.boat_seats || 0,
              has_coxswain: category.has_coxswain || false,
            };
          })
          .filter((cat: any) => cat !== null);
        setEditCategories(formattedCategories);

        const clubsData = clubRes.data.data || [];
        const sorted = [...clubsData].sort((a: any, b: any) =>
          (a.nom || "").localeCompare(b.nom || "")
        );
        setEditClubs(sorted.map((c: any) => ({ nom: c.nom, code: c.code })));
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error("Erreur chargement données édition équipage:", err);
        toast({
          title: "Erreur",
          description:
            err?.response?.data?.message ||
            "Impossible de charger les listes (catégories / clubs)",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingEditMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, eventId, crewId, toast]);

  const handleSaveCrewInfo = async () => {
    if (!crewId || !editForm.category_id) {
      toast({
        title: "Erreur",
        description: "La catégorie est obligatoire",
        variant: "destructive",
      });
      return;
    }
    setSavingCrewInfo(true);
    try {
      const body: Record<string, string> = {
        club_name: editForm.club_name.trim(),
        club_code: editForm.club_code.trim(),
        category_id: editForm.category_id,
      };
      const coach = editForm.coach_name.trim();
      if (coach) {
        body.coach_name = coach;
      }

      await api.put(`/crews/${crewId}`, body);

      const res = await api.get(`/crews/${crewId}`);
      const crewData = res.data.data || res.data;

      onSaved?.(crewData);
      onOpenChange(false);
      toast({
        title: "Informations mises à jour",
        description: "L'équipage a été enregistré.",
      });
    } catch (err: any) {
      console.error("Erreur mise à jour équipage:", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          "Impossible d'enregistrer les modifications",
        variant: "destructive",
      });
    } finally {
      setSavingCrewInfo(false);
    }
  };

  if (!crewId || !eventId) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Modifier l&apos;équipage
          </DialogTitle>
          <DialogDescription>
            Mettez à jour le club, la catégorie ou l&apos;entraîneur. Si vous changez la catégorie, vérifiez la
            composition des participants et les affectations aux courses.
          </DialogDescription>
        </DialogHeader>

        {loadingEditMeta ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2" ref={clubPickerRef}>
              <Label>Club (référentiel)</Label>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={clubPickerOpen}
                  className="w-full justify-between font-normal"
                  onClick={() => setClubPickerOpen((o) => !o)}
                >
                  <span className="truncate text-left">
                    {editForm.club_name || editForm.club_code
                      ? `${editForm.club_name || "—"}${editForm.club_code ? ` (${editForm.club_code})` : ""}`
                      : "Choisir un club dans la liste…"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
                {clubPickerOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Rechercher un club (nom ou code)…"
                        value={clubSearchQuery}
                        onChange={(e) => setClubSearchQuery(e.target.value)}
                        className="pl-8"
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <ScrollArea className="h-[220px]">
                      <div className="space-y-0.5 pr-3 pb-1">
                        {filteredClubs.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-3 text-center">
                            Aucun club ne correspond à la recherche
                          </p>
                        ) : (
                          filteredClubs.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              className={cn(
                                "w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                                editForm.club_code === c.code && "bg-accent"
                              )}
                              onClick={() => {
                                setEditForm((f) => ({ ...f, club_name: c.nom, club_code: c.code }));
                                setClubPickerOpen(false);
                                setClubSearchQuery("");
                              }}
                            >
                              <span className="font-medium">{c.nom}</span>{" "}
                              <span className="text-muted-foreground font-mono text-xs">({c.code})</span>
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="crew_info_edit_club_name">Nom du club</Label>
                <Input
                  id="crew_info_edit_club_name"
                  value={editForm.club_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, club_name: e.target.value }))}
                  placeholder="Ex: Aviron Club de Paris"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew_info_edit_club_code">Code club</Label>
                <Input
                  id="crew_info_edit_club_code"
                  value={editForm.club_code}
                  onChange={(e) => setEditForm((f) => ({ ...f, club_code: e.target.value }))}
                  placeholder="Ex: ACP"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Catégorie <span className="text-red-500">*</span>
              </Label>
              <Select
                value={
                  editCategories.some((c) => c.id === editForm.category_id)
                    ? editForm.category_id
                    : undefined
                }
                onValueChange={(v) => setEditForm((f) => ({ ...f, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {editCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.code ? `${cat.label || cat.code} (${cat.code})` : cat.label || cat.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="crew_info_edit_coach_name">Nom de l&apos;entraîneur (optionnel)</Label>
              <Input
                id="crew_info_edit_coach_name"
                value={editForm.coach_name}
                onChange={(e) => setEditForm((f) => ({ ...f, coach_name: e.target.value }))}
                placeholder="Ex: Jean Dupont"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={savingCrewInfo}>
            Annuler
          </Button>
          <Button onClick={handleSaveCrewInfo} disabled={loadingEditMeta || savingCrewInfo}>
            {savingCrewInfo ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
