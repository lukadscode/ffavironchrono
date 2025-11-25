import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Loader2, GripVertical, Tag, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  eventId: string;
  phases: { id: string; name: string }[];
  onSuccess: () => void;
}

interface Category {
  id: string;
  code: string;
  label: string;
  crew_count: number;
}

function SortableCategoryItem({ category }: { category: Category }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 border rounded-lg bg-white ${
        isDragging ? "shadow-lg border-blue-500" : "border-gray-200 hover:border-blue-300"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-blue-600"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-slate-900">{category.code}</div>
        <div className="text-xs text-slate-600 truncate">{category.label}</div>
        <div className="text-xs text-slate-500 mt-1">
          {category.crew_count} {category.crew_count === 1 ? "équipage" : "équipages"}
        </div>
      </div>
    </div>
  );
}

export default function GenerateRacesDialog({ eventId, phases, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [phaseId, setPhaseId] = useState<string>();
  const [laneCount, setLaneCount] = useState<number>(6);
  const [startTime, setStartTime] = useState<string>(""); // datetime-local
  const [intervalMinutes, setIntervalMinutes] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCategoryOrder, setShowCategoryOrder] = useState(false);
  const { toast } = useToast();

  // Charger les catégories de l'événement
  useEffect(() => {
    const fetchCategories = async () => {
      if (!eventId) return;
      
      try {
        setLoadingCategories(true);
        const res = await api.get(`/categories/event/${eventId}/with-crews`);
        const categoriesData = res.data.data || [];
        
        // Filtrer seulement les catégories avec équipages
        const categoriesWithCrews = categoriesData
          .filter((cat: any) => cat.crew_count > 0 && cat.code)
          .sort((a: any, b: any) => (a.code || "").localeCompare(b.code || ""));
        
        setCategories(categoriesWithCrews);
        
        // Charger l'ordre sauvegardé depuis localStorage si disponible
        if (phaseId) {
          const savedOrder = localStorage.getItem(`category_order_${phaseId}`);
          if (savedOrder) {
            try {
              const orderArray = JSON.parse(savedOrder);
              // Vérifier que les codes existent toujours
              const validOrder = orderArray.filter((code: string) =>
                categoriesWithCrews.some((cat: Category) => cat.code === code)
              );
              // Ajouter les catégories qui ne sont pas dans l'ordre sauvegardé
              const missingCategories = categoriesWithCrews
                .filter((cat: Category) => !validOrder.includes(cat.code))
                .map((cat: Category) => cat.code);
              
              setCategoryOrder([...validOrder, ...missingCategories]);
            } catch {
              // Si erreur de parsing, utiliser l'ordre par défaut
              setCategoryOrder(categoriesWithCrews.map((cat: Category) => cat.code));
            }
          } else {
            // Ordre par défaut : tri par code
            setCategoryOrder(categoriesWithCrews.map((cat: Category) => cat.code));
          }
        }
      } catch (err) {
        console.error("Erreur chargement catégories:", err);
        toast({
          title: "Erreur",
          description: "Impossible de charger les catégories",
          variant: "destructive",
        });
      } finally {
        setLoadingCategories(false);
      }
    };

    if (open && eventId) {
      fetchCategories();
    }
  }, [eventId, open, phaseId, toast]);

  // Réinitialiser l'ordre quand la phase change
  useEffect(() => {
    if (phaseId && categories.length > 0) {
      const savedOrder = localStorage.getItem(`category_order_${phaseId}`);
      if (savedOrder) {
        try {
          const orderArray = JSON.parse(savedOrder);
          const validOrder = orderArray.filter((code: string) =>
            categories.some((cat: Category) => cat.code === code)
          );
          const missingCategories = categories
            .filter((cat: Category) => !validOrder.includes(cat.code))
            .map((cat: Category) => cat.code);
          
          setCategoryOrder([...validOrder, ...missingCategories]);
        } catch {
          setCategoryOrder(categories.map((cat: Category) => cat.code));
        }
      } else {
        setCategoryOrder(categories.map((cat: Category) => cat.code));
      }
    }
  }, [phaseId, categories]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeCategory = categories.find((c) => c.id === active.id);
    const overCategory = categories.find((c) => c.id === over.id);
    
    if (!activeCategory || !overCategory) return;

    const activeIndex = categoryOrder.indexOf(activeCategory.code);
    const overIndex = categoryOrder.indexOf(overCategory.code);

    if (activeIndex === -1 || overIndex === -1) return;

    const newOrder = [...categoryOrder];
    const [removed] = newOrder.splice(activeIndex, 1);
    newOrder.splice(overIndex, 0, removed);

    setCategoryOrder(newOrder);

    // Sauvegarder dans localStorage
    if (phaseId) {
      localStorage.setItem(`category_order_${phaseId}`, JSON.stringify(newOrder));
    }
  };

  // Catégories triées selon l'ordre personnalisé
  const orderedCategories = useMemo(() => {
    const ordered: Category[] = [];
    
    // D'abord, les catégories dans l'ordre personnalisé
    categoryOrder.forEach((code) => {
      const cat = categories.find((c) => c.code === code);
      if (cat) ordered.push(cat);
    });
    
    // Ensuite, les catégories qui ne sont pas dans l'ordre (au cas où)
    categories.forEach((cat) => {
      if (!categoryOrder.includes(cat.code)) {
        ordered.push(cat);
      }
    });
    
    return ordered;
  }, [categories, categoryOrder]);

  const handleGenerate = async () => {
    if (!phaseId || !laneCount) return;

    try {
      setLoading(true);

      const payload: any = {
        phase_id: phaseId,
        lane_count: laneCount,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        interval_minutes: intervalMinutes,
      };

      // Ajouter category_order seulement si un ordre personnalisé est défini
      if (showCategoryOrder && categoryOrder.length > 0) {
        payload.category_order = categoryOrder;
      }

      await api.post("/races/generate", payload);

      toast({ title: "Séries générées avec succès." });
      onSuccess();
      setOpen(false);
      // Réinitialiser les champs
      setStartTime("");
      setPhaseId(undefined);
    } catch (err: any) {
      toast({
        title: "Erreur lors de la génération",
        description: err?.response?.data?.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetOrder = () => {
    const defaultOrder = categories.map((cat) => cat.code).sort((a, b) => a.localeCompare(b));
    setCategoryOrder(defaultOrder);
    if (phaseId) {
      localStorage.removeItem(`category_order_${phaseId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Générer une série</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Générer les courses</DialogTitle>
          <DialogDescription>
            Configurez les paramètres pour générer automatiquement les courses de la phase
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Phase *</Label>
            <Select 
              value={phaseId} 
              onValueChange={(v) => {
                setPhaseId(v);
                setShowCategoryOrder(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une phase" />
              </SelectTrigger>
              <SelectContent>
                {phases.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nombre de lignes d'eau *</Label>
            <Select 
              value={laneCount.toString()} 
              onValueChange={(v) => setLaneCount(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(16)].map((_, i) => {
                  const n = i + 1;
                  return (
                    <SelectItem key={n} value={`${n}`}>
                      {n}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Heure de départ de la première course</Label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Minutes entre chaque course</Label>
            <Input
              type="number"
              min={0}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            />
          </div>

          {/* Ordre personnalisé des catégories */}
          {phaseId && categories.length > 0 && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Ordre des catégories (optionnel)
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCategoryOrder(!showCategoryOrder)}
                  >
                    {showCategoryOrder ? "Masquer" : "Afficher"}
                  </Button>
                </div>
              </CardHeader>
              {showCategoryOrder && (
                <CardContent className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                      <p className="font-semibold mb-1">Ordre personnalisé des catégories</p>
                      <p>Définissez l'ordre dans lequel les catégories seront traitées lors de la génération. Glissez-déposez pour réorganiser. L'ordre est sauvegardé automatiquement pour cette phase.</p>
                    </div>
                  </div>

                  {loadingCategories ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : orderedCategories.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Glissez-déposez pour réorganiser ({orderedCategories.length} catégories)
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetOrder}
                          className="text-xs"
                        >
                          Réinitialiser
                        </Button>
                      </div>
                      <ScrollArea className="h-[300px] border rounded-lg p-2">
                        <DndContext
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={orderedCategories.map((c) => c.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {orderedCategories.map((category) => (
                                <SortableCategoryItem
                                  key={category.id}
                                  category={category}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Aucune catégorie avec équipages disponible
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={handleGenerate} disabled={loading || !phaseId}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Génération...
                </>
              ) : (
                "Générer"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
