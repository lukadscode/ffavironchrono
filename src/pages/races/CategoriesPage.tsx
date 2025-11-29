import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, Users } from "lucide-react";
import CategoriesList from "@/components/races/CategoriesList";

interface Category {
  id: string;
  label: string;
  crew_count: number;
}

export default function CategoriesPage() {
  const { eventId } = useParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCategories = async () => {
    if (!eventId) return;
    
    try {
      setLoading(true);
      const res = await api.get(`/categories/event/${eventId}/with-crews`);
      setCategories(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement catégories:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les catégories.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [eventId]);

  const totalCrews = categories.reduce((sum, cat) => sum + cat.crew_count, 0);
  const categoriesWithCrews = categories.filter((cat) => cat.crew_count > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Tag className="w-8 h-8 text-blue-600" />
            Catégories disponibles
          </h1>
          <p className="text-muted-foreground mt-2">
            Consultez toutes les catégories de l'événement et leurs équipages
          </p>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-blue-900">
                Catégories
              </CardTitle>
              <Tag className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{categories.length}</div>
            <p className="text-xs text-blue-700 mt-1">
              {categories.length === 1 ? "catégorie totale" : "catégories totales"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-900">
                Avec équipages
              </CardTitle>
              <Users className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{categoriesWithCrews.length}</div>
            <p className="text-xs text-green-700 mt-1">
              {categoriesWithCrews.length === 1 ? "catégorie avec équipages" : "catégories avec équipages"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-purple-900">
                Équipages
              </CardTitle>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{totalCrews}</div>
            <p className="text-xs text-purple-700 mt-1">
              {totalCrews === 1 ? "équipage enregistré" : "équipages enregistrés"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des catégories */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      ) : (
        <CategoriesList categories={categories} eventId={eventId} />
      )}
    </div>
  );
}

