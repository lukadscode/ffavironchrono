import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DndContext, closestCenter, useDroppable } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, GripVertical, Tag, Info, ArrowLeft, Save, RotateCcw, Sparkles, Plus, X, Minus } from "lucide-react";

interface Category {
  id: string;
  code: string;
  label: string;
  crew_count: number;
}

interface Phase {
  id: string;
  name: string;
  order_index: number;
}

interface CategoryBlock {
  id: string;
  categoryCodes: string[];
  series: number; // Nombre de séries
  participantsPerSeries: number[]; // Répartition des participants par série
}

function SortableCategoryItem({ category, onRemove }: { category: Category; onRemove?: () => void }) {
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
      className={`flex items-center gap-3 p-3 border rounded-lg bg-white transition-all ${
        isDragging ? "shadow-lg border-blue-500 scale-105 z-50" : "border-gray-200 hover:border-blue-300 hover:shadow-md"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-blue-600 transition-colors"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm text-slate-900">{category.code}</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            {category.crew_count} {category.crew_count === 1 ? "équipage" : "équipages"}
          </span>
        </div>
        <div className="text-xs text-slate-600">{category.label}</div>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={onRemove}
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

function CategoryBlockCard({ 
  block, 
  categories, 
  laneCount, 
  onUpdate, 
  onRemove 
}: { 
  block: CategoryBlock; 
  categories: Category[];
  laneCount: number;
  onUpdate: (blockId: string, updates: Partial<CategoryBlock>) => void;
  onRemove: (blockId: string) => void;
}) {
  const totalParticipants = block.categoryCodes.reduce((sum, code) => {
    const cat = categories.find(c => c.code === code);
    return sum + (cat?.crew_count || 0);
  }, 0);

  const maxSeries = Math.ceil(totalParticipants / laneCount);
  const minSeries = Math.ceil(totalParticipants / (laneCount * 2)); // Au moins la moitié des lignes remplies

  const adjustParticipants = (seriesCount: number) => {
    const basePerSeries = Math.floor(totalParticipants / seriesCount);
    const remainder = totalParticipants % seriesCount;
    const distribution: number[] = [];
    
    for (let i = 0; i < seriesCount; i++) {
      distribution.push(basePerSeries + (i < remainder ? 1 : 0));
    }
    
    return distribution;
  };

  const handleSeriesChange = (newSeries: number) => {
    if (newSeries < 1 || newSeries > maxSeries) return;
    const newDistribution = adjustParticipants(newSeries);
    onUpdate(block.id, { series: newSeries, participantsPerSeries: newDistribution });
  };

  const handleParticipantAdjust = (seriesIndex: number, delta: number) => {
    const newDistribution = [...block.participantsPerSeries];
    const current = newDistribution[seriesIndex];
    const total = newDistribution.reduce((a, b) => a + b, 0);
    
    if (delta > 0 && total + delta <= totalParticipants + laneCount) {
      newDistribution[seriesIndex] = current + delta;
    } else if (delta < 0 && current + delta > 0) {
      newDistribution[seriesIndex] = current + delta;
    }
    
    // Rééquilibrer pour que le total reste proche de totalParticipants
    const newTotal = newDistribution.reduce((a, b) => a + b, 0);
    if (Math.abs(newTotal - totalParticipants) <= laneCount) {
      onUpdate(block.id, { participantsPerSeries: newDistribution });
    }
  };

  const usedLanes = block.participantsPerSeries.reduce((max, count) => Math.max(max, count), 0);
  const availableLanes = laneCount - usedLanes;

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {block.categoryCodes.map(code => {
              const cat = categories.find(c => c.code === code);
              return cat?.label || code;
            }).join(" + ")}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => onRemove(block.id)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm mt-2">
          <span className="text-slate-600">
            <span className="font-semibold">{totalParticipants}</span> participants
          </span>
          <span className="text-slate-600">
            Lignes utilisées: <span className="font-semibold">{usedLanes}</span> / {laneCount}
          </span>
          {availableLanes > 0 && (
            <span className="text-green-600 font-semibold">
              {availableLanes} places disponibles
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Nombre de séries:</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleSeriesChange(block.series - 1)}
              disabled={block.series <= 1}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="font-semibold w-8 text-center">{block.series}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleSeriesChange(block.series + 1)}
              disabled={block.series >= maxSeries}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm">Répartition par série:</Label>
          {block.participantsPerSeries.map((count, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
              <span className="text-sm font-medium w-20">Série {idx + 1}:</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleParticipantAdjust(idx, -1)}
                  disabled={count <= 1}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="font-semibold w-8 text-center">{count}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleParticipantAdjust(idx, 1)}
                  disabled={count >= laneCount}
                >
                  <Plus className="w-3 h-3" />
                </Button>
                <span className="text-xs text-slate-500 ml-2">
                  ({count} / {laneCount} lignes)
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GenerateRacesPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phaseId, setPhaseId] = useState<string>("");
  const [laneCount, setLaneCount] = useState<number>(6);
  const [startTime, setStartTime] = useState<string>("");
  const [intervalMinutes, setIntervalMinutes] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryBlocks, setCategoryBlocks] = useState<CategoryBlock[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(true);

  // Charger les phases
  useEffect(() => {
    const fetchPhases = async () => {
      if (!eventId) return;
      
      try {
        setLoadingPhases(true);
        const res = await api.get(`/race-phases/${eventId}`);
        setPhases(res.data.data || []);
      } catch (err) {
        console.error("Erreur chargement phases:", err);
        toast({
          title: "Erreur",
          description: "Impossible de charger les phases",
          variant: "destructive",
        });
      } finally {
        setLoadingPhases(false);
      }
    };

    fetchPhases();
  }, [eventId, toast]);

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

    if (eventId) {
      fetchCategories();
    }
  }, [eventId, toast]);

  // Calculer automatiquement la répartition optimale
  const calculateOptimalDistribution = (participants: number, lanes: number): { series: number; distribution: number[] } => {
    const series = Math.ceil(participants / lanes);
    const basePerSeries = Math.floor(participants / series);
    const remainder = participants % series;
    const distribution: number[] = [];
    
    for (let i = 0; i < series; i++) {
      distribution.push(basePerSeries + (i < remainder ? 1 : 0));
    }
    
    return { series, distribution };
  };

  // Calculer automatiquement les blocs quand phaseId, laneCount ou categories changent
  useEffect(() => {
    if (!phaseId || !laneCount || categories.length === 0) {
      if (categoryBlocks.length === 0) {
        setCategoryBlocks([]);
      }
      return;
    }

    // Si aucun bloc n'existe, créer automatiquement des blocs en essayant de regrouper intelligemment
    if (categoryBlocks.length === 0) {
      const initialBlocks: CategoryBlock[] = [];
      const processedCategories = new Set<string>();

      // Trier les catégories par nombre de participants (décroissant)
      const sortedCategories = [...categories].sort((a, b) => b.crew_count - a.crew_count);

      sortedCategories.forEach((cat) => {
        if (processedCategories.has(cat.code)) return;

        // Chercher un bloc existant où on peut ajouter cette catégorie
        let addedToExisting = false;
        for (const block of initialBlocks) {
          const totalParticipants = block.categoryCodes.reduce((sum, code) => {
            const c = categories.find(c => c.code === code);
            return sum + (c?.crew_count || 0);
          }, 0);
          
          const newTotal = totalParticipants + cat.crew_count;
          const maxSeries = Math.ceil(newTotal / laneCount);
          const minParticipantsPerSeries = Math.ceil(newTotal / maxSeries);
          
          // Si on peut ajouter sans dépasser les lignes d'eau
          if (minParticipantsPerSeries <= laneCount) {
            block.categoryCodes.push(cat.code);
            const { series, distribution } = calculateOptimalDistribution(newTotal, laneCount);
            block.series = series;
            block.participantsPerSeries = distribution;
            processedCategories.add(cat.code);
            addedToExisting = true;
            break;
          }
        }

        // Si on n'a pas pu l'ajouter à un bloc existant, créer un nouveau bloc
        if (!addedToExisting) {
          const { series, distribution } = calculateOptimalDistribution(cat.crew_count, laneCount);
          initialBlocks.push({
            id: `block-${Date.now()}-${initialBlocks.length}`,
            categoryCodes: [cat.code],
            series,
            participantsPerSeries: distribution,
          });
          processedCategories.add(cat.code);
        }
      });

      setCategoryBlocks(initialBlocks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId, laneCount, categories]);

  // Catégories non assignées (pas dans les blocs)
  const unassignedCategories = useMemo(() => {
    const assignedCodes = new Set(categoryBlocks.flatMap(b => b.categoryCodes));
    return categories.filter(cat => !assignedCodes.has(cat.code));
  }, [categories, categoryBlocks]);

  const handleAddCategoryToBlock = (categoryCode: string, blockId?: string) => {
    const category = categories.find(c => c.code === categoryCode);
    if (!category) return;

    if (blockId) {
      // Ajouter à un bloc existant
      const block = categoryBlocks.find(b => b.id === blockId);
      if (!block) return;

      const newCategoryCodes = [...block.categoryCodes, categoryCode];
      const totalParticipants = newCategoryCodes.reduce((sum, code) => {
        const cat = categories.find(c => c.code === code);
        return sum + (cat?.crew_count || 0);
      }, 0);

      const { series, distribution } = calculateOptimalDistribution(totalParticipants, laneCount);

      setCategoryBlocks(prev => prev.map(b => 
        b.id === blockId 
          ? { ...b, categoryCodes: newCategoryCodes, series, participantsPerSeries: distribution }
          : b
      ));
    } else {
      // Créer un nouveau bloc
      const { series, distribution } = calculateOptimalDistribution(category.crew_count, laneCount);
      const newBlock: CategoryBlock = {
        id: `block-${Date.now()}`,
        categoryCodes: [categoryCode],
        series,
        participantsPerSeries: distribution,
      };
      setCategoryBlocks(prev => [...prev, newBlock]);
    }
  };

  const handleRemoveCategoryFromBlock = (blockId: string, categoryCode: string) => {
    setCategoryBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        const newCategoryCodes = block.categoryCodes.filter(code => code !== categoryCode);
        if (newCategoryCodes.length === 0) {
          return null; // Supprimer le bloc s'il est vide
        }
        
        const totalParticipants = newCategoryCodes.reduce((sum, code) => {
          const cat = categories.find(c => c.code === code);
          return sum + (cat?.crew_count || 0);
        }, 0);

        const { series, distribution } = calculateOptimalDistribution(totalParticipants, laneCount);
        
        return {
          ...block,
          categoryCodes: newCategoryCodes,
          series,
          participantsPerSeries: distribution,
        };
      }
      return block;
    }).filter((b): b is CategoryBlock => b !== null));
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<CategoryBlock>) => {
    setCategoryBlocks(prev => prev.map(b => 
      b.id === blockId ? { ...b, ...updates } : b
    ));
  };

  const handleRemoveBlock = (blockId: string) => {
    setCategoryBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const category = categories.find((c) => c.id === active.id);
    if (!category) return;

    const overId = over.id.toString();

    // Si on dépose sur un bloc existant
    if (overId.startsWith("block-") && categoryBlocks.some(b => b.id === overId)) {
      const blockId = overId;
      handleAddCategoryToBlock(category.code, blockId);
    } 
    // Si on dépose sur la zone "nouveau bloc"
    else if (overId === "new-block") {
      handleAddCategoryToBlock(category.code);
    }
    // Si on dépose sur "unassigned" (retirer de tous les blocs)
    else if (overId === "unassigned") {
      setCategoryBlocks(prev => prev.map(block => {
        if (block.categoryCodes.includes(category.code)) {
          const newCategoryCodes = block.categoryCodes.filter(code => code !== category.code);
          if (newCategoryCodes.length === 0) {
            return null;
          }
          
          const totalParticipants = newCategoryCodes.reduce((sum, code) => {
            const cat = categories.find(c => c.code === code);
            return sum + (cat?.crew_count || 0);
          }, 0);

          const { series, distribution } = calculateOptimalDistribution(totalParticipants, laneCount);
          
          return {
            ...block,
            categoryCodes: newCategoryCodes,
            series,
            participantsPerSeries: distribution,
          };
        }
        return block;
      }).filter((b): b is CategoryBlock => b !== null));
    }
  };

  const handleGenerate = async () => {
    if (!phaseId || !laneCount || !eventId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une phase et définir le nombre de lignes d'eau",
        variant: "destructive",
      });
      return;
    }

    if (categoryBlocks.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez organiser au moins une catégorie",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Construire l'ordre des catégories depuis les blocs
      const categoryOrder: string[] = [];
      categoryBlocks.forEach(block => {
        block.categoryCodes.forEach(code => {
          if (!categoryOrder.includes(code)) {
            categoryOrder.push(code);
          }
        });
      });

      // Ajouter les catégories non assignées
      unassignedCategories.forEach(cat => {
        if (!categoryOrder.includes(cat.code)) {
          categoryOrder.push(cat.code);
        }
      });

      const payload: any = {
        phase_id: phaseId,
        lane_count: laneCount,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        interval_minutes: intervalMinutes,
        category_order: categoryOrder,
      };

      await api.post("/races/generate", payload);

      toast({ 
        title: "Succès",
        description: "Les courses ont été générées avec succès" 
      });
      
      // Rediriger vers la page de détails de la phase
      navigate(`/event/${eventId}/racePhases/${phaseId}`);
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header avec gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white p-6 shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => navigate(`/event/${eventId}/racePhases`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Sparkles className="w-8 h-8" />
              Génération des courses
            </h1>
          </div>
          <p className="text-blue-100 text-lg">
            Configurez les paramètres et organisez les catégories pour générer automatiquement les courses
          </p>
        </div>
      </div>

      {/* Configuration initiale */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phase *</Label>
              <Select 
                value={phaseId} 
                onValueChange={(v) => {
                  setPhaseId(v);
                  setCategoryBlocks([]); // Réinitialiser les blocs
                }}
                disabled={loadingPhases}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingPhases ? "Chargement..." : "Choisir une phase"} />
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
                onValueChange={(v) => {
                  setLaneCount(Number(v));
                  // Recalculer les blocs
                  setCategoryBlocks(prev => prev.map(block => {
                    const totalParticipants = block.categoryCodes.reduce((sum, code) => {
                      const cat = categories.find(c => c.code === code);
                      return sum + (cat?.crew_count || 0);
                    }, 0);
                    const { series, distribution } = calculateOptimalDistribution(totalParticipants, Number(v));
                    return { ...block, series, participantsPerSeries: distribution };
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(20)].map((_, i) => {
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
          </div>
        </CardContent>
      </Card>

      {/* Deux colonnes : Catégories disponibles et Ordre/Répartition */}
      {phaseId && laneCount > 0 ? (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Colonne gauche : Catégories disponibles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Catégories disponibles
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Glissez-déposez les catégories vers la colonne de droite pour les organiser
                </p>
              </CardHeader>
              <CardContent>
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : unassignedCategories.length > 0 ? (
                  <UnassignedDroppable>
                    <ScrollArea className="h-[600px] border rounded-lg p-4 bg-slate-50">
                      <SortableContext
                        items={unassignedCategories.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {unassignedCategories.map((category) => (
                            <SortableCategoryItem key={category.id} category={category} />
                          ))}
                        </div>
                      </SortableContext>
                    </ScrollArea>
                  </UnassignedDroppable>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Toutes les catégories sont organisées</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Colonne droite : Ordre et répartition */}
            <Card>
              <CardHeader>
                <CardTitle>Ordre et répartition des courses</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Organisez les catégories en blocs. Les catégories dans le même bloc seront regroupées dans les mêmes courses.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {categoryBlocks.length > 0 ? (
                      categoryBlocks.map((block) => (
                        <DroppableBlock
                          key={block.id}
                          blockId={block.id}
                        >
                          <CategoryBlockCard
                            block={block}
                            categories={categories}
                            laneCount={laneCount}
                            onUpdate={handleUpdateBlock}
                            onRemove={handleRemoveBlock}
                          />
                        </DroppableBlock>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Aucun bloc créé</p>
                        <p className="text-sm mt-1">
                          Glissez-déposez des catégories depuis la colonne de gauche
                        </p>
                      </div>
                    )}

                    {/* Zone de dépôt pour créer un nouveau bloc */}
                    <DroppableZone />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </DndContext>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Info className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-medium text-muted-foreground">Sélectionnez une phase et le nombre de lignes d'eau</p>
            <p className="text-sm text-muted-foreground mt-1">
              Configurez les paramètres ci-dessus pour commencer
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bouton de génération */}
      {phaseId && categoryBlocks.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={handleGenerate} 
              disabled={loading || !phaseId}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Génération...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Générer les courses
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DroppableZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "new-block",
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isOver 
          ? "border-blue-500 bg-blue-50" 
          : "border-gray-300 bg-gray-50"
      }`}
    >
      <Plus className="w-8 h-8 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-600 font-medium">
        Déposez ici pour créer un nouveau bloc
      </p>
    </div>
  );
}

function DroppableBlock({ blockId, children }: { blockId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: blockId,
  });

  return (
    <div
      ref={setNodeRef}
      className={isOver ? "ring-2 ring-blue-500 rounded-lg" : ""}
    >
      {children}
    </div>
  );
}

function UnassignedDroppable({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: "unassigned",
  });

  return (
    <div ref={setNodeRef}>
      {children}
    </div>
  );
}
