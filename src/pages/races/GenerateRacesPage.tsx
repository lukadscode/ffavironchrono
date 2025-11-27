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
  participantsPerSeries: number[]; // Répartition totale des participants par série (calculée)
  categoryDistribution: Record<string, number[]>; // Répartition par catégorie : { categoryCode: [count_serie1, count_serie2, ...] }
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
  onRemove,
  onRemoveCategory
}: { 
  block: CategoryBlock; 
  categories: Category[];
  laneCount: number;
  onUpdate: (blockId: string, updates: Partial<CategoryBlock>) => void;
  onRemove: (blockId: string) => void;
  onRemoveCategory: (blockId: string, categoryCode: string) => void;
}) {
  const totalParticipants = block.categoryCodes.reduce((sum, code) => {
    const cat = categories.find(c => c.code === code);
    return sum + (cat?.crew_count || 0);
  }, 0);

  const maxSeries = Math.ceil(totalParticipants / laneCount);
  const minSeries = Math.ceil(totalParticipants / (laneCount * 2)); // Au moins la moitié des lignes remplies

  // Calculer la répartition initiale par catégorie si elle n'existe pas
  const getCategoryDistribution = () => {
    if (!block.categoryDistribution || Object.keys(block.categoryDistribution).length === 0) {
      // Initialiser la répartition par catégorie
      const distribution: Record<string, number[]> = {};
      block.categoryCodes.forEach(code => {
        const cat = categories.find(c => c.code === code);
        if (cat) {
          const basePerSeries = Math.floor(cat.crew_count / block.series);
          const remainder = cat.crew_count % block.series;
          distribution[code] = Array.from({ length: block.series }, (_, i) => 
            basePerSeries + (i < remainder ? 1 : 0)
          );
        }
      });
      return distribution;
    }
    return block.categoryDistribution;
  };

  const categoryDistribution = getCategoryDistribution();

  // Calculer le total par série à partir de la répartition par catégorie
  const calculateTotalPerSeries = (dist: Record<string, number[]>) => {
    const totals: number[] = [];
    block.categoryCodes.forEach((_, seriesIdx) => {
      const total = block.categoryCodes.reduce((sum, code) => {
        return sum + (dist[code]?.[seriesIdx] || 0);
      }, 0);
      totals.push(total);
    });
    return totals;
  };

  const handleSeriesChange = (newSeries: number) => {
    if (newSeries < 1 || newSeries > maxSeries) return;
    
    // Répartir chaque catégorie sur le nouveau nombre de séries
    const newDistribution: Record<string, number[]> = {};
    block.categoryCodes.forEach(code => {
      const cat = categories.find(c => c.code === code);
      if (cat) {
        const basePerSeries = Math.floor(cat.crew_count / newSeries);
        const remainder = cat.crew_count % newSeries;
        newDistribution[code] = Array.from({ length: newSeries }, (_, i) => 
          basePerSeries + (i < remainder ? 1 : 0)
        );
      }
    });
    
    const newTotals = calculateTotalPerSeries(newDistribution);
    onUpdate(block.id, { 
      series: newSeries, 
      categoryDistribution: newDistribution,
      participantsPerSeries: newTotals
    });
  };

  const handleCategoryParticipantAdjust = (categoryCode: string, seriesIndex: number, delta: number) => {
    const cat = categories.find(c => c.code === categoryCode);
    if (!cat) return;

    const newDistribution = { ...categoryDistribution };
    const currentCount = newDistribution[categoryCode]?.[seriesIndex] || 0;
    const totalForCategory = newDistribution[categoryCode]?.reduce((a, b) => a + b, 0) || 0;
    
    // Vérifier les limites
    if (delta > 0) {
      // Ne pas dépasser le total de la catégorie
      if (totalForCategory + delta <= cat.crew_count) {
        newDistribution[categoryCode] = [...(newDistribution[categoryCode] || [])];
        newDistribution[categoryCode][seriesIndex] = currentCount + delta;
      }
    } else if (delta < 0) {
      // Ne pas aller en dessous de 0
      if (currentCount + delta >= 0) {
        newDistribution[categoryCode] = [...(newDistribution[categoryCode] || [])];
        newDistribution[categoryCode][seriesIndex] = currentCount + delta;
      }
    }

    // Vérifier que le total de la série ne dépasse pas le nombre de lignes
    const newTotals = calculateTotalPerSeries(newDistribution);
    if (newTotals[seriesIndex] <= laneCount) {
      onUpdate(block.id, { 
        categoryDistribution: newDistribution,
        participantsPerSeries: newTotals
      });
    }
  };

  const usedLanes = block.participantsPerSeries.reduce((max, count) => Math.max(max, count), 0);
  const availableLanes = laneCount - usedLanes;

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {block.categoryCodes.map((code, idx) => {
              const cat = categories.find(c => c.code === code);
              return (
                <span key={code} className="inline-flex items-center gap-1">
                  {idx > 0 && <span className="text-slate-400">+</span>}
                  <span>{cat?.label || code}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 text-red-500 hover:text-red-700 hover:bg-red-50 ml-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCategory(block.id, code);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </span>
              );
            })}
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
          <Label className="text-sm">Catégories dans ce bloc:</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            {block.categoryCodes.map((code) => {
              const cat = categories.find(c => c.code === code);
              const totalInBlock = categoryDistribution[code]?.reduce((a, b) => a + b, 0) || 0;
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                >
                  {cat?.label || code}
                  <span className="text-blue-500">
                    ({totalInBlock} / {cat?.crew_count || 0})
                  </span>
                </span>
              );
            })}
          </div>
          
          <Label className="text-sm">Répartition par série:</Label>
          {Array.from({ length: block.series }).map((_, seriesIdx) => {
            const totalInSeries = block.participantsPerSeries[seriesIdx] || 0;
            
            return (
              <div key={seriesIdx} className="p-3 bg-white rounded border border-gray-200 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Série {seriesIdx + 1}:</span>
                    <span className="text-xs text-slate-500">
                      Total: <span className="font-semibold">{totalInSeries}</span> participant{totalInSeries > 1 ? 's' : ''} / {laneCount} lignes
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {block.categoryCodes.map((code) => {
                    const cat = categories.find(c => c.code === code);
                    if (!cat) return null;
                    
                    const countInSeries = categoryDistribution[code]?.[seriesIdx] || 0;
                    const totalForCategory = categoryDistribution[code]?.reduce((a, b) => a + b, 0) || 0;
                    
                    return (
                      <div key={code} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{cat.label || code}</span>
                          <span className="text-xs text-slate-500">
                            ({totalForCategory} / {cat.crew_count} au total)
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCategoryParticipantAdjust(code, seriesIdx, -1)}
                            disabled={countInSeries <= 0}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-semibold w-8 text-center">{countInSeries}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCategoryParticipantAdjust(code, seriesIdx, 1)}
                            disabled={countInSeries >= cat.crew_count || totalInSeries >= laneCount}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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

  // Réinitialiser les blocs quand la phase change
  useEffect(() => {
    if (phaseId) {
      setCategoryBlocks([]);
    }
  }, [phaseId]);

  // Catégories non assignées (pas dans les blocs)
  const unassignedCategories = useMemo(() => {
    const assignedCodes = new Set(categoryBlocks.flatMap(b => b.categoryCodes));
    return categories.filter(cat => !assignedCodes.has(cat.code));
  }, [categories, categoryBlocks]);

  const handleAddCategoryToBlock = (categoryCode: string, blockId?: string) => {
    const category = categories.find(c => c.code === categoryCode);
    if (!category) return;

    if (blockId && categoryBlocks.some(b => b.id === blockId)) {
      // Ajouter à un bloc existant
      const block = categoryBlocks.find(b => b.id === blockId);
      if (!block || block.categoryCodes.includes(categoryCode)) return; // Déjà dans le bloc

      const newCategoryCodes = [...block.categoryCodes, categoryCode];
      
      // Récupérer la distribution existante ou l'initialiser
      const existingDistribution = block.categoryDistribution || {};
      
      // Répartir la nouvelle catégorie en remplissant d'abord les séries existantes
      const newCategoryDistribution: number[] = Array(block.series).fill(0);
      let remainingParticipants = category.crew_count;
      
      // Remplir les séries une par une jusqu'à ce qu'on n'ait plus de participants
      for (let seriesIdx = 0; seriesIdx < block.series && remainingParticipants > 0; seriesIdx++) {
        // Calculer combien de places sont disponibles dans cette série
        const currentTotalInSeries = block.participantsPerSeries[seriesIdx] || 0;
        const availableInSeries = laneCount - currentTotalInSeries;
        
        // Ajouter le maximum possible dans cette série (sans dépasser les lignes d'eau)
        const toAdd = Math.min(remainingParticipants, availableInSeries);
        if (toAdd > 0) {
          newCategoryDistribution[seriesIdx] = toAdd;
          remainingParticipants -= toAdd;
        }
      }
      
      // Si on a encore des participants, créer de nouvelles séries si nécessaire
      if (remainingParticipants > 0) {
        const additionalSeries = Math.ceil(remainingParticipants / laneCount);
        const newSeries = block.series + additionalSeries;
        
        // Étendre la distribution pour toutes les catégories existantes
        const updatedDistribution: Record<string, number[]> = {};
        
        // Étendre les distributions existantes avec des zéros
        block.categoryCodes.forEach(code => {
          updatedDistribution[code] = [
            ...(existingDistribution[code] || Array(block.series).fill(0)),
            ...Array(additionalSeries).fill(0)
          ];
        });
        
        // Ajouter la nouvelle catégorie avec sa répartition
        updatedDistribution[categoryCode] = [
          ...newCategoryDistribution,
          ...Array(additionalSeries).fill(0)
        ];
        
        // Remplir les nouvelles séries avec les participants restants
        let remaining = remainingParticipants;
        for (let seriesIdx = block.series; seriesIdx < newSeries && remaining > 0; seriesIdx++) {
          const toAdd = Math.min(remaining, laneCount);
          updatedDistribution[categoryCode][seriesIdx] = toAdd;
          remaining -= toAdd;
        }
        
        // Calculer les totaux par série
        const newTotals: number[] = [];
        for (let seriesIdx = 0; seriesIdx < newSeries; seriesIdx++) {
          const total = newCategoryCodes.reduce((sum, code) => {
            return sum + (updatedDistribution[code]?.[seriesIdx] || 0);
          }, 0);
          newTotals.push(total);
        }
        
        setCategoryBlocks(prev => prev.map(b => 
          b.id === blockId 
            ? { 
                ...b, 
                categoryCodes: newCategoryCodes, 
                series: newSeries, 
                participantsPerSeries: newTotals,
                categoryDistribution: updatedDistribution
              }
            : b
        ));
      } else {
        // Pas besoin de nouvelles séries, juste ajouter la catégorie
        const updatedDistribution = {
          ...existingDistribution,
          [categoryCode]: newCategoryDistribution
        };
        
        // S'assurer que toutes les distributions ont la même longueur
        block.categoryCodes.forEach(code => {
          if (!updatedDistribution[code] || updatedDistribution[code].length < block.series) {
            updatedDistribution[code] = [
              ...(updatedDistribution[code] || []),
              ...Array(block.series - (updatedDistribution[code]?.length || 0)).fill(0)
            ];
          }
        });
        
        // Calculer les nouveaux totaux par série
        const newTotals: number[] = [];
        for (let seriesIdx = 0; seriesIdx < block.series; seriesIdx++) {
          const total = newCategoryCodes.reduce((sum, code) => {
            return sum + (updatedDistribution[code]?.[seriesIdx] || 0);
          }, 0);
          newTotals.push(total);
        }
        
        setCategoryBlocks(prev => prev.map(b => 
          b.id === blockId 
            ? { 
                ...b, 
                categoryCodes: newCategoryCodes, 
                participantsPerSeries: newTotals,
                categoryDistribution: updatedDistribution
              }
            : b
        ));
      }
    } else {
      // Créer un nouveau bloc - répartir intelligemment (une série à la fois)
      const series = Math.ceil(category.crew_count / laneCount);
      const categoryDistribution: Record<string, number[]> = {
        [categoryCode]: Array(series).fill(0)
      };
      
      // Remplir les séries une par une
      let remaining = category.crew_count;
      for (let seriesIdx = 0; seriesIdx < series && remaining > 0; seriesIdx++) {
        const toAdd = Math.min(remaining, laneCount);
        categoryDistribution[categoryCode][seriesIdx] = toAdd;
        remaining -= toAdd;
      }
      
      const distribution = categoryDistribution[categoryCode];
      
      const newBlock: CategoryBlock = {
        id: `block-${Date.now()}`,
        categoryCodes: [categoryCode],
        series,
        participantsPerSeries: distribution,
        categoryDistribution,
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
        
        // Répartir chaque catégorie sur les séries
        const categoryDistribution: Record<string, number[]> = {};
        newCategoryCodes.forEach(code => {
          const cat = categories.find(c => c.code === code);
          if (cat) {
            const basePerSeries = Math.floor(cat.crew_count / series);
            const remainder = cat.crew_count % series;
            categoryDistribution[code] = Array.from({ length: series }, (_, i) => 
              basePerSeries + (i < remainder ? 1 : 0)
            );
          }
        });
        
        return {
          ...block,
          categoryCodes: newCategoryCodes,
          series,
          participantsPerSeries: distribution,
          categoryDistribution,
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
                            onRemoveCategory={handleRemoveCategoryFromBlock}
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
