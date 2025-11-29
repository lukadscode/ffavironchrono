import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Tag, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import api from "@/lib/axios";

interface Category {
  id: string;
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

export default function CategoriesList({ categories, eventId }: { categories: Category[]; eventId?: string }) {
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [categoriesWithDistances, setCategoriesWithDistances] = useState<Category[]>(categories);

  // Enrichir les catégories avec leurs distances si eventId est fourni
  useEffect(() => {
    const enrichCategories = async () => {
      if (!eventId || categories.length === 0) {
        setCategoriesWithDistances(categories);
        return;
      }

      try {
        // Récupérer toutes les distances de l'événement
        const distancesRes = await api.get(`/distances/event/${eventId}`);
        const distances = distancesRes.data.data || [];
        
        // Créer un map pour accéder rapidement aux distances
        const distanceMap = new Map(distances.map((d: any) => [d.id, d]));

        // Récupérer les détails complets des catégories avec leurs distances
        const enrichedCategories = await Promise.all(
          categories.map(async (cat) => {
            try {
              // Si la catégorie a déjà une distance, l'utiliser
              if (cat.distance) {
                return cat;
              }
              
              // Sinon, essayer de récupérer la catégorie complète
              if (cat.distance_id) {
                const distance = distanceMap.get(cat.distance_id) as any;
                if (distance && distance.id) {
                  return { 
                    ...cat, 
                    distance: {
                      id: distance.id,
                      meters: distance.meters,
                      is_time_based: distance.is_time_based || false,
                      duration_seconds: distance.duration_seconds || null,
                      label: distance.label,
                    }
                  };
                }
              }

              // Essayer de récupérer la catégorie complète via l'API
              const categoryRes = await api.get(`/categories/${cat.id}`);
              const categoryData = categoryRes.data.data || categoryRes.data;
              
              // Si la catégorie a une distance_id, récupérer la distance
              if (categoryData.distance_id) {
                const distance = distanceMap.get(categoryData.distance_id) as any;
                if (distance && distance.id && distance.meters !== undefined) {
                  return { 
                    ...cat, 
                    distance_id: categoryData.distance_id,
                    distance: {
                      id: distance.id,
                      meters: distance.meters,
                      label: distance.label,
                    }
                  };
                }
              }

              return cat;
            } catch (err) {
              console.error(`Erreur chargement distance pour catégorie ${cat.id}:`, err);
              return cat;
            }
          })
        );

        setCategoriesWithDistances(enrichedCategories);
      } catch (err) {
        console.error("Erreur chargement distances", err);
        setCategoriesWithDistances(categories);
      }
    };

    enrichCategories();
  }, [eventId, categories]);

  // Trier les catégories par distance (en mètres) puis par nom
  // Les distances basées sur le temps sont triées après les distances en mètres
  const sortedCategories = useMemo(() => {
    return [...categoriesWithDistances].sort((a, b) => {
      // Si une distance est basée sur le temps, la mettre après
      if (a.distance?.is_time_based && !b.distance?.is_time_based) return 1;
      if (!a.distance?.is_time_based && b.distance?.is_time_based) return -1;
      
      // Si les deux sont basées sur le temps, trier par duration_seconds
      if (a.distance?.is_time_based && b.distance?.is_time_based) {
        const durationA = a.distance?.duration_seconds || 0;
        const durationB = b.distance?.duration_seconds || 0;
        if (durationA !== durationB) return durationA - durationB;
      }
      
      // Sinon, trier par meters
      const distanceA = a.distance?.meters || 0;
      const distanceB = b.distance?.meters || 0;
      
      // Les catégories sans distance vont à la fin
      if (distanceA === 0 && distanceB === 0) {
        // Si les deux n'ont pas de distance, trier par nom
        return (a.label || "").localeCompare(b.label || "");
      }
      if (distanceA === 0) return 1;
      if (distanceB === 0) return -1;
      
      // Trier par distance croissante
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      
      // Si même distance, trier par nom
      return (a.label || "").localeCompare(b.label || "");
    });
  }, [categoriesWithDistances]);

  if (categories.length === 0) {
    return null;
  }

  // Séparer les catégories avec et sans équipages (après tri)
  const categoriesWithCrews = sortedCategories.filter((cat) => cat.crew_count > 0);
  const emptyCategories = sortedCategories.filter((cat) => cat.crew_count === 0);

  // Catégories à afficher (utiliser sortedCategories pour préserver le tri)
  const categoriesToShow = showEmptyCategories
    ? sortedCategories
    : categoriesWithCrews;

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
              title={isExpanded ? "Masquer la liste" : "Afficher la liste"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="w-5 h-5 text-slate-600" />
              Catégories disponibles
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                {categoriesWithCrews.length}
                {emptyCategories.length > 0 && (
                  <span className="text-slate-500 ml-1">
                    / {categories.length}
                  </span>
                )}
              </span>
            </CardTitle>
          </div>
          {emptyCategories.length > 0 && isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEmptyCategories(!showEmptyCategories)}
              className="gap-2 text-xs"
            >
              {showEmptyCategories ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Masquer vides ({emptyCategories.length})
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Afficher vides ({emptyCategories.length})
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-4">
          {categoriesToShow.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune catégorie avec équipages</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {categoriesToShow.map((cat) => (
                <div
                  key={cat.id}
                  className={`group relative p-4 border rounded-lg bg-white hover:shadow-md transition-all duration-200 ${
                    cat.crew_count === 0
                      ? "border-gray-200 border-dashed opacity-60"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm truncate">
                        {cat.label}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">
                        {cat.crew_count} {cat.crew_count === 1 ? "équipage" : "équipages"}
                      </span>
                    </div>
                    {cat.distance && (
                      <div className="text-xs text-slate-500">
                        {cat.distance.label}
                      </div>
                    )}
                  </div>
                  {cat.crew_count > 0 && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                  )}
                  {cat.crew_count === 0 && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 bg-gray-300 rounded-full" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
