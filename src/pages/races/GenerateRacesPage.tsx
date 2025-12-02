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
import { Loader2, GripVertical, Tag, Info, ArrowLeft, Save, Sparkles, Plus, X, Minus, FileText, Download, Copy, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Category {
  id: string;
  code: string;
  label: string;
  crew_count: number;
  distance_id?: string;
  distance?: {
    id: string;
    meters: number | null;
    is_time_based: boolean;
    duration_seconds: number | null;
    label: string;
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
        <div className="text-xs text-slate-600 break-words">{category.label}</div>
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

  // Vérifier que toutes les catégories de la série ont la même distance
  const getSeriesDistance = (): { distance: number | null; isValid: boolean; error?: string } => {
    const categoryCodes = Object.keys(series.categories);
    if (categoryCodes.length === 0) {
      return { distance: null, isValid: true };
    }

    const distances = categoryCodes
      .map(code => {
        const cat = categories.find(c => c.code === code);
        // Pour les distances basées sur le temps, retourner null car on ne peut pas les utiliser pour le tri par distance
        if (cat?.distance?.is_time_based) {
          return null;
        }
        return cat?.distance?.meters ?? null;
      })
      .filter((d): d is number => d !== null);

    if (distances.length === 0) {
      return { distance: null, isValid: true }; // Pas de distances définies, c'est OK
    }

    const uniqueDistances = [...new Set(distances)];
    if (uniqueDistances.length > 1) {
      return {
        distance: null,
        isValid: false,
        error: `⚠️ Erreur: Cette série contient des catégories avec des distances différentes (${uniqueDistances.join("m, ")}m). Toutes les catégories doivent avoir la même distance.`
      };
    }

    return { distance: uniqueDistances[0], isValid: true };
  };

  const seriesDistanceInfo = getSeriesDistance();

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
    <Card className={`border-2 ${seriesDistanceInfo.isValid ? "border-blue-200 bg-blue-50/50" : "border-red-300 bg-red-50/50"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">
              Série {seriesIndex + 1}
            </CardTitle>
            {seriesDistanceInfo.distance !== null && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                {seriesDistanceInfo.distance}m
              </span>
            )}
          </div>
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
        {!seriesDistanceInfo.isValid && seriesDistanceInfo.error && (
          <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
            {seriesDistanceInfo.error}
          </div>
        )}
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
                      ({cat.crew_count} au total, {categoryAssignedCounts[code] || 0} assignés)
                    </span>
                    {cat.distance && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {cat.distance.label}
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
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [hasSavedSchema, setHasSavedSchema] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [copiedError, setCopiedError] = useState(false);

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

  // Charger le schéma existant quand la phase change
  useEffect(() => {
    const fetchSchema = async () => {
      if (!phaseId) {
        setHasSavedSchema(false);
        return;
      }
      
      try {
        setLoadingSchema(true);
        const res = await api.get(`/race-phases/${phaseId}/generation-schema`);
        const schema = res.data.data?.generation_schema;
        
        if (schema) {
          // Pré-remplir les champs avec le schéma existant
          setLaneCount(schema.lane_count || 6);
          if (schema.start_time) {
            const date = new Date(schema.start_time);
            const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
            setStartTime(localDate.toISOString().slice(0, 16));
          }
          setIntervalMinutes(schema.interval_minutes || 5);
          
          // Restaurer les séries
          if (schema.series && Array.isArray(schema.series)) {
            setSeries(schema.series);
          }
          
          setHasSavedSchema(true);
        } else {
          setHasSavedSchema(false);
        }
      } catch (err: any) {
        // Si 404 ou pas de schéma, c'est normal
        if (err?.response?.status !== 404) {
          console.error("Erreur chargement schéma:", err);
        }
        setHasSavedSchema(false);
      } finally {
        setLoadingSchema(false);
      }
    };
    
    fetchSchema();
  }, [phaseId]);

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
        
        // Récupérer les distances de l'événement
        const distancesRes = await api.get(`/distances/event/${eventId}`);
        const distances: any[] = distancesRes.data.data || [];
        const distanceMap = new Map<string, any>(distances.map((d: any) => [d.id, d]));
        
        // Enrichir les catégories en récupérant les détails complets de chaque catégorie
        // L'endpoint /with-crews peut ne pas inclure distance_id ou distance complète
        const enrichedCategories = await Promise.all(
          categoriesWithCrews.map(async (cat: any) => {
            try {
              // Récupérer les détails complets de la catégorie pour avoir le distance_id à jour
              const categoryRes = await api.get(`/categories/${cat.id}`);
              const categoryDetail = categoryRes.data.data || categoryRes.data;
              
              // Récupérer la distance complète si distance_id existe
              let distanceData = null;
              if (categoryDetail.distance_id) {
                const distance = distanceMap.get(categoryDetail.distance_id);
                if (distance) {
                  distanceData = {
                    id: distance.id,
                    meters: distance.meters,
                    is_time_based: distance.is_time_based || false,
                    duration_seconds: distance.duration_seconds || null,
                    label: distance.label,
                  };
                }
              }
              
              // Si la catégorie a déjà une distance complète dans categoryDetail, l'utiliser
              if (categoryDetail.distance) {
                distanceData = {
                  id: categoryDetail.distance.id,
                  meters: categoryDetail.distance.meters,
                  is_time_based: categoryDetail.distance.is_time_based || false,
                  duration_seconds: categoryDetail.distance.duration_seconds || null,
                  label: categoryDetail.distance.label,
                };
              }
              
              return {
                ...cat,
                distance_id: categoryDetail.distance_id || cat.distance_id || null,
                distance: distanceData,
              };
            } catch (err) {
              console.error(`Erreur récupération distance pour catégorie ${cat.id}:`, err);
              // Si erreur, essayer avec les données de base
              let distanceData = null;
              if (cat.distance_id) {
                const distance = distanceMap.get(cat.distance_id);
                if (distance) {
                  distanceData = {
                    id: distance.id,
                    meters: distance.meters,
                    is_time_based: distance.is_time_based || false,
                    duration_seconds: distance.duration_seconds || null,
                    label: distance.label,
                  };
                }
              }
              return {
                ...cat,
                distance_id: cat.distance_id || null,
                distance: distanceData || cat.distance || null,
              };
            }
          })
        );
        
        console.log("Catégories enrichies avec distances:", enrichedCategories.map((c: any) => ({
          code: c.code,
          label: c.label,
          distance: c.distance?.meters || null,
          distance_id: c.distance_id
        })));
        
        setCategories(enrichedCategories);
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
    // Pour les distances basées sur le temps, retourner null car on ne peut pas les utiliser pour le tri par distance
    if (category.distance?.is_time_based) {
      return null;
    }
    if (category.distance?.meters !== undefined && category.distance.meters !== null) {
      return category.distance.meters;
    }
    return null;
  };

  // Fonction pour vérifier si les distances sont compatibles
  const areDistancesCompatible = (category1: Category, category2: Category): boolean => {
    const dist1 = getCategoryDistance(category1);
    const dist2 = getCategoryDistance(category2);
    
    // Si les deux n'ont pas de distance, on autorise (cas flexible)
    if (dist1 === null && dist2 === null) {
      return true;
    }
    
    // Si une seule a une distance, on autorise (cas flexible)
    if (dist1 === null || dist2 === null) {
      return true;
    }
    
    // Si les deux ont des distances, elles doivent être identiques
    return dist1 === dist2;
  };

  // Fonction pour vérifier si une catégorie peut être ajoutée à une série
  const canAddCategoryToSeries = (category: Category, targetSeries: Series): { canAdd: boolean; reason?: string } => {
    const existingCategoryCodes = Object.keys(targetSeries.categories);
    
    if (existingCategoryCodes.length === 0) {
      return { canAdd: true };
    }
    
    // Récupérer toutes les distances des catégories existantes (non null)
    const existingDistances = existingCategoryCodes
      .map(code => {
        const existingCategory = categories.find(c => c.code === code);
        return existingCategory ? getCategoryDistance(existingCategory) : null;
      })
      .filter((d): d is number => d !== null);
    
    const newCategoryDistance = getCategoryDistance(category);
    
    // Si la nouvelle catégorie a une distance
    if (newCategoryDistance !== null) {
      // Vérifier qu'elle correspond à toutes les distances existantes
      if (existingDistances.length > 0) {
        const uniqueExistingDistances = [...new Set(existingDistances)];
        if (uniqueExistingDistances.length > 1) {
          // Il y a déjà des distances différentes dans la série
          return {
            canAdd: false,
            reason: `Cette série contient déjà des catégories avec des distances différentes (${uniqueExistingDistances.join("m, ")}m).`
          };
        }
        // Vérifier que la nouvelle distance correspond à la distance existante
        if (uniqueExistingDistances[0] !== newCategoryDistance) {
          return {
            canAdd: false,
            reason: `Les distances ne correspondent pas (${newCategoryDistance}m vs ${uniqueExistingDistances[0]}m). Les catégories dans une même série doivent avoir la même distance.`
          };
        }
      }
    } else {
      // Si la nouvelle catégorie n'a pas de distance, vérifier qu'il n'y a pas déjà des distances différentes dans la série
      if (existingDistances.length > 0) {
        const uniqueExistingDistances = [...new Set(existingDistances)];
        if (uniqueExistingDistances.length > 1) {
          return {
            canAdd: false,
            reason: `Cette série contient déjà des catégories avec des distances différentes (${uniqueExistingDistances.join("m, ")}m).`
          };
        }
      }
    }
    
    return { canAdd: true };
  };

  const handleAddCategoryToSeries = (categoryCode: string, seriesId?: string, forceNewSeries: boolean = false) => {
    const category = categories.find(c => c.code === categoryCode);
    if (!category) return;

    // Calculer les équipages disponibles pour cette catégorie
    const totalAssignedForCategory = categoryAssignedCounts[categoryCode] || 0;
    const availableCrews = category.crew_count - totalAssignedForCategory;

    if (seriesId && series.some(s => s.id === seriesId) && !forceNewSeries) {
      // Ajouter à une série existante
      const targetSeries = series.find(s => s.id === seriesId);
      if (!targetSeries) return;

      // Vérifier qu'il reste des équipages disponibles pour cette catégorie
      if (availableCrews <= 0) {
        toast({
          title: "Impossible d'ajouter la catégorie",
          description: `La catégorie "${category.label || category.code}" n'a plus d'équipages disponibles (${category.crew_count} au total, ${totalAssignedForCategory} déjà assignés dans d'autres séries).`,
          variant: "destructive",
        });
        return;
      }

      // Vérifier la compatibilité des distances AVANT d'ajouter
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
      const currentCountInSeries = targetSeries.categories[categoryCode] || 0;

      if (availableInSeries <= 0) {
        toast({
          title: "Impossible d'ajouter la catégorie",
          description: `Cette série est pleine (${laneCount} lignes d'eau utilisées).`,
          variant: "destructive",
        });
        return;
      }

      // Calculer combien on peut ajouter : minimum entre :
      // - Les équipages disponibles pour cette catégorie
      // - Les lignes d'eau disponibles dans la série
      const maxToAdd = Math.min(availableCrews, availableInSeries);
      
      if (maxToAdd <= 0) {
        toast({
          title: "Impossible d'ajouter la catégorie",
          description: `Plus d'espace disponible : ${availableCrews} équipage(s) disponible(s) pour cette catégorie, ${availableInSeries} ligne(s) d'eau disponible(s) dans cette série.`,
          variant: "destructive",
        });
        return;
      }

      // Toujours ajouter uniquement les équipages non affectés (disponibles)
      // et respecter la limite de lignes d'eau de la série
      const toAdd = maxToAdd;
      
      const newCategories = {
        ...targetSeries.categories,
        [categoryCode]: (targetSeries.categories[categoryCode] || 0) + toAdd
      };

      setSeries(prev => prev.map(s => 
        s.id === seriesId 
          ? { ...s, categories: newCategories }
          : s
      ));

      // Afficher un message informatif
      if (toAdd < availableCrews) {
        toast({
          title: "Catégorie ajoutée partiellement",
          description: `${toAdd} équipage(s) ajouté(s) à la série. ${availableCrews - toAdd} équipage(s) restant(s) disponible(s) pour cette catégorie.`,
        });
      }
    } else {
      // Créer une nouvelle série pour cette catégorie
      // Si forceNewSeries est true, on saute la recherche de série compatible
      if (!forceNewSeries) {
        // Mais d'abord, vérifier s'il existe une série existante avec la même distance où on pourrait ajouter
        const categoryDistance = getCategoryDistance(category);
        if (categoryDistance !== null) {
          // Chercher une série existante avec la même distance et de la place
          const compatibleSeries = series.find(s => {
            const existingCategoryCodes = Object.keys(s.categories);
            if (existingCategoryCodes.length === 0) return false;
            
            // Vérifier que toutes les catégories de cette série ont la même distance
            const seriesDistances = existingCategoryCodes
              .map(code => {
                const cat = categories.find(c => c.code === code);
                return cat ? getCategoryDistance(cat) : null;
              })
              .filter((d): d is number => d !== null);
            
            if (seriesDistances.length === 0) return false;
            const uniqueDistances = [...new Set(seriesDistances)];
            if (uniqueDistances.length !== 1 || uniqueDistances[0] !== categoryDistance) {
              return false;
            }
            
            // Vérifier qu'il y a de la place
            const currentTotal = Object.values(s.categories).reduce((sum, count) => sum + count, 0);
            return currentTotal < laneCount;
          });
          
          if (compatibleSeries) {
            // Ajouter à la série compatible existante
            handleAddCategoryToSeries(categoryCode, compatibleSeries.id, false);
            return;
          }
        }
      }
      
      // Vérifier qu'il reste des équipages disponibles avant de créer une nouvelle série
      if (availableCrews <= 0) {
        toast({
          title: "Impossible de créer une série",
          description: `La catégorie "${category.label || category.code}" n'a plus d'équipages disponibles (${category.crew_count} au total, ${totalAssignedForCategory} déjà assignés dans d'autres séries).`,
          variant: "destructive",
        });
        return;
      }

      // Créer une nouvelle série (forcée ou après vérification)
      // Utiliser uniquement les équipages disponibles, pas le total
      const seriesNeeded = Math.ceil(availableCrews / laneCount);
      const newSeriesList: Series[] = [];

      let remaining = availableCrews;
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

    // Vérifier qu'il reste des équipages disponibles avant d'autoriser l'ajout
    const totalAssignedForCategory = categoryAssignedCounts[category.code] || 0;
    const availableCrews = category.crew_count - totalAssignedForCategory;

    // Si on dépose sur une série existante
    if (overId.startsWith("series-") && series.some(s => s.id === overId)) {
      const targetSeries = series.find(s => s.id === overId);
      
      // Vérifier les limites avant d'ajouter
      if (targetSeries) {
        const currentCountInSeries = targetSeries.categories[category.code] || 0;
        const currentTotal = Object.values(targetSeries.categories).reduce((sum, count) => sum + count, 0);
        const availableInSeries = laneCount - currentTotal;
        
        // Si la catégorie n'est pas encore dans la série, vérifier qu'il y a des équipages disponibles
        if (currentCountInSeries === 0 && availableCrews <= 0) {
          toast({
            title: "Impossible d'ajouter",
            description: `La catégorie "${category.label || category.code}" n'a plus d'équipages disponibles (${category.crew_count} au total, ${totalAssignedForCategory} déjà assignés).`,
            variant: "destructive",
          });
          return;
        }
        
        // Si la catégorie est déjà dans la série, vérifier qu'on peut encore en ajouter
        if (currentCountInSeries > 0 && availableCrews <= 0) {
          toast({
            title: "Tous les équipages sont déjà assignés",
            description: `Tous les ${category.crew_count} équipages de cette catégorie sont déjà assignés dans les séries.`,
            variant: "destructive",
          });
          return;
        }
        
        // Vérifier qu'il y a de la place dans la série
        if (availableInSeries <= 0 && currentCountInSeries === 0) {
          toast({
            title: "Série pleine",
            description: `Cette série est déjà pleine (${laneCount} lignes d'eau utilisées).`,
            variant: "destructive",
          });
          return;
        }
      }
      
      handleAddCategoryToSeries(category.code, overId);
    } 
    // Si on dépose sur la zone "nouvelle série"
    else if (overId === "new-series") {
      // Vérifier qu'il reste des équipages disponibles avant de créer une nouvelle série
      if (availableCrews <= 0) {
        toast({
          title: "Impossible de créer une série",
          description: `La catégorie "${category.label || category.code}" n'a plus d'équipages disponibles (${category.crew_count} au total, ${totalAssignedForCategory} déjà assignés dans d'autres séries).`,
          variant: "destructive",
        });
        return;
      }
      
      handleAddCategoryToSeries(category.code, undefined, true); // forceNewSeries = true
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

  // Charger le schéma existant
  const handleLoadSchema = async () => {
    if (!phaseId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une phase",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingSchema(true);
      const res = await api.get(`/race-phases/${phaseId}/generation-schema`);
      const schema = res.data.data?.generation_schema;
      
      if (schema) {
        setLaneCount(schema.lane_count || 6);
        if (schema.start_time) {
          const date = new Date(schema.start_time);
          const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          setStartTime(localDate.toISOString().slice(0, 16));
        }
        setIntervalMinutes(schema.interval_minutes || 5);
        
        if (schema.series && Array.isArray(schema.series)) {
          setSeries(schema.series);
        }
        
        setHasSavedSchema(true);
        toast({
          title: "Schéma chargé",
          description: "Le schéma enregistré a été chargé avec succès",
        });
      } else {
        toast({
          title: "Aucun schéma",
          description: "Aucun schéma enregistré pour cette phase",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Erreur chargement schéma:", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de charger le schéma",
        variant: "destructive",
      });
    } finally {
      setLoadingSchema(false);
    }
  };

  // Sauvegarder en brouillon
  const handleSaveDraft = async () => {
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

    // Validation des séries avant envoi
    const validationErrors: string[] = [];
    
    series.forEach((s, index) => {
      const seriesNumber = index + 1;
      
      const totalParticipants = Object.values(s.categories).reduce((sum, count) => sum + count, 0);
      if (totalParticipants > laneCount) {
        validationErrors.push(`Série ${seriesNumber}: Le nombre total de participants (${totalParticipants}) dépasse le nombre de lignes d'eau (${laneCount})`);
      }
      
      const categoryCodes = Object.keys(s.categories);
      if (categoryCodes.length > 0) {
        const distances = categoryCodes
          .map(code => {
            const cat = categories.find(c => c.code === code);
            return cat ? getCategoryDistance(cat) : null;
          })
          .filter((d): d is number => d !== null);
        
        if (distances.length > 0) {
          const uniqueDistances = [...new Set(distances)];
          if (uniqueDistances.length > 1) {
            validationErrors.push(`Série ${seriesNumber}: Les catégories ont des distances différentes (${uniqueDistances.join("m, ")}m). Toutes les catégories d'une série doivent avoir la même distance.`);
          }
        }
      }
    });
    
    if (validationErrors.length > 0) {
      toast({
        title: "Erreurs de validation",
        description: validationErrors.join("\n"),
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingDraft(true);

      const payload: any = {
        phase_id: phaseId,
        lane_count: laneCount,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        interval_minutes: intervalMinutes || 5,
        series: series.map(s => ({
          id: s.id,
          categories: s.categories
        })),
        save_only: true, // Mode brouillon
      };

      await api.post("/races/generate-from-series", payload);
      
      setHasSavedSchema(true);
      toast({ 
        title: "Brouillon enregistré",
        description: "Le schéma a été enregistré en brouillon. Vous pourrez le modifier et générer les courses plus tard."
      });
    } catch (err: any) {
      const errorData = err?.response?.data;
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        toast({
          title: "Erreurs de validation",
          description: errorData.errors.join("\n"),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur lors de l'enregistrement",
          description: errorData?.message || err?.message || "Une erreur est survenue",
          variant: "destructive",
        });
      }
    } finally {
      setSavingDraft(false);
    }
  };

  // Générer depuis le schéma enregistré
  const handleGenerateFromSchema = async () => {
    if (!phaseId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une phase",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(`/race-phases/${phaseId}/generate-from-schema`, {});
      
      const data = response.data.data;
      toast({ 
        title: "Succès",
        description: `${data.races_created} course${data.races_created > 1 ? 's' : ''} générée${data.races_created > 1 ? 's' : ''} avec succès depuis le schéma enregistré (${data.crews_assigned} équipages assignés)` 
      });
      
      navigate(`/event/${eventId}/racePhases/${phaseId}`);
    } catch (err: any) {
      const errorData = err?.response?.data;
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        toast({
          title: "Erreurs de validation",
          description: errorData.errors.join("\n"),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur lors de la génération",
          description: errorData?.message || err?.message || "Une erreur est survenue",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
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

    // Validation des séries avant envoi
    const localValidationErrors: string[] = [];
    
    series.forEach((s, index) => {
      const seriesNumber = index + 1;
      
      // Vérifier la capacité des lignes d'eau
      const totalParticipants = Object.values(s.categories).reduce((sum, count) => sum + count, 0);
      if (totalParticipants > laneCount) {
        localValidationErrors.push(`Série ${seriesNumber}: Le nombre total de participants (${totalParticipants}) dépasse le nombre de lignes d'eau (${laneCount})`);
      }
      
      // Vérifier la compatibilité des distances
      const categoryCodes = Object.keys(s.categories);
      if (categoryCodes.length > 0) {
        const distances = categoryCodes
          .map(code => {
            const cat = categories.find(c => c.code === code);
            return cat ? getCategoryDistance(cat) : null;
          })
          .filter((d): d is number => d !== null);
        
        if (distances.length > 0) {
          const uniqueDistances = [...new Set(distances)];
          if (uniqueDistances.length > 1) {
            localValidationErrors.push(`Série ${seriesNumber}: Les catégories ont des distances différentes (${uniqueDistances.join("m, ")}m). Toutes les catégories d'une série doivent avoir la même distance.`);
          }
        }
      }
    });
    
    if (localValidationErrors.length > 0) {
      setValidationErrors(localValidationErrors);
      setShowErrorDialog(true);
      toast({
        title: "Erreurs de validation",
        description: `${localValidationErrors.length} erreur(s) détectée(s). Voir les détails ci-dessous.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Construire le payload avec la structure des séries
      const payload: any = {
        phase_id: phaseId,
        lane_count: laneCount,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        interval_minutes: intervalMinutes || 5,
        series: series.map(s => ({
          id: s.id,
          categories: s.categories  // { categoryCode: numberOfParticipants }
        })),
      };

      console.log("Payload envoyé à l'API:", JSON.stringify(payload, null, 2));
      console.log("Séries détaillées:", series.map(s => ({
        id: s.id,
        categories: s.categories,
        totalParticipants: Object.values(s.categories).reduce((sum, count) => sum + count, 0)
      })));

      const response = await api.post("/races/generate-from-series", payload);
      
      console.log("Réponse de l'API:", response.data);

      // Afficher un message de succès avec les détails
      const data = response.data.data;
      toast({ 
        title: "Succès",
        description: `${data.races_created} course${data.races_created > 1 ? 's' : ''} générée${data.races_created > 1 ? 's' : ''} avec succès (${data.crews_assigned} équipages assignés)` 
      });
      
      // Rediriger vers la page de détails de la phase
      navigate(`/event/${eventId}/racePhases/${phaseId}`);
    } catch (err: any) {
      // Gérer les erreurs de validation avec détails
      const errorData = err?.response?.data;
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        // Améliorer la lisibilité des messages d'erreur
        const improvedErrors = errorData.errors.map((error: string) => {
          // Si le message contient des informations sur les équipages, le rendre plus lisible
          if (error.includes("équipages disponibles")) {
            // Extraire les informations du message
            // Format attendu: "Série X: La catégorie 'NAME' n'a que Y équipages disponibles (Z au total, W déjà assignés), mais N sont demandés au total."
            const match = error.match(/Série (\d+): La catégorie '([^']+)' n'a que (\d+) équipages disponibles \((\d+) au total, (\d+) déjà assignés\), mais (\d+) sont demandés au total\./);
            if (match) {
              const [, serie, category, disponibles, total, assignes, demandes] = match;
              const disponiblesNum = parseInt(disponibles);
              const totalNum = parseInt(total);
              const assignesNum = parseInt(assignes);
              const demandesNum = parseInt(demandes);
              
              // Le problème : on demande plus d'équipages qu'il n'en reste disponibles
              const manque = demandesNum - disponiblesNum;
              
              return `Série ${serie} - Catégorie "${category}":\n` +
                     `  • Équipages au total dans cette catégorie: ${totalNum}\n` +
                     `  • Équipages déjà assignés dans d'autres séries: ${assignesNum}\n` +
                     `  • Équipages disponibles restants: ${disponiblesNum}\n` +
                     `  • Équipages demandés dans cette série: ${demandesNum}\n` +
                     `  → ❌ Il manque ${manque} équipage(s) !\n` +
                     `     Solution : Réduisez le nombre d'équipages de cette catégorie dans la série ${serie} (boutons -) ou retirez la catégorie si nécessaire.`;
            }
          }
          return error;
        });
        setValidationErrors(improvedErrors);
        setShowErrorDialog(true);
        toast({
          title: "Erreurs de validation",
          description: `${errorData.errors.length} erreur(s) détectée(s). Voir les détails ci-dessous.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur lors de la génération",
          description: errorData?.message || err?.message || "Une erreur est survenue",
          variant: "destructive",
        });
      }
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
                  setHasSavedSchema(false);
                }}
                disabled={loadingPhases || loadingSchema}
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

      {/* Boutons d'action */}
      {phaseId && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {/* Indicateur de schéma enregistré */}
            {hasSavedSchema && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  Un schéma est enregistré pour cette phase. Vous pouvez le charger, le modifier ou générer directement les courses.
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Bouton charger le schéma */}
              {hasSavedSchema && (
                <Button 
                  onClick={handleLoadSchema} 
                  disabled={loadingSchema || loading}
                  variant="outline"
                  className="flex-1"
                >
                  {loadingSchema ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Charger le schéma
                    </>
                  )}
                </Button>
              )}

              {/* Bouton générer depuis le schéma */}
              {hasSavedSchema && (
                <Button 
                  onClick={handleGenerateFromSchema} 
                  disabled={loading || savingDraft}
                  variant="secondary"
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Générer depuis le schéma
                    </>
                  )}
                </Button>
              )}

              {/* Bouton sauvegarder en brouillon */}
              {series.length > 0 && (
                <Button 
                  onClick={handleSaveDraft} 
                  disabled={loading || savingDraft || !phaseId}
                  variant="outline"
                  className="flex-1"
                >
                  {savingDraft ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Enregistrer en brouillon
                    </>
                  )}
                </Button>
              )}

              {/* Bouton générer les courses */}
              {series.length > 0 && (
                <Button 
                  onClick={handleGenerate} 
                  disabled={loading || savingDraft || !phaseId}
                  className="flex-1"
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
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog d'affichage des erreurs de validation */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Info className="w-5 h-5" />
              Erreurs de validation
            </DialogTitle>
            <DialogDescription>
              Des erreurs ont été détectées lors de la validation. Veuillez corriger les problèmes suivants avant de générer les courses.
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Problème détecté</AlertTitle>
            <AlertDescription>
              {validationErrors.length} erreur(s) de validation détectée(s). Les détails sont listés ci-dessous.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Détails des erreurs :</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const errorText = validationErrors.join("\n\n");
                  navigator.clipboard.writeText(errorText);
                  setCopiedError(true);
                  setTimeout(() => setCopiedError(false), 2000);
                  toast({
                    title: "Copié !",
                    description: "Les erreurs ont été copiées dans le presse-papiers",
                  });
                }}
              >
                {copiedError ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copier les erreurs
                  </>
                )}
              </Button>
            </div>
            
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {validationErrors.map((error, index) => (
                  <div
                    key={index}
                    className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-destructive font-bold mt-1">#{index + 1}</span>
                      <pre className="text-sm whitespace-pre-wrap font-sans text-foreground flex-1">
                        {error}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                const errorText = validationErrors.join("\n\n");
                navigator.clipboard.writeText(errorText);
                setCopiedError(true);
                setTimeout(() => setCopiedError(false), 2000);
                toast({
                  title: "Copié !",
                  description: "Les erreurs ont été copiées dans le presse-papiers",
                });
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier toutes les erreurs
            </Button>
            <Button onClick={() => setShowErrorDialog(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
