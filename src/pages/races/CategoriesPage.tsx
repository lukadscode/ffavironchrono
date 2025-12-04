import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag, Users, Plus, Search, Loader2 } from "lucide-react";
import CategoriesList from "@/components/races/CategoriesList";

interface Category {
  id: string;
  label: string;
  crew_count: number;
  code?: string;
}

interface AvailableCategory {
  id: string;
  code: string;
  label: string;
  age_group?: string;
  gender?: string;
  boat_seats?: number;
  has_coxswain?: boolean;
}

export default function CategoriesPage() {
  const { eventId } = useParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableCategories, setAvailableCategories] = useState<AvailableCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    code: "",
    label: "",
    age_group: "",
    gender: "",
    boat_seats: "",
    has_coxswain: false,
  });
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

  // Filtrer les catégories disponibles selon la recherche
  const filteredAvailableCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableCategories;
    }
    const query = searchQuery.toLowerCase();
    return availableCategories.filter(
      (cat) =>
        cat.code?.toLowerCase().includes(query) ||
        cat.label?.toLowerCase().includes(query) ||
        cat.age_group?.toLowerCase().includes(query) ||
        cat.gender?.toLowerCase().includes(query)
    );
  }, [availableCategories, searchQuery]);

  // Charger toutes les catégories disponibles
  const fetchAvailableCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await api.get("/categories");
      const allCategories = res.data.data || [];
      
      // Filtrer les catégories déjà dans l'événement
      const eventCategoryIds = new Set(categories.map(cat => cat.id));
      const available = allCategories.filter((cat: AvailableCategory) => !eventCategoryIds.has(cat.id));
      
      setAvailableCategories(available);
    } catch (err) {
      console.error("Erreur chargement catégories disponibles:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les catégories disponibles.",
        variant: "destructive",
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  // Ouvrir le dialog et charger les catégories disponibles
  const handleOpenDialog = () => {
    setDialogOpen(true);
    setSearchQuery("");
    setSelectedCategoryId("");
    setIsCreatingNew(false);
    setNewCategoryForm({
      code: "",
      label: "",
      age_group: "",
      gender: "",
      boat_seats: "",
      has_coxswain: false,
    });
    fetchAvailableCategories();
  };

  // Ajouter une catégorie existante à l'événement
  const handleAddExistingCategory = async () => {
    if (!selectedCategoryId || !eventId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une catégorie",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      // Essayer d'associer la catégorie à l'événement
      await api.post("/event-categories", {
        event_id: eventId,
        category_id: selectedCategoryId,
      });
      
      toast({
        title: "Succès",
        description: "Catégorie ajoutée à l'événement avec succès",
      });
      
      setDialogOpen(false);
      fetchCategories(); // Recharger les catégories de l'événement
    } catch (err: any) {
      console.error("Erreur ajout catégorie:", err);
      
      // Si l'endpoint n'existe pas, essayer une autre approche
      if (err?.response?.status === 404) {
        toast({
          title: "Information",
          description: "L'endpoint pour associer une catégorie n'est pas encore disponible. La catégorie existe mais doit être associée manuellement.",
        });
      } else {
        toast({
          title: "Erreur",
          description: err?.response?.data?.message || "Impossible d'ajouter la catégorie à l'événement",
          variant: "destructive",
        });
      }
    } finally {
      setIsAdding(false);
    }
  };

  // Créer une nouvelle catégorie et l'ajouter à l'événement
  const handleCreateAndAddCategory = async () => {
    if (!newCategoryForm.code.trim() || !newCategoryForm.label.trim()) {
      toast({
        title: "Erreur",
        description: "Le code et le label sont requis",
        variant: "destructive",
      });
      return;
    }

    if (!eventId) {
      toast({
        title: "Erreur",
        description: "ID d'événement manquant",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      // Créer la catégorie
      const payload = {
        code: newCategoryForm.code.trim(),
        label: newCategoryForm.label.trim(),
        age_group: newCategoryForm.age_group.trim() || null,
        gender: newCategoryForm.gender.trim() || null,
        boat_seats: newCategoryForm.boat_seats ? parseInt(newCategoryForm.boat_seats) : null,
        has_coxswain: newCategoryForm.has_coxswain,
      };

      const createRes = await api.post("/categories", payload);
      const newCategoryId = createRes.data?.data?.id || createRes.data?.id;

      if (newCategoryId) {
        // Associer la catégorie à l'événement
        try {
          await api.post("/event-categories", {
            event_id: eventId,
            category_id: newCategoryId,
          });
        } catch (linkErr: any) {
          // Si l'endpoint n'existe pas, on continue quand même
          if (linkErr?.response?.status !== 404) {
            console.error("Erreur association catégorie-événement:", linkErr);
          }
        }
      }

      toast({
        title: "Succès",
        description: "Catégorie créée et ajoutée à l'événement avec succès",
      });

      setDialogOpen(false);
      fetchCategories(); // Recharger les catégories de l'événement
    } catch (err: any) {
      console.error("Erreur création catégorie:", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de créer la catégorie",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

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
        <Button onClick={handleOpenDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter une catégorie
        </Button>
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

      {/* Dialog pour ajouter une catégorie */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter une catégorie à l'événement</DialogTitle>
            <DialogDescription>
              Recherchez une catégorie existante ou créez-en une nouvelle
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Barre de recherche */}
            <div className="space-y-2">
              <Label htmlFor="search">Rechercher une catégorie</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Rechercher par code, label, groupe d'âge, genre..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsCreatingNew(false);
                    setSelectedCategoryId("");
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Liste des catégories disponibles */}
            {!isCreatingNew && (
              <div className="space-y-2">
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAvailableCategories.length > 0 ? (
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {filteredAvailableCategories.map((cat) => (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={`p-3 cursor-pointer hover:bg-slate-50 border-b last:border-b-0 ${
                          selectedCategoryId === cat.id ? "bg-blue-50 border-blue-200" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{cat.label}</div>
                            <div className="text-sm text-muted-foreground">
                              Code: {cat.code}
                              {cat.age_group && ` • ${cat.age_group}`}
                              {cat.gender && ` • ${cat.gender}`}
                              {cat.boat_seats && ` • ${cat.boat_seats} places`}
                              {cat.has_coxswain && " • Avec barreur"}
                            </div>
                          </div>
                          {selectedCategoryId === cat.id && (
                            <Tag className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Aucune catégorie trouvée pour "{searchQuery}"</p>
                    <Button
                      variant="link"
                      onClick={() => setIsCreatingNew(true)}
                      className="mt-2"
                    >
                      Créer une nouvelle catégorie
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Aucune catégorie disponible</p>
                    <Button
                      variant="link"
                      onClick={() => setIsCreatingNew(true)}
                      className="mt-2"
                    >
                      Créer une nouvelle catégorie
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Formulaire pour créer une nouvelle catégorie */}
            {isCreatingNew && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Nouvelle catégorie</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewCategoryForm({
                        code: "",
                        label: "",
                        age_group: "",
                        gender: "",
                        boat_seats: "",
                        has_coxswain: false,
                      });
                    }}
                  >
                    Annuler
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code *</Label>
                    <Input
                      id="code"
                      placeholder="ex: M1X"
                      value={newCategoryForm.code}
                      onChange={(e) =>
                        setNewCategoryForm({ ...newCategoryForm, code: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="label">Label *</Label>
                    <Input
                      id="label"
                      placeholder="ex: Skiff homme"
                      value={newCategoryForm.label}
                      onChange={(e) =>
                        setNewCategoryForm({ ...newCategoryForm, label: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age_group">Groupe d'âge</Label>
                    <Input
                      id="age_group"
                      placeholder="ex: Senior, Junior"
                      value={newCategoryForm.age_group}
                      onChange={(e) =>
                        setNewCategoryForm({ ...newCategoryForm, age_group: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Genre</Label>
                    <Select
                      value={newCategoryForm.gender}
                      onValueChange={(value) =>
                        setNewCategoryForm({ ...newCategoryForm, gender: value })
                      }
                    >
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Homme</SelectItem>
                        <SelectItem value="F">Femme</SelectItem>
                        <SelectItem value="Mixte">Mixte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="boat_seats">Nombre de places</Label>
                    <Input
                      id="boat_seats"
                      type="number"
                      placeholder="ex: 1, 2, 4, 8"
                      value={newCategoryForm.boat_seats}
                      onChange={(e) =>
                        setNewCategoryForm({ ...newCategoryForm, boat_seats: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="has_coxswain">Avec barreur</Label>
                    <Select
                      value={newCategoryForm.has_coxswain ? "true" : "false"}
                      onValueChange={(value) =>
                        setNewCategoryForm({
                          ...newCategoryForm,
                          has_coxswain: value === "true",
                        })
                      }
                    >
                      <SelectTrigger id="has_coxswain">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Non</SelectItem>
                        <SelectItem value="true">Oui</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            {isCreatingNew ? (
              <Button onClick={handleCreateAndAddCategory} disabled={isAdding}>
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer et ajouter"
                )}
              </Button>
            ) : (
              <Button
                onClick={handleAddExistingCategory}
                disabled={!selectedCategoryId || isAdding}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ajout...
                  </>
                ) : (
                  "Ajouter"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

