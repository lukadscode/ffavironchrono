import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusIcon, Tag, Trophy, ArrowLeft, ArrowRight, Save, Gauge, Sparkles, Loader2, Wand2, Check, X, AlertCircle } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";

type Distance = {
  id: string;
  event_id: string;
  meters: number | null;
  is_relay?: boolean;
  relay_count?: number | null;
  is_time_based: boolean;
  duration_seconds: number | null;
  label: string;
};

type Category = {
  id: string;
  label: string;
  code?: string;
  distance_id?: string | null;
  crew_count?: number;
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  distance_id?: string | null;
  race_phase?: {
    id: string;
    name: string;
  };
};

// Composant draggable pour une catégorie
function DraggableCategory({ category, isSaving }: { category: Category; isSaving?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `category-${category.id}`,
    data: { type: "category", category },
    disabled: isSaving,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        "p-2 border rounded-lg bg-white cursor-move hover:shadow-md hover:border-blue-300 transition-all border-gray-200 group relative",
        isDragging && "opacity-50 scale-95",
        isSaving && "opacity-60 cursor-wait"
      )}
    >
      {isSaving && (
        <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center z-10">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        </div>
      )}
      <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors break-words">
        {category.label || category.code}
      </div>
      {category.crew_count !== undefined && (
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <Trophy className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{category.crew_count} {category.crew_count === 1 ? "équipage" : "équipages"}</span>
        </div>
      )}
    </div>
  );
}

// Composant draggable pour une course
function DraggableRace({ race, isSaving }: { race: Race; isSaving?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `race-${race.id}`,
    data: { type: "race", race },
    disabled: isSaving,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        "p-2 border rounded-lg bg-white cursor-move hover:shadow-md hover:border-amber-300 transition-all border-gray-200 group relative",
        isDragging && "opacity-50 scale-95",
        isSaving && "opacity-60 cursor-wait"
      )}
    >
      {isSaving && (
        <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center z-10">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
        </div>
      )}
      <div className="font-semibold text-xs text-slate-900 group-hover:text-amber-600 transition-colors break-words">
        Course {race.race_number} - {race.name}
      </div>
      {race.race_phase && (
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          <span className="truncate">Phase: {race.race_phase.name}</span>
        </div>
      )}
    </div>
  );
}

// Composant droppable pour une distance
function DroppableDistance({
  distance,
  items,
  type,
  savingItemId,
}: {
  distance: Distance | { id: "unassigned"; label: "Non affecté" };
  items: (Category | Race)[];
  type: "category" | "race";
  savingItemId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: distance.id === "unassigned" ? "unassigned" : `distance-${distance.id}`,
    data: { type: distance.id === "unassigned" ? "unassigned" : "distance", distanceId: distance.id },
  });

  const displayLabel = distance.id === "unassigned" 
    ? "Non affecté" 
    : (() => {
        const dist = distance as Distance;
        // Utiliser le label du backend qui est toujours formaté correctement
        if (dist.label && dist.label.trim() !== "") {
          return dist.label;
        }
        // Fallback : formater manuellement si le label n'est pas présent
        if (dist.is_time_based && dist.duration_seconds) {
          const minutes = Math.floor(dist.duration_seconds / 60);
          const seconds = dist.duration_seconds % 60;
          if (minutes > 0 && seconds > 0) {
            return `${minutes}min ${seconds}s`;
          } else if (minutes > 0) {
            return `${minutes}min`;
          } else {
            return `${dist.duration_seconds}s`;
          }
        } else if (dist.is_relay && dist.relay_count && dist.meters) {
          return `${dist.relay_count}x${dist.meters}m`;
        } else if (dist.meters) {
          return `${dist.meters}m`;
        }
        return "Distance inconnue";
      })();

  return (
    <Card
      ref={setNodeRef}
      className={clsx(
        "w-full rounded-xl shadow-sm hover:shadow-md transition-all border-2",
        distance.id === "unassigned" 
          ? "border-gray-200" 
          : "border-blue-200",
        isOver && "border-blue-500 bg-blue-50 shadow-lg scale-[1.02]"
      )}
    >
      <CardHeader className={clsx(
        "pb-2 border-b rounded-t-xl",
        distance.id === "unassigned" 
          ? "bg-gradient-to-r from-slate-50 to-gray-50" 
          : "bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50"
      )}>
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-slate-900 font-semibold min-w-0 flex-1">
            {distance.id === "unassigned" ? (
              <Tag className="w-4 h-4 text-slate-600 flex-shrink-0" />
            ) : (
              <Gauge className="w-4 h-4 text-blue-600 flex-shrink-0" />
            )}
            <span className="break-words">{displayLabel}</span>
          </span>
          <span className={clsx(
            "px-2 py-0.5 text-xs font-bold rounded-full shadow-sm flex-shrink-0",
            distance.id === "unassigned"
              ? "bg-gray-200 text-gray-700"
              : "bg-blue-600 text-white"
          )}>
            {items.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 min-h-[200px] max-h-[400px] overflow-y-auto p-3 bg-white/50">
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <div className="flex flex-col items-center gap-2">
              {distance.id === "unassigned" ? (
                <>
                  <Tag className="w-8 h-8 opacity-30" />
                  <p>Aucune {type === "category" ? "catégorie" : "course"} non affectée</p>
                </>
              ) : (
                <>
                  <Gauge className="w-8 h-8 opacity-30" />
                  <p>Aucune {type === "category" ? "catégorie" : "course"} pour cette distance</p>
                </>
              )}
            </div>
          </div>
        ) : (
          items.map((item) =>
            type === "category" ? (
              <DraggableCategory 
                key={item.id} 
                category={item as Category} 
                isSaving={savingItemId === item.id}
              />
            ) : (
              <DraggableRace 
                key={item.id} 
                race={item as Race}
                isSaving={savingItemId === item.id}
              />
            )
          )
        )}
        {isOver && (
          <div className="border-2 border-dashed border-blue-400 rounded-lg p-6 text-center text-blue-600 text-sm font-medium bg-blue-50 animate-pulse">
            <Trophy className="w-6 h-6 mx-auto mb-2" />
            Déposez ici
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DistancesPage() {
  const { eventId } = useParams();
  const { toast } = useToast();
  const [distances, setDistances] = useState<Distance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [newMeters, setNewMeters] = useState("");
  const [isRelay, setIsRelay] = useState(false);
  const [relayCount, setRelayCount] = useState<number | "">("");
  const [distanceType, setDistanceType] = useState<"meters" | "time">("meters");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [durationSeconds, setDurationSeconds] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"categories" | "races">("categories");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Array<{
    type: "category" | "race";
    id: string;
    newDistanceId: string | null;
    oldDistanceId: string | null;
    name: string;
  }>>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoAssignDialogOpen, setAutoAssignDialogOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{
    id: string;
    name: string;
    type: "category" | "race";
    suggestedDistanceId: string | null;
    suggestedDistanceLabel: string;
    confidence: number;
  }>>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchDistances = async () => {
    try {
      const res = await api.get(`/distances/event/${eventId}`);
      setDistances(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les distances.",
        variant: "destructive",
      });
    }
  };

  const fetchCategories = async () => {
    try {
      // Utiliser un timestamp pour éviter le cache après sauvegarde
      const res = await api.get(`/categories/event/${eventId}/with-crews`, {
        params: { _t: Date.now() }
      });
      const categoriesData = res.data.data || [];
      
      // L'API retourne maintenant directement distance_id dans la réponse (corrigé côté backend)
      // On utilise directement cette valeur, mais on peut toujours enrichir avec les détails complets
      // si nécessaire pour avoir l'objet distance complet
      const enrichedCategories = await Promise.all(
        categoriesData.map(async (cat: any) => {
          // Utiliser distance_id de la réponse si présent (c'est le cas maintenant)
          const distanceIdFromResponse = cat.distance_id !== undefined ? (cat.distance_id || null) : null;
          
          // Si on a déjà distance_id, on peut l'utiliser directement
          // Sinon, récupérer les détails complets (fallback pour compatibilité)
          if (distanceIdFromResponse !== null || cat.distance_id === null) {
            // distance_id est présent dans la réponse, utiliser directement
            return {
              ...cat,
              distance_id: distanceIdFromResponse,
              // distance peut ne pas être présent dans /with-crews, on peut le laisser null
              distance: cat.distance || null,
            };
          } else {
            // Fallback : récupérer les détails complets (au cas où le backend n'aurait pas encore été mis à jour)
            try {
              const categoryRes = await api.get(`/categories/${cat.id}`, {
                params: { _t: Date.now() }
              });
              const categoryDetail = categoryRes.data.data || categoryRes.data;
              
              return {
                ...cat,
                distance_id: categoryDetail.distance_id !== undefined ? (categoryDetail.distance_id || null) : null,
                distance: categoryDetail.distance || null,
              };
            } catch (err) {
              console.error(`Erreur récupération distance pour catégorie ${cat.id}:`, err);
              return {
                ...cat,
                distance_id: distanceIdFromResponse,
              };
            }
          }
        })
      );
      
      console.log("Catégories chargées avec distance_id:", enrichedCategories.map(c => ({ 
        id: c.id, 
        label: c.label, 
        distance_id: c.distance_id 
      })));
      
      setCategories(enrichedCategories);
    } catch (err) {
      console.error("Erreur chargement catégories", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les catégories.",
        variant: "destructive",
      });
    }
  };

  const fetchRaces = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const racesData = res.data.data || [];
      
      // Enrichir chaque course avec son distance_id pour s'assurer qu'il est à jour
      // Ajouter un petit délai pour éviter les problèmes de cache
      const enrichedRaces = await Promise.all(
        racesData.map(async (race: any, index: number) => {
          // Ajouter un petit délai progressif pour éviter de surcharger l'API
          if (index > 0 && index % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          // Récupérer les détails complets de la course pour avoir le distance_id à jour
          // Ajouter un timestamp pour éviter le cache
          try {
            const raceRes = await api.get(`/races/${race.id}`, {
              params: { _t: Date.now() }
            });
            const raceDetail = raceRes.data.data || raceRes.data;
            
            // S'assurer que distance_id est bien null si non défini (pas undefined)
            const distanceId = raceDetail.distance_id !== undefined 
              ? (raceDetail.distance_id || null)
              : (race.distance_id !== undefined ? (race.distance_id || null) : null);
            
            return {
              ...race,
              distance_id: distanceId,
              distance: raceDetail.distance || null,
            };
          } catch (err) {
            console.error(`Erreur récupération distance pour course ${race.id}:`, err);
            // Si erreur, utiliser les données de base avec distance_id si présent
            return {
              ...race,
              distance_id: race.distance_id !== undefined ? (race.distance_id || null) : null,
            };
          }
        })
      );
      
      console.log("Courses chargées avec distance_id:", enrichedRaces.map(r => ({ 
        id: r.id, 
        name: r.name, 
        distance_id: r.distance_id 
      })));
      
      setRaces(enrichedRaces);
    } catch (err) {
      console.error("Erreur chargement courses", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les courses.",
        variant: "destructive",
      });
    }
  };

  const handleAdd = async () => {
    try {
      if (!eventId) return;

      // Validation selon le type de distance
      if (distanceType === "meters") {
        const meters = parseInt(newMeters, 10);
        if (isNaN(meters) || meters <= 0) {
          toast({
            title: "Erreur de validation",
            description: "Veuillez entrer une distance valide en mètres.",
            variant: "destructive",
          });
          return;
        }

        if (isRelay) {
          const count = typeof relayCount === "number" ? relayCount : parseInt(String(relayCount), 10);
          if (isNaN(count) || count < 2 || count > 20) {
            toast({
              title: "Erreur de validation",
              description: "Pour un relais, le nombre de relais doit être entre 2 et 20.",
              variant: "destructive",
            });
            return;
          }
        }

        const payload: any = {
          event_id: eventId,
          meters,
          is_time_based: false,
          duration_seconds: null,
          is_relay: isRelay,
        };

        if (isRelay && typeof relayCount === "number") {
          payload.relay_count = relayCount;
        }

        await api.post("/distances", payload);
      } else {
        // Distance basée sur le temps
        const mins = typeof durationMinutes === "number" ? durationMinutes : 0;
        const secs = typeof durationSeconds === "number" ? durationSeconds : 0;
        const totalSeconds = mins * 60 + secs;

        if (totalSeconds <= 0) {
          toast({
            title: "Erreur de validation",
            description: "Veuillez entrer une durée valide (au moins 1 seconde).",
            variant: "destructive",
          });
          return;
        }

        const payload: any = {
          event_id: eventId,
          duration_seconds: totalSeconds,
          is_time_based: true,
          meters: null,
          is_relay: false,
          relay_count: null,
        };

        await api.post("/distances", payload);
      }

      toast({ title: "Distance ajoutée avec succès." });
      setNewMeters("");
      setIsRelay(false);
      setRelayCount("");
      setDistanceType("meters");
      setDurationMinutes("");
      setDurationSeconds("");
      setDialogOpen(false);
      fetchDistances();
    } catch (err: any) {
      toast({
        title: "Erreur à l'ajout",
        description: err?.response?.data?.message || "Impossible d'ajouter la distance.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/distances/${id}`);
      toast({ title: "Distance supprimée." });
      fetchDistances();
      // Recharger les catégories et courses pour mettre à jour les distances
      fetchCategories();
      fetchRaces();
    } catch (err) {
      toast({
        title: "Erreur suppression",
        description: "Impossible de supprimer la distance.",
        variant: "destructive",
      });
    }
  };

  // Fonction pour suggérer des réaffectations basées sur les noms
  const generateSuggestions = () => {
    type MatchType = { distanceId: string; label: string; score: number };
    const newSuggestions: Array<{
      id: string;
      name: string;
      type: "category" | "race";
      suggestedDistanceId: string | null;
      suggestedDistanceLabel: string;
      confidence: number;
    }> = [];

    // Normaliser le texte pour la comparaison
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .trim();
    };

    // Extraire les nombres d'un texte
    const extractNumbers = (text: string): number[] => {
      const matches = text.match(/\d+/g);
      return matches ? matches.map(Number) : [];
    };

    // Traiter les catégories non affectées
    categoriesByDistance.unassigned.forEach((category) => {
      const categoryName = normalizeText(category.label || category.code || "");
      let bestMatch: MatchType | null = null;

      distances.forEach((distance) => {
        const distanceLabel = normalizeText(distance.label || "");
        let score = 0;

        // Extraction des nombres
        const categoryNumbers = extractNumbers(category.label || category.code || "");
        const distanceNumbers: number[] = [];

        if (distance.meters) {
          distanceNumbers.push(distance.meters);
        }
        if (distance.duration_seconds) {
          distanceNumbers.push(distance.duration_seconds);
        }
        if (distance.relay_count) {
          distanceNumbers.push(distance.relay_count);
        }

        // Correspondance exacte des nombres
        if (categoryNumbers.length > 0 && distanceNumbers.length > 0) {
          const hasMatchingNumber = categoryNumbers.some((num) =>
            distanceNumbers.some((dNum) => Math.abs(num - dNum) <= 1)
          );
          if (hasMatchingNumber) {
            score += 50;
          }
        }

        // Correspondance de mots-clés
        const categoryWords = categoryName.split(/\s+/);
        const distanceWords = distanceLabel.split(/\s+/);

        categoryWords.forEach((word) => {
          if (word.length > 2 && distanceWords.includes(word)) {
            score += 20;
          }
        });

        // Correspondance partielle
        if (categoryName.includes(distanceLabel) || distanceLabel.includes(categoryName)) {
          score += 30;
        }

        // Correspondance pour "2000m", "2000 m", "2km", etc.
        if (distance.meters) {
          const meters = distance.meters;
          const patterns = [
            `${meters}`,
            `${meters}m`,
            `${meters} m`,
            `${meters / 1000}km`,
            `${meters / 1000} km`,
          ];
          patterns.forEach((pattern) => {
            if (categoryName.includes(pattern.toLowerCase())) {
              score += 40;
            }
          });
        }

        if (score > 0) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              distanceId: distance.id,
              label: distance.label || `${distance.meters || distance.duration_seconds || ""}`,
              score,
            };
          }
        }
      });

      // Vérifier et ajouter la suggestion
      if (bestMatch !== null) {
        const match = bestMatch as MatchType;
        if (match.score >= 30) {
          newSuggestions.push({
            id: category.id,
            name: category.label || category.code || "",
            type: "category",
            suggestedDistanceId: match.distanceId,
            suggestedDistanceLabel: match.label,
            confidence: Math.min(100, match.score),
          });
        }
      }
    });

    // Traiter les courses non affectées
    racesByDistance.unassigned.forEach((race) => {
      const raceName = normalizeText(race.name || "");
      let bestMatch: MatchType | null = null;

      distances.forEach((distance) => {
        const distanceLabel = normalizeText(distance.label || "");
        let score = 0;

        // Extraction des nombres
        const raceNumbers = extractNumbers(race.name || "");
        const distanceNumbers: number[] = [];

        if (distance.meters) {
          distanceNumbers.push(distance.meters);
        }
        if (distance.duration_seconds) {
          distanceNumbers.push(distance.duration_seconds);
        }
        if (distance.relay_count) {
          distanceNumbers.push(distance.relay_count);
        }

        // Correspondance exacte des nombres
        if (raceNumbers.length > 0 && distanceNumbers.length > 0) {
          const hasMatchingNumber = raceNumbers.some((num) =>
            distanceNumbers.some((dNum) => Math.abs(num - dNum) <= 1)
          );
          if (hasMatchingNumber) {
            score += 50;
          }
        }

        // Correspondance de mots-clés
        const raceWords = raceName.split(/\s+/);
        const distanceWords = distanceLabel.split(/\s+/);

        raceWords.forEach((word) => {
          if (word.length > 2 && distanceWords.includes(word)) {
            score += 20;
          }
        });

        // Correspondance partielle
        if (raceName.includes(distanceLabel) || distanceLabel.includes(raceName)) {
          score += 30;
        }

        if (score > 0) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              distanceId: distance.id,
              label: distance.label || `${distance.meters || distance.duration_seconds || ""}`,
              score,
            };
          }
        }
      });

      // Vérifier et ajouter la suggestion
      if (bestMatch !== null) {
        const match = bestMatch as MatchType;
        if (match.score >= 30) {
          newSuggestions.push({
            id: race.id,
            name: race.name || "",
            type: "race",
            suggestedDistanceId: match.distanceId,
            suggestedDistanceLabel: match.label,
            confidence: Math.min(100, match.score),
          });
        }
      }
    });

    setSuggestions(newSuggestions);
    setSelectedSuggestions(new Set(newSuggestions.map((s) => s.id)));
    return newSuggestions;
  };

  const handleOpenAutoAssign = () => {
    const newSuggestions = generateSuggestions();
    if (newSuggestions.length === 0) {
      toast({
        title: "Aucune suggestion",
        description: "Aucune réaffectation automatique suggérée.",
      });
      return;
    }
    setAutoAssignDialogOpen(true);
  };

  const handleApplySuggestions = () => {
    if (selectedSuggestions.size === 0) {
      toast({
        title: "Aucune sélection",
        description: "Veuillez sélectionner au moins une réaffectation.",
        variant: "destructive",
      });
      return;
    }

    const toApply = suggestions.filter((s) => selectedSuggestions.has(s.id));

    // Appliquer les réaffectations localement (mise à jour de l'état)
    const newPendingChanges: Array<{
      type: "category" | "race";
      id: string;
      newDistanceId: string | null;
      oldDistanceId: string | null;
      name: string;
    }> = [];

    for (const suggestion of toApply) {
      // Trouver l'élément actuel pour obtenir son ancienne distance
      let oldDistanceId: string | null = null;
      let itemName = "Inconnu";

      if (suggestion.type === "category") {
        const category = categories.find((c) => c.id === suggestion.id);
        if (category) {
          oldDistanceId = category.distance_id || null;
          itemName = category.label || category.code || "Inconnu";
          
          // Mettre à jour l'état local
          setCategories((prev) =>
            prev.map((cat) =>
              cat.id === suggestion.id
                ? { ...cat, distance_id: suggestion.suggestedDistanceId }
                : cat
            )
          );
        }
      } else {
        const race = races.find((r) => r.id === suggestion.id);
        if (race) {
          oldDistanceId = race.distance_id || null;
          itemName = race.name || "Inconnu";
          
          // Mettre à jour l'état local
          setRaces((prev) =>
            prev.map((r) =>
              r.id === suggestion.id
                ? { ...r, distance_id: suggestion.suggestedDistanceId }
                : r
            )
          );
        }
      }

      // Ajouter aux changements en attente (vérifier si existe déjà)
      const existingIndex = pendingChanges.findIndex(
        (p) => p.id === suggestion.id && p.type === suggestion.type
      );

      if (existingIndex >= 0) {
        // Mettre à jour le changement existant
        setPendingChanges((prev) => {
          const updated = [...prev];
          updated[existingIndex] = {
            type: suggestion.type,
            id: suggestion.id,
            newDistanceId: suggestion.suggestedDistanceId,
            oldDistanceId: oldDistanceId,
            name: itemName,
          };
          return updated;
        });
      } else {
        // Ajouter un nouveau changement
        newPendingChanges.push({
          type: suggestion.type,
          id: suggestion.id,
          newDistanceId: suggestion.suggestedDistanceId,
          oldDistanceId: oldDistanceId,
          name: itemName,
        });
      }
    }

    // Ajouter les nouveaux changements
    if (newPendingChanges.length > 0) {
      setPendingChanges((prev) => [...prev, ...newPendingChanges]);
    }

    setHasUnsavedChanges(true);

    toast({
      title: "Réaffectations préparées",
      description: `${toApply.length} réaffectation${toApply.length > 1 ? "s" : ""} préparée${toApply.length > 1 ? "s" : ""}. N'oubliez pas de cliquer sur "Enregistrer les changements" pour sauvegarder.`,
    });

    setAutoAssignDialogOpen(false);
    setSuggestions([]);
    setSelectedSuggestions(new Set());
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  // Fonction pour sauvegarder tous les changements en attente
  const handleSaveAllChanges = async () => {
    if (pendingChanges.length === 0) {
      toast({
        title: "Aucun changement",
        description: "Il n'y a aucun changement à sauvegarder.",
      });
      return;
    }

    setIsSaving(true);
    setSavingItemId(null); // Pas d'élément spécifique, on sauvegarde tout

    try {
      // Sauvegarder tous les changements en parallèle
      const savePromises = pendingChanges.map(async (change) => {
        const endpoint = change.type === "category" 
          ? `/categories/${change.id}` 
          : `/races/${change.id}`;
        
        const payload = { distance_id: change.newDistanceId };
        
        console.log(`📤 ENVOI API ${change.type} ${change.name} (${change.id}):`, { 
          endpoint, 
          payload,
          from: change.oldDistanceId,
          to: change.newDistanceId
        });
        
        try {
          const response = await api.put(endpoint, payload);
          
          // Vérifier immédiatement ce que l'API a retourné
          const returnedDistanceId = response.data?.data?.distance_id ?? response.data?.distance_id ?? null;
          console.log(`📥 RÉPONSE API ${change.type} ${change.name} (${change.id}):`, {
            status: response.status,
            returnedDistanceId: returnedDistanceId,
            expected: change.newDistanceId,
            match: returnedDistanceId === change.newDistanceId,
            fullResponse: response.data
          });
          
          return {
            success: true,
            change,
            response: response.data,
            returnedDistanceId: returnedDistanceId,
          };
        } catch (err: any) {
          console.error(`❌ ERREUR API ${change.type} ${change.name} (${change.id}):`, {
            status: err?.response?.status,
            data: err?.response?.data,
            message: err?.message,
          });
          throw err;
        }
      });

      // Attendre que toutes les sauvegardes soient terminées
      const results = await Promise.allSettled(savePromises);
      
      // Vérifier les résultats
      const successful: any[] = [];
      const failed: any[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.success) {
          successful.push(result.value);
        } else {
          failed.push({
            change: pendingChanges[index],
            error: result.status === "rejected" ? result.reason : result.value,
          });
        }
      });

      if (failed.length > 0) {
        console.error("❌ ERREURS lors de la sauvegarde:", failed);
        failed.forEach(f => {
          console.error("Élément en échec:", {
            type: f.change.type,
            id: f.change.id,
            name: f.change.name,
            error: f.error,
          });
        });
        toast({
          title: "Erreur partielle",
          description: `${successful.length} modification(s) sauvegardée(s), ${failed.length} erreur(s).`,
          variant: "destructive",
        });
        // Ne pas vider les changements si certains ont échoué
        if (successful.length > 0) {
          // Retirer seulement les changements réussis
          setPendingChanges((prev) => 
            prev.filter(p => !successful.some(s => s.change.id === p.id && s.change.type === p.type))
          );
        }
        return;
      }

      // Vérifier immédiatement si l'API a retourné les bonnes valeurs
      console.log("🔍 Vérification immédiate des réponses API...");
      const immediateMismatches = successful.filter(s => {
        const returned = s.returnedDistanceId;
        const expected = s.change.newDistanceId;
        const match = returned === expected;
        if (!match) {
          console.error(`❌ IMMÉDIAT: ${s.change.type} ${s.change.name} - Attendu: ${expected}, Reçu: ${returned}`);
        }
        return !match;
      });

      if (immediateMismatches.length > 0) {
        console.error(`❌ ${immediateMismatches.length} élément(s) retourné(s) par l'API avec une distance_id incorrecte dès la réponse !`);
        toast({
          title: "⚠️ Problème API détecté",
          description: `${immediateMismatches.length} élément(s) ont été retourné(s) par l'API avec une distance_id incorrecte. Cela peut indiquer un problème côté backend.`,
          variant: "destructive",
        });
      }

      // Toutes les sauvegardes ont réussi, maintenant vérifier la persistance
      console.log("🔍 Début de la vérification de persistance pour", pendingChanges.length, "changements");
      
      // Fonction de vérification réutilisable
      const verifyChange = async (change: typeof pendingChanges[0], attempt: number = 1): Promise<{
        change: typeof pendingChanges[0];
        verified: boolean;
        expected: string | null;
        actual: string | null;
      }> => {
        try {
          const verifyResponse = await api.get(
            change.type === "category" ? `/categories/${change.id}` : `/races/${change.id}`,
            { params: { _t: Date.now() + attempt } } // Cache-busting par tentative
          );
          
          const verifiedDistanceId = verifyResponse.data?.data?.distance_id ?? verifyResponse.data?.distance_id ?? null;
          const normalizedVerified = verifiedDistanceId !== undefined ? verifiedDistanceId : null;
          const normalizedTarget = change.newDistanceId !== undefined ? change.newDistanceId : null;
          
          const verified = normalizedVerified === normalizedTarget;
          
          if (!verified) {
            console.warn(`⚠️ Tentative ${attempt}: ${change.type} ${change.name} (${change.id})`, {
              expected: normalizedTarget,
              actual: normalizedVerified,
            });
          } else {
            console.log(`✅ Tentative ${attempt}: ${change.type} ${change.name} (${change.id}) vérifié`);
          }
          
          return {
            change,
            verified,
            expected: normalizedTarget,
            actual: normalizedVerified,
          };
        } catch (err) {
          console.error(`❌ Erreur vérification tentative ${attempt} ${change.type} ${change.id}:`, err);
          return {
            change,
            verified: false,
            expected: change.newDistanceId ?? null,
            actual: null,
          };
        }
      };

      // Première vérification : immédiate
      console.log("📋 Première vérification (immédiate)...");
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let allVerifications = await Promise.all(
        pendingChanges.map(change => verifyChange(change, 1))
      );
      let verifiedCount = allVerifications.filter(v => v.verified).length;
      
      // Si toutes les vérifications passent du premier coup, continuer
      if (verifiedCount < pendingChanges.length) {
        console.log(`⚠️ Première vérification: ${verifiedCount}/${pendingChanges.length} réussies, nouvelle tentative dans 500ms...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Deuxième vérification
        allVerifications = await Promise.all(
          pendingChanges.map(change => verifyChange(change, 2))
        );
        verifiedCount = allVerifications.filter(v => v.verified).length;
      }
      
      // Si toujours pas tout vérifié, troisième tentative
      if (verifiedCount < pendingChanges.length) {
        console.log(`⚠️ Deuxième vérification: ${verifiedCount}/${pendingChanges.length} réussies, nouvelle tentative dans 1000ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        allVerifications = await Promise.all(
          pendingChanges.map(change => verifyChange(change, 3))
        );
        verifiedCount = allVerifications.filter(v => v.verified).length;
      }

      // Recharger toutes les données de l'API
      console.log("🔄 Rechargement des données depuis l'API...");
      await Promise.all([fetchCategories(), fetchRaces()]);
      
      // Attendre un peu pour que les données soient bien chargées
      await new Promise(resolve => setTimeout(resolve, 300));

      // Vérification finale : vérifier que les éléments sont bien dans les bonnes zones après rechargement
      console.log("🔍 Vérification finale après rechargement...");
      const finalVerifications = await Promise.all(
        pendingChanges.map(async (change) => {
          try {
            // Vérifier dans les données locales rechargées
            let foundItem: Category | Race | undefined;
            if (change.type === "category") {
              foundItem = categories.find(c => c.id === change.id);
            } else {
              foundItem = races.find(r => r.id === change.id);
            }

            if (!foundItem) {
              console.warn(`⚠️ ${change.type} ${change.name} (${change.id}) non trouvé après rechargement`);
              // Essayer de récupérer directement depuis l'API
              const apiResponse = await api.get(
                change.type === "category" ? `/categories/${change.id}` : `/races/${change.id}`,
                { params: { _t: Date.now() } }
              );
              const apiItem = apiResponse.data?.data || apiResponse.data;
              const apiDistanceId = apiItem?.distance_id ?? null;
              const normalizedApi = apiDistanceId !== undefined ? apiDistanceId : null;
              const normalizedTarget = change.newDistanceId !== undefined ? change.newDistanceId : null;
              
              return {
                change,
                verified: normalizedApi === normalizedTarget,
                source: "api",
              };
            }

            const itemDistanceId = foundItem.distance_id ?? null;
            const normalizedItem = itemDistanceId !== undefined ? itemDistanceId : null;
            const normalizedTarget = change.newDistanceId !== undefined ? change.newDistanceId : null;
            
            const verified = normalizedItem === normalizedTarget;
            
            if (!verified) {
              console.error(`❌ Vérification finale échouée: ${change.type} ${change.name} (${change.id})`, {
                expected: normalizedTarget,
                actual: normalizedItem,
                foundIn: change.type === "category" ? "categories" : "races",
              });
            } else {
              console.log(`✅ Vérification finale réussie: ${change.type} ${change.name} (${change.id})`);
            }
            
            return {
              change,
              verified,
              source: "local",
            };
          } catch (err) {
            console.error(`❌ Erreur vérification finale ${change.type} ${change.id}:`, err);
            return {
              change,
              verified: false,
              source: "error",
            };
          }
        })
      );

      const finalVerifiedCount = finalVerifications.filter(v => v.verified).length;
      const totalCount = pendingChanges.length;

      if (finalVerifiedCount === totalCount) {
        // TOUTES les vérifications ont réussi
        console.log(`✅✅✅ TOUTES les ${totalCount} modifications sont vérifiées et persistées en base de données !`);
        
        // Sauvegarder le nombre avant de vider
        const savedCount = totalCount;
        
        // Vider les changements en attente
        setPendingChanges([]);
        setHasUnsavedChanges(false);
        
        toast({
          title: "✅ Modifications enregistrées et vérifiées",
          description: `${savedCount} modification(s) sauvegardée(s) et vérifiée(s) avec succès en base de données.`,
        });
      } else {
        // Certaines vérifications ont échoué
        const failedChanges = finalVerifications.filter(v => !v.verified).map(v => v.change);
        console.error(`❌ ÉCHEC: Seulement ${finalVerifiedCount}/${totalCount} modifications vérifiées`);
        console.error("Éléments non vérifiés:", failedChanges);
        
        toast({
          title: "⚠️ Vérification incomplète",
          description: `${finalVerifiedCount}/${totalCount} modification(s) vérifiée(s). ${totalCount - finalVerifiedCount} modification(s) n'ont pas pu être vérifiées. Les données ont été sauvegardées mais certaines vérifications ont échoué. Veuillez rafraîchir la page pour vérifier.`,
          variant: "destructive",
        });
        
        // Vider quand même les changements pour éviter de réessayer indéfiniment
        // L'utilisateur devra vérifier manuellement
        setPendingChanges([]);
        setHasUnsavedChanges(false);
      }
    } catch (err: any) {
      console.error("Erreur lors de la sauvegarde globale:", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || err?.message || "Impossible de sauvegarder les modifications.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Fonction pour annuler tous les changements en attente
  const handleDiscardChanges = () => {
    // Restaurer les valeurs originales
    pendingChanges.forEach((change) => {
      if (change.type === "category") {
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === change.id ? { ...cat, distance_id: change.oldDistanceId } : cat
          )
        );
      } else if (change.type === "race") {
        setRaces((prev) =>
          prev.map((race) =>
            race.id === change.id ? { ...race, distance_id: change.oldDistanceId } : race
          )
        );
      }
    });

    setPendingChanges([]);
    setHasUnsavedChanges(false);

    toast({
      title: "Changements annulés",
      description: "Tous les changements non sauvegardés ont été annulés.",
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Extraire le type et l'ID depuis les IDs
    let itemType: "category" | "race" | null = null;
    let itemId: string | null = null;

    if (activeId.startsWith("category-")) {
      itemType = "category";
      itemId = activeId.replace("category-", "");
    } else if (activeId.startsWith("race-")) {
      itemType = "race";
      itemId = activeId.replace("race-", "");
    }

    if (!itemType || !itemId) return;

    // Déterminer la distance cible
    let targetDistanceId: string | null = null;
    if (overId === "unassigned") {
      targetDistanceId = null;
    } else if (overId.startsWith("distance-")) {
      targetDistanceId = overId.replace("distance-", "");
    } else {
      // Si overId ne correspond à aucune zone valide, ne rien faire
      console.warn("Zone de drop non reconnue:", overId);
      return;
    }

    console.log("Drag end:", { itemType, itemId, targetDistanceId, overId });

    // Vérifier si la distance a vraiment changé
    const currentItem = itemType === "category"
      ? categories.find((c) => c.id === itemId)
      : races.find((r) => r.id === itemId);

    if (!currentItem) return;

    const currentDistanceId = itemType === "category"
      ? (currentItem as Category).distance_id
      : (currentItem as Race).distance_id;

    // Si la distance n'a pas changé, ne rien faire
    if (currentDistanceId === targetDistanceId) return;

    // Mettre à jour l'état local immédiatement pour un feedback visuel
    const itemName = itemType === "category"
      ? (categories.find((c) => c.id === itemId)?.label || categories.find((c) => c.id === itemId)?.code || "Inconnu")
      : (races.find((r) => r.id === itemId)?.name || "Inconnu");

    if (itemType === "category") {
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === itemId ? { ...cat, distance_id: targetDistanceId } : cat
        )
      );
    } else if (itemType === "race") {
      setRaces((prev) =>
        prev.map((race) =>
          race.id === itemId ? { ...race, distance_id: targetDistanceId } : race
        )
      );
    }

    // Ajouter aux changements en attente au lieu de sauvegarder immédiatement
    setPendingChanges((prev) => {
      // Vérifier si un changement pour cet élément existe déjà
      const existingIndex = prev.findIndex(p => p.id === itemId && p.type === itemType);
      const newChange = {
        type: itemType,
        id: itemId,
        newDistanceId: targetDistanceId,
        oldDistanceId: currentDistanceId || null,
        name: itemName,
      };

      if (existingIndex >= 0) {
        // Remplacer le changement existant
        const updated = [...prev];
        updated[existingIndex] = newChange;
        return updated;
      } else {
        // Ajouter un nouveau changement
        return [...prev, newChange];
      }
    });

    setHasUnsavedChanges(true);
  };


  // Organiser les catégories par distance
  const categoriesByDistance = (() => {
    const grouped: Record<string, Category[]> = { unassigned: [] };
    distances.forEach((dist) => {
      grouped[dist.id] = [];
    });

    categories.forEach((cat) => {
      const distanceId = cat.distance_id;
      
      if (distanceId && grouped[distanceId]) {
        grouped[distanceId].push(cat);
      } else {
        grouped.unassigned.push(cat);
      }
    });

    return grouped;
  })();

  // Organiser les courses par distance
  const racesByDistance = (() => {
    const grouped: Record<string, Race[]> = { unassigned: [] };
    distances.forEach((dist) => {
      grouped[dist.id] = [];
    });

    races.forEach((race) => {
      const distanceId = race.distance_id;
      
      if (distanceId && grouped[distanceId]) {
        grouped[distanceId].push(race);
      } else {
        grouped.unassigned.push(race);
      }
    });

    return grouped;
  })();

  // Compter les éléments non affectés
  const unassignedCategoriesCount = categoriesByDistance.unassigned.length;
  const unassignedRacesCount = racesByDistance.unassigned.length;

  useEffect(() => {
    if (eventId) {
      setLoading(true);
      Promise.all([fetchDistances(), fetchCategories(), fetchRaces()]).finally(() => {
        setLoading(false);
      });
    }
  }, [eventId]);

  const activeItem = activeId
    ? categories.find((c) => `category-${c.id}` === activeId) ||
      races.find((r) => `race-${r.id}` === activeId)
    : null;

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header amélioré */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Gauge className="w-8 h-8 text-blue-600" />
            Gestion des distances
          </h1>
          <p className="text-muted-foreground mt-2">
            Organisez les catégories et courses par distance avec drag & drop
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <Button
            variant={viewMode === "categories" ? "default" : "outline"}
            onClick={() => setViewMode("categories")}
            className="gap-2 relative"
          >
            <Tag className="w-4 h-4" />
            Catégories
            {unassignedCategoriesCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                {unassignedCategoriesCount > 9 ? '9+' : unassignedCategoriesCount}
              </span>
            )}
          </Button>
          <Button
            variant={viewMode === "races" ? "default" : "outline"}
            onClick={() => setViewMode("races")}
            className="gap-2 relative"
          >
            <Trophy className="w-4 h-4" />
            Courses
            {unassignedRacesCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                {unassignedRacesCount > 9 ? '9+' : unassignedRacesCount}
              </span>
            )}
          </Button>
          {(unassignedCategoriesCount > 0 || unassignedRacesCount > 0) && (
            <Button
              variant="outline"
              onClick={handleOpenAutoAssign}
              className="gap-2"
            >
              <Wand2 className="w-4 h-4" />
              Réaffectation automatique
            </Button>
          )}
          {hasUnsavedChanges && (
            <Button
              variant="default"
              onClick={handleSaveAllChanges}
              disabled={isSaving || pendingChanges.length === 0}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer les changements ({pendingChanges.length})
                </>
              )}
            </Button>
          )}
          {hasUnsavedChanges && (
            <Button
              variant="outline"
              onClick={handleDiscardChanges}
              disabled={isSaving}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Annuler
            </Button>
          )}
        </div>
      </div>

      {/* Liste des distances améliorée */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="w-5 h-5 text-blue-600" />
            Liste des distances
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              {distances.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-muted-foreground">Chargement...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {distances.map((distance) => {
                return (
                  <Card 
                    key={distance.id} 
                    className="text-center p-4 flex flex-col items-center hover:shadow-lg transition-all border-2 border-blue-100 hover:border-blue-300 bg-gradient-to-br from-blue-50 to-white group"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold mb-2 shadow-md group-hover:scale-110 transition-transform">
                      {distance.label && distance.label.trim() !== "" 
                        ? distance.label 
                        : (distance.is_time_based && distance.duration_seconds
                          ? (() => {
                              const minutes = Math.floor(distance.duration_seconds / 60);
                              const seconds = distance.duration_seconds % 60;
                              if (minutes > 0 && seconds > 0) {
                                return `${minutes}min ${seconds}s`;
                              } else if (minutes > 0) {
                                return `${minutes}min`;
                              } else {
                                return `${distance.duration_seconds}s`;
                              }
                            })()
                          : distance.is_relay && distance.relay_count && distance.meters
                          ? `${distance.relay_count}x${distance.meters}m`
                          : distance.meters
                          ? `${distance.meters}m`
                          : "?")}
                    </div>
                    <div className="text-xs font-medium text-blue-700 mb-3 flex items-center gap-1">
                      {distance.is_relay ? (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Relais
                        </>
                      ) : distance.is_time_based ? (
                        <>
                          <Gauge className="w-3 h-3" />
                          Temps
                        </>
                      ) : (
                        <>
                          <Gauge className="w-3 h-3" />
                          Mètres
                        </>
                      )}
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDelete(distance.id)}
                      className="w-full text-xs"
                    >
                      Supprimer
                    </Button>
                  </Card>
                );
              })}

              {/* Carte pour ajout avec modale */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Card className="flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gradient-to-br from-gray-50 to-white group min-h-[180px]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <PlusIcon className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="font-semibold text-blue-600 group-hover:text-blue-700">Ajouter une distance</div>
                  </Card>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter une distance</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div>
                      <Label>Type de distance</Label>
                      <Select
                        value={distanceType}
                        onValueChange={(val) => {
                          setDistanceType(val as "meters" | "time");
                          if (val === "time") {
                            setIsRelay(false);
                            setRelayCount("");
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meters">Distance (mètres)</SelectItem>
                          <SelectItem value="time">Durée (temps)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {distanceType === "meters" ? (
                      <>
                        <div>
                          <Label>Type de course</Label>
                          <div className="flex items-center space-x-2 mt-2">
                            <Checkbox
                              id="is-relay"
                              checked={isRelay}
                              onCheckedChange={(checked) => {
                                setIsRelay(checked === true);
                                if (!checked) {
                                  setRelayCount("");
                                }
                              }}
                            />
                            <Label htmlFor="is-relay" className="font-normal cursor-pointer">
                              Course en relais
                            </Label>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="new-distance">
                            {isRelay ? "Distance d'un relais (en mètres)" : "Distance (en mètres)"}
                          </Label>
                          <Input
                            id="new-distance"
                            type="number"
                            min="100"
                            placeholder={isRelay ? "Ex: 250 (pour 8x250m)" : "Ex: 1000"}
                            value={newMeters}
                            onChange={(e) => setNewMeters(e.target.value)}
                          />
                        </div>
                        {isRelay && (
                          <div>
                            <Label htmlFor="relay-count">Nombre de relais *</Label>
                            <Input
                              id="relay-count"
                              type="number"
                              min="2"
                              max="20"
                              placeholder="Ex: 8 (pour 8x250m)"
                              value={relayCount}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                                setRelayCount(val);
                              }}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Entre 2 et 20 relais (ex: 8 pour 8x250m, 4 pour 4x500m)
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="duration-minutes">Minutes</Label>
                            <Input
                              id="duration-minutes"
                              type="number"
                              min="0"
                              placeholder="Ex: 2"
                              value={durationMinutes}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                                setDurationMinutes(val);
                              }}
                            />
                          </div>
                          <div>
                            <Label htmlFor="duration-seconds">Secondes</Label>
                            <Input
                              id="duration-seconds"
                              type="number"
                              min="0"
                              max="59"
                              placeholder="Ex: 30"
                              value={durationSeconds}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                                if (typeof val === "number" && val >= 60) {
                                  setDurationSeconds(59);
                                } else {
                                  setDurationSeconds(val);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Exemples : 2 minutes = 2 min 0 sec, 1 minute 30 secondes = 1 min 30 sec
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button onClick={handleAdd}>Ajouter</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bannière d'alerte pour les changements non sauvegardés */}
      {hasUnsavedChanges && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertCircle className="w-4 h-4 text-orange-600" />
          <AlertTitle className="text-orange-900">Changements non sauvegardés</AlertTitle>
          <AlertDescription className="text-orange-800">
            Vous avez {pendingChanges.length} modification(s) en attente. N'oubliez pas de cliquer sur "Enregistrer les changements" pour sauvegarder.
          </AlertDescription>
        </Alert>
      )}

      {/* Interface drag-and-drop */}
      {!loading && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Zone "Non affecté" */}
              <DroppableDistance
                distance={{ id: "unassigned", label: "Non affecté" }}
                items={viewMode === "categories" ? categoriesByDistance.unassigned : racesByDistance.unassigned}
                type={viewMode === "categories" ? "category" : "race"}
                savingItemId={savingItemId}
              />

              {/* Zones pour chaque distance */}
              {distances.map((distance) => (
                <DroppableDistance
                  key={distance.id}
                  distance={distance}
                  items={
                    viewMode === "categories"
                      ? categoriesByDistance[distance.id] || []
                      : racesByDistance[distance.id] || []
                  }
                  type={viewMode === "categories" ? "category" : "race"}
                  savingItemId={savingItemId}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeItem && (
              <div className={clsx(
                "p-4 border-2 rounded-lg bg-white shadow-xl opacity-95",
                viewMode === "categories" ? "border-blue-400" : "border-amber-400"
              )}>
                {viewMode === "categories" ? (
                  <>
                    <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-600" />
                      {(activeItem as Category).label || (activeItem as Category).code}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      Course {(activeItem as Race).race_number} - {(activeItem as Race).name}
                    </div>
                  </>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal de réaffectation automatique */}
      <Dialog open={autoAssignDialogOpen} onOpenChange={setAutoAssignDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-blue-600" />
              Réaffectation automatique
            </DialogTitle>
            <DialogDescription>
              Suggestions de réaffectation basées sur les noms des catégories/courses et des distances.
              Sélectionnez les réaffectations à appliquer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune suggestion disponible.
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion) => {
                  const isSelected = selectedSuggestions.has(suggestion.id);
                  const confidenceColor =
                    suggestion.confidence >= 70
                      ? "text-green-600"
                      : suggestion.confidence >= 50
                      ? "text-yellow-600"
                      : "text-orange-600";

                  return (
                    <div
                      key={suggestion.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        const newSelected = new Set(selectedSuggestions);
                        if (isSelected) {
                          newSelected.delete(suggestion.id);
                        } else {
                          newSelected.add(suggestion.id);
                        }
                        setSelectedSuggestions(newSelected);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedSuggestions);
                            if (checked) {
                              newSelected.add(suggestion.id);
                            } else {
                              newSelected.delete(suggestion.id);
                            }
                            setSelectedSuggestions(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                              {suggestion.type === "category" ? "Catégorie" : "Course"}
                            </span>
                            <span className="font-semibold text-slate-900">{suggestion.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-slate-700">
                              Affecter à : <strong>{suggestion.suggestedDistanceLabel}</strong>
                            </span>
                            <span className={`text-xs font-medium ${confidenceColor}`}>
                              ({suggestion.confidence}% de confiance)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground">
              {selectedSuggestions.size} sur {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""} sélectionnée{selectedSuggestions.size > 1 ? "s" : ""}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAutoAssignDialogOpen(false);
                  setSelectedSuggestions(new Set());
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button
                onClick={handleApplySuggestions}
                disabled={selectedSuggestions.size === 0}
              >
                <Check className="w-4 h-4 mr-2" />
                Appliquer ({selectedSuggestions.size})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
