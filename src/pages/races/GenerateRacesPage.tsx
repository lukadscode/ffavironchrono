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
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, GripVertical, Tag, Info, ArrowLeft, Save, RotateCcw, Sparkles } from "lucide-react";

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
      className={`flex items-center gap-3 p-4 border rounded-lg bg-white transition-all ${
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
          <span className="font-bold text-lg text-slate-900">{category.code}</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            {category.crew_count} {category.crew_count === 1 ? "équipage" : "équipages"}
          </span>
        </div>
        <div className="text-sm text-slate-600">{category.label}</div>
      </div>
    </div>
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
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
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

    if (eventId) {
      fetchCategories();
    }
  }, [eventId, phaseId, toast]);

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
      toast({
        title: "Ordre sauvegardé",
        description: "L'ordre des catégories a été enregistré",
      });
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

  const handleResetOrder = () => {
    const defaultOrder = categories.map((cat) => cat.code).sort((a, b) => a.localeCompare(b));
    setCategoryOrder(defaultOrder);
    if (phaseId) {
      localStorage.removeItem(`category_order_${phaseId}`);
      toast({
        title: "Ordre réinitialisé",
        description: "L'ordre par défaut a été restauré",
      });
    }
  };

  const handleGenerate = async () => {
    if (!phaseId || !laneCount || !eventId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une phase et définir le nombre de couloirs",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const payload: any = {
        phase_id: phaseId,
        lane_count: laneCount,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        interval_minutes: intervalMinutes,
      };

      // Ajouter category_order seulement si un ordre personnalisé est défini
      if (categoryOrder.length > 0) {
        payload.category_order = categoryOrder;
      }

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

  const selectedPhase = phases.find((p) => p.id === phaseId);

  return (
    <div className="space-y-6">
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
            Configurez les paramètres et l'ordre des catégories pour générer automatiquement les courses
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne de gauche - Paramètres */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres de génération</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Phase *</Label>
                <Select 
                  value={phaseId} 
                  onValueChange={(v) => setPhaseId(v)}
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
        </div>

        {/* Colonne de droite - Ordre des catégories */}
        <div className="lg:col-span-2 space-y-6">
          {phaseId && categories.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      Ordre des catégories
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Définissez l'ordre dans lequel les catégories seront traitées lors de la génération
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetOrder}
                    disabled={loadingCategories}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Ordre personnalisé des catégories</p>
                    <p className="text-xs">
                      Glissez-déposez les catégories ci-dessous pour définir l'ordre dans lequel elles seront traitées. 
                      Les catégories non listées seront ajoutées à la fin dans l'ordre alphabétique. 
                      L'ordre est sauvegardé automatiquement dans votre navigateur pour cette phase.
                    </p>
                  </div>
                </div>

                {loadingCategories ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : orderedCategories.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {orderedCategories.length} catégorie{orderedCategories.length > 1 ? "s" : ""} disponible{orderedCategories.length > 1 ? "s" : ""}
                      </span>
                      <span className="text-muted-foreground">
                        Glissez-déposez pour réorganiser
                      </span>
                    </div>
                    <ScrollArea className="h-[600px] border rounded-lg p-4 bg-slate-50">
                      <DndContext
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={orderedCategories.map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {orderedCategories.map((category, index) => (
                              <div key={category.id} className="relative">
                                <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                                  {index + 1}
                                </div>
                                <SortableCategoryItem category={category} />
                              </div>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Aucune catégorie avec équipages disponible</p>
                    <p className="text-sm mt-1">
                      Assurez-vous que des équipages sont enregistrés pour les catégories
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : phaseId ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-muted-foreground">Chargement des catégories...</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Info className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-medium text-muted-foreground">Sélectionnez une phase</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choisissez une phase dans le panneau de gauche pour configurer l'ordre des catégories
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

