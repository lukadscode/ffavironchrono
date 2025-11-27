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
import { Loader2, GripVertical, Tag, Info, ArrowLeft, Save, Sparkles, Plus, X, Minus } from "lucide-react";

interface Category {
  id: string;
  code: string;
  label: string;
  crew_count: number;
  distance_id?: string;
  distance?: {
    id: string;
    meters: number;
    label?: string;
  };
}

interface Phase {
  id: string;
  name: string;
  order_index: number;
}

interface Series {
  id: string;
  categories: Record<string, number>; // { categoryCode: numberOfParticipants }
}

function SortableCategoryItem({ 
  category, 
  assignedCount 
}: { 
  category: Category;
  assignedCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isComplete = assignedCount >= category.crew_count;
  const bgColor = isComplete ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
        isDragging 
          ? "shadow-lg border-blue-500 scale-105 z-50 bg-white" 
          : `${bgColor} hover:shadow-md`
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
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            isComplete 
              ? "bg-green-100 text-green-700" 
              : "bg-orange-100 text-orange-700"
          }`}>
            {assignedCount} / {category.crew_count} équipages
          </span>
        </div>
        <div className="text-xs text-slate-600">{category.label}</div>
      </div>
    </div>
  );
}

function SeriesCard({ 
  series, 
  seriesIndex,
  categories, 
  laneCount, 
  onUpdate, 
  onRemove,
  onRemoveCategory,
  categoryAssignedCounts
}: { 
  series: Series;
  seriesIndex: number;
  categories: Category[];
  laneCount: number;
  onUpdate: (seriesId: string, updates: Partial<Series>) => void;
  onRemove: (seriesId: string) => void;
  onRemoveCategory: (seriesId: string, categoryCode: string) => void;
  categoryAssignedCounts: Record<string, number>;
}) {
  const totalParticipants = Object.entries(series.categories).reduce((sum, [code, count]) => {
    return sum + count;
  }, 0);

  const usedLanes = totalParticipants;
  const availableLanes = laneCount - usedLanes;

  const handleCategoryParticipantAdjust = (categoryCode: string, delta: number) => {
    const cat = categories.find(c => c.code === categoryCode);
    if (!cat) return;

    const currentCount = series.categories[categoryCode] || 0;
    const totalInSeries = Object.values(series.categories).reduce((sum, count) => sum + count, 0);
    
    // Vérifier les limites
    if (delta > 0) {
      // Vérifier qu'on ne dépasse pas le nombre de lignes d'eau dans cette série
      if (totalInSeries + delta > laneCount) {
        return;
      }
      
      // Vérifier qu'on ne dépasse pas le total global de la catégorie (en comptant toutes les séries)
      const totalAssignedForCategory = categoryAssignedCounts[categoryCode] || 0;
      if (totalAssignedForCategory + delta > cat.crew_count) {
        return;
      }
      
      const newCategories = {
        ...series.categories,
        [categoryCode]: currentCount + delta
      };
      onUpdate(series.id, { categories: newCategories });
    } else if (delta < 0) {
      // Ne pas aller en dessous de 0
      if (currentCount + delta >= 0) {
        const newCategories = {
          ...series.categories,
          [categoryCode]: currentCount + delta
        };
        // Si on arrive à 0, supprimer la catégorie
        if (newCategories[categoryCode] === 0) {
          const { [categoryCode]: _, ...rest } = newCategories;
          onUpdate(series.id, { categories: rest });
        } else {
          onUpdate(series.id, { categories: newCategories });
        }
      }
    }
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Série {seriesIndex + 1}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => onRemove(series.id)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm mt-2">
          <span className="text-slate-600">
            <span className="font-semibold">{totalParticipants}</span> participant{totalParticipants > 1 ? 's' : ''}
          </span>
          <span className="text-slate-600">
            Lignes utilisées: <span className="font-semibold">{usedLanes}</span> / {laneCount}
          </span>
          {availableLanes > 0 && (
            <span className="text-green-600 font-semibold">
              {availableLanes} places disponibles
            </span>
          )}
          {availableLanes === 0 && (
            <span className="text-orange-600 font-semibold">
              Série complète
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.keys(series.categories).length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">
            Glissez-déposez une catégorie ici
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(series.categories).map(([code, count]) => {
              const cat = categories.find(c => c.code === code);
              if (!cat) return null;
              
              return (
                <div key={code} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cat.label || code}</span>
                    <span className="text-xs text-slate-500">
                      ({cat.crew_count} au total)
                    </span>
                    {cat.distance && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {cat.distance.label || `${cat.distance.meters}m`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCategoryParticipantAdjust(code, -1)}
                      disabled={count <= 0}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="font-semibold w-8 text-center">{count}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCategoryParticipantAdjust(code, 1)}
                      disabled={
                        count >= cat.crew_count || 
                        totalParticipants >= laneCount ||
                        (categoryAssignedCounts[code] || 0) >= cat.crew_count
                      }
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                      onClick={() => onRemoveCategory(series.id, code)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
  const [series, setSeries] = useState<Series[]>([]);
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
        
        // Enrichir les catégories avec leurs distances
        try {
          const distancesRes = await api.get(`/distances/event/${eventId}`);
          const distances: any[] = distancesRes.data.data || [];
          const distanceMap = new Map<string, any>(distances.map((d: any) => [d.id, d]));
          
          const enrichedCategories = categoriesWithCrews.map((cat: any) => {
            if (cat.distance) {
              return cat;
            }
            if (cat.distance_id) {
              const distance = distanceMap.get(cat.distance_id);
              if (distance && distance.id && distance.meters !== undefined) {
                return {
                  ...cat,
                  distance: {
                    id: distance.id,
                    meters: distance.meters,
                    label: distance.label,
                  }
                };
              }
            }
            return cat;
          });
          
          setCategories(enrichedCategories);
        } catch (err) {
          console.error("Erreur chargement distances:", err);
          setCategories(categoriesWithCrews);
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

    if (eventId) {
      fetchCategories();
    }
  }, [eventId, toast]);

  // Réinitialiser les séries quand la phase change
  useEffect(() => {
    if (phaseId) {
      setSeries([]);
    }
  }, [phaseId]);

  // Calculer le nombre d'équipages affectés pour chaque catégorie
  const categoryAssignedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(cat => {
      counts[cat.code] = 0;
    });
    
    series.forEach(s => {
      Object.entries(s.categories).forEach(([code, count]) => {
        counts[code] = (counts[code] || 0) + count;
      });
    });
    
    return counts;
  }, [categories, series]);

  // Catégories non assignées (pas dans les séries) - mais on affiche toutes les catégories avec leur statut
  const allCategoriesWithStatus = useMemo(() => {
    return categories.map(cat => ({
      ...cat,
      assignedCount: categoryAssignedCounts[cat.code] || 0
    }));
  }, [categories, categoryAssignedCounts]);

  // Fonction pour obtenir la distance d'une catégorie
  const getCategoryDistance = (category: Category): number | null => {
    if (category.distance?.meters !== undefined) {
      return category.distance.meters;
    }
    return null;
  };

  // Fonction pour vérifier si les distances sont compatibles
  const areDistancesCompatible = (category1: Category, category2: Category): boolean => {
    const dist1 = getCategoryDistance(category1);
    const dist2 = getCategoryDistance(category2);
    
    // Si une des deux n'a pas de distance, on autorise (cas flexible)
    if (dist1 === null || dist2 === null) {
      return true;
    }
    
    // Les distances doivent être identiques
    return dist1 === dist2;
  };

  // Fonction pour vérifier si une catégorie peut être ajoutée à une série
  const canAddCategoryToSeries = (category: Category, targetSeries: Series): { canAdd: boolean; reason?: string } => {
    const existingCategoryCodes = Object.keys(targetSeries.categories);
    
    if (existingCategoryCodes.length === 0) {
      return { canAdd: true };
    }
    
    // Vérifier que toutes les catégories existantes ont la même distance que la nouvelle
    for (const code of existingCategoryCodes) {
      const existingCategory = categories.find(c => c.code === code);
      if (existingCategory && !areDistancesCompatible(category, existingCategory)) {
        const dist1 = getCategoryDistance(category);
        const dist2 = getCategoryDistance(existingCategory);
        return {
          canAdd: false,
          reason: `Les distances ne correspondent pas (${dist1}m vs ${dist2}m). Les catégories dans une même série doivent avoir la même distance.`
        };
      }
    }
    
    return { canAdd: true };
  };

  const handleAddCategoryToSeries = (categoryCode: string, seriesId?: string) => {
    const category = categories.find(c => c.code === categoryCode);
    if (!category) return;

    if (seriesId && series.some(s => s.id === seriesId)) {
      // Ajouter à une série existante
      const targetSeries = series.find(s => s.id === seriesId);
      if (!targetSeries) return;

      // Vérifier la compatibilité des distances
      const validation = canAddCategoryToSeries(category, targetSeries);
      if (!validation.canAdd) {
        toast({
          title: "Impossible d'ajouter la catégorie",
          description: validation.reason || "Les distances ne correspondent pas",
          variant: "destructive",
        });
        return;
      }

      const currentTotal = Object.values(targetSeries.categories).reduce((sum, count) => sum + count, 0);
      const availableInSeries = laneCount - currentTotal;

      if (availableInSeries > 0) {
        // Il y a de la place dans cette série
        const toAdd = Math.min(category.crew_count, availableInSeries);
        const newCategories = {
          ...targetSeries.categories,
          [categoryCode]: (targetSeries.categories[categoryCode] || 0) + toAdd
        };

        setSeries(prev => prev.map(s => 
          s.id === seriesId 
            ? { ...s, categories: newCategories }
            : s
        ));

        // Si il reste des participants, créer une nouvelle série
        const remaining = category.crew_count - toAdd;
        if (remaining > 0) {
          const newSeries: Series = {
            id: `series-${Date.now()}`,
            categories: { [categoryCode]: remaining }
          };
          setSeries(prev => [...prev, newSeries]);
        }
      } else {
        // La série est pleine, créer une nouvelle série
        const newSeries: Series = {
          id: `series-${Date.now()}`,
          categories: { [categoryCode]: category.crew_count }
        };
        setSeries(prev => [...prev, newSeries]);
      }
    } else {
      // Créer une nouvelle série pour cette catégorie
      const seriesNeeded = Math.ceil(category.crew_count / laneCount);
      const newSeriesList: Series[] = [];

      let remaining = category.crew_count;
      for (let i = 0; i < seriesNeeded && remaining > 0; i++) {
        const toAdd = Math.min(remaining, laneCount);
        newSeriesList.push({
          id: `series-${Date.now()}-${i}`,
          categories: { [categoryCode]: toAdd }
        });
        remaining -= toAdd;
      }

      setSeries(prev => [...prev, ...newSeriesList]);
    }
  };

  const handleRemoveCategoryFromSeries = (seriesId: string, categoryCode: string) => {
    setSeries(prev => prev.map(s => {
      if (s.id === seriesId) {
        const { [categoryCode]: _, ...rest } = s.categories;
        // Si la série est vide, on peut la supprimer (optionnel)
        if (Object.keys(rest).length === 0) {
          return null;
        }
        return { ...s, categories: rest };
      }
      return s;
    }).filter((s): s is Series => s !== null));
  };

  const handleUpdateSeries = (seriesId: string, updates: Partial<Series>) => {
    setSeries(prev => prev.map(s => 
      s.id === seriesId ? { ...s, ...updates } : s
    ));
  };

  const handleRemoveSeries = (seriesId: string) => {
    setSeries(prev => prev.filter(s => s.id !== seriesId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const category = categories.find((c) => c.id === active.id);
    if (!category) return;

    const overId = over.id.toString();

    // Si on dépose sur une série existante
    if (overId.startsWith("series-") && series.some(s => s.id === overId)) {
      handleAddCategoryToSeries(category.code, overId);
    } 
    // Si on dépose sur la zone "nouvelle série"
    else if (overId === "new-series") {
      handleAddCategoryToSeries(category.code);
    }
    // Si on dépose sur "unassigned" (retirer de toutes les séries)
    else if (overId === "unassigned") {
      setSeries(prev => prev.map(s => {
        if (s.categories[category.code]) {
          const { [category.code]: _, ...rest } = s.categories;
          if (Object.keys(rest).length === 0) {
            return null;
          }
          return { ...s, categories: rest };
        }
        return s;
      }).filter((s): s is Series => s !== null));
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

    if (series.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez organiser au moins une catégorie",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Construire l'ordre des catégories depuis les séries
      const categoryOrder: string[] = [];
      series.forEach(s => {
        Object.keys(s.categories).forEach(code => {
          if (!categoryOrder.includes(code)) {
            categoryOrder.push(code);
          }
        });
      });

      // Ajouter les catégories non assignées (celles qui n'ont pas tous leurs équipages affectés)
      allCategoriesWithStatus.forEach(cat => {
        if (!categoryOrder.includes(cat.code) && cat.assignedCount < cat.crew_count) {
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
            Configurez les paramètres et organisez les catégories en séries pour générer automatiquement les courses
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
                  setSeries([]);
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
              <Label>Nombre de lignes d'eau/rameur *</Label>
              <Input
                type="number"
                min={1}
                value={laneCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0) {
                    setLaneCount(value);
                  } else if (e.target.value === "") {
                    setLaneCount(1);
                  }
                }}
                placeholder="Ex: 6"
              />
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

      {/* Deux colonnes : Catégories disponibles et Séries */}
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
                  Glissez-déposez les catégories vers la colonne de droite pour créer des séries
                </p>
              </CardHeader>
              <CardContent>
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : allCategoriesWithStatus.length > 0 ? (
                  <UnassignedDroppable>
                    <ScrollArea className="h-[600px] border rounded-lg p-4 bg-slate-50">
                      <SortableContext
                        items={allCategoriesWithStatus.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {allCategoriesWithStatus.map((category) => (
                            <SortableCategoryItem 
                              key={category.id} 
                              category={category}
                              assignedCount={category.assignedCount}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </ScrollArea>
                  </UnassignedDroppable>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Aucune catégorie disponible</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Colonne droite : Séries */}
            <Card>
              <CardHeader>
                <CardTitle>Séries</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Organisez les catégories en séries. Glissez-déposez une catégorie sur une série pour l'ajouter.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {series.length > 0 ? (
                      series.map((s, idx) => (
                        <DroppableSeries
                          key={s.id}
                          seriesId={s.id}
                        >
                          <SeriesCard
                            series={s}
                            seriesIndex={idx}
                            categories={categories}
                            laneCount={laneCount}
                            onUpdate={handleUpdateSeries}
                            onRemove={handleRemoveSeries}
                            onRemoveCategory={handleRemoveCategoryFromSeries}
                            categoryAssignedCounts={categoryAssignedCounts}
                          />
                        </DroppableSeries>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Aucune série créée</p>
                        <p className="text-sm mt-1">
                          Glissez-déposez des catégories depuis la colonne de gauche
                        </p>
                      </div>
                    )}

                    {/* Zone de dépôt pour créer une nouvelle série */}
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
      {phaseId && series.length > 0 && (
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
    id: "new-series",
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
        Déposez ici pour créer une nouvelle série
      </p>
    </div>
  );
}

function DroppableSeries({ seriesId, children }: { seriesId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: seriesId,
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
