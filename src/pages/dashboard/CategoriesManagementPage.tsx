import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Tag,
  Plus,
  Loader2,
  Trash2,
  Edit,
  AlertTriangle,
  Search,
  Award,
  Users,
  User,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = {
  id: string;
  code: string;
  label: string;
  age_group?: string;
  gender?: string;
  boat_seats?: number;
  has_coxswain?: boolean;
  distance_id?: string | null;
};

export default function CategoriesManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Formulaire
  const [formData, setFormData] = useState({
    code: "",
    label: "",
    age_group: "",
    gender: "",
    boat_seats: "",
    has_coxswain: false,
  });

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Filtrer les catégories selon la recherche
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories;
    }
    const query = searchQuery.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.code?.toLowerCase().includes(query) ||
        cat.label?.toLowerCase().includes(query) ||
        cat.age_group?.toLowerCase().includes(query) ||
        cat.gender?.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    fetchCategories();
  }, [isAdmin, navigate]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get("/categories");
      setCategories(res.data.data || []);
    } catch (err: any) {
      console.error("Erreur chargement catégories", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de charger les catégories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      code: "",
      label: "",
      age_group: "",
      gender: "",
      boat_seats: "",
      has_coxswain: false,
    });
    setDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setCategoryToEdit(category);
    setFormData({
      code: category.code || "",
      label: category.label || "",
      age_group: category.age_group || "",
      gender: category.gender || "",
      boat_seats: category.boat_seats?.toString() || "",
      has_coxswain: category.has_coxswain || false,
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.label.trim()) {
      toast({
        title: "Erreur",
        description: "Le code et le label sont requis",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim(),
        label: formData.label.trim(),
        age_group: formData.age_group.trim() || null,
        gender: formData.gender.trim() || null,
        boat_seats: formData.boat_seats ? parseInt(formData.boat_seats) : null,
        has_coxswain: formData.has_coxswain,
      };

      await api.post("/categories", payload);
      toast({
        title: "Succès",
        description: "Catégorie créée avec succès",
      });
      setDialogOpen(false);
      fetchCategories();
    } catch (err: any) {
      console.error("Erreur création catégorie", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de créer la catégorie",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!categoryToEdit) return;

    if (!formData.code.trim() || !formData.label.trim()) {
      toast({
        title: "Erreur",
        description: "Le code et le label sont requis",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim(),
        label: formData.label.trim(),
        age_group: formData.age_group.trim() || null,
        gender: formData.gender.trim() || null,
        boat_seats: formData.boat_seats ? parseInt(formData.boat_seats) : null,
        has_coxswain: formData.has_coxswain,
      };

      await api.put(`/categories/${categoryToEdit.id}`, payload);
      toast({
        title: "Succès",
        description: "Catégorie modifiée avec succès",
      });
      setEditDialogOpen(false);
      setCategoryToEdit(null);
      fetchCategories();
    } catch (err: any) {
      console.error("Erreur modification catégorie", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de modifier la catégorie",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      await api.delete(`/categories/${categoryToDelete.id}`);
      toast({
        title: "Succès",
        description: "Catégorie supprimée avec succès",
      });
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (err: any) {
      console.error("Erreur suppression catégorie", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message || "Impossible de supprimer la catégorie",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des catégories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tag className="w-8 h-8" />
            Gestion des catégories
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les catégories disponibles dans le système
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle catégorie
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total catégories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avec barreur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.filter((c) => c.has_coxswain).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Résultats filtrés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredCategories.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recherche */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher par code, label, groupe d'âge ou genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Liste des catégories */}
      <Card>
        <CardHeader>
          <CardTitle>Catégories ({filteredCategories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune catégorie trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Groupe d'âge</TableHead>
                    <TableHead>Genre</TableHead>
                    <TableHead>Places</TableHead>
                    <TableHead>Barreur</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-mono font-semibold">
                        {category.code || "—"}
                      </TableCell>
                      <TableCell className="font-medium">{category.label || "—"}</TableCell>
                      <TableCell>{category.age_group || "—"}</TableCell>
                      <TableCell>{category.gender || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {category.boat_seats || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {category.has_coxswain ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-medium">
                            <User className="w-3 h-3" />
                            Oui
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Non</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(category)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setCategoryToDelete(category);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de création */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
            <DialogDescription>
              Créez une nouvelle catégorie disponible dans le système
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">
                  Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="ex: U17F1I"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">
                  Label <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="ex: U17 Féminin 1x Individuel"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age_group">Groupe d'âge</Label>
                <Input
                  id="age_group"
                  value={formData.age_group}
                  onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                  placeholder="ex: U17, U19, Senior"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Genre</Label>
                <Select
                  value={formData.gender || undefined}
                  onValueChange={(value) => setFormData({ ...formData, gender: value || "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un genre (optionnel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Homme">Homme</SelectItem>
                    <SelectItem value="Femme">Femme</SelectItem>
                    <SelectItem value="Mixte">Mixte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="boat_seats">Nombre de places</Label>
                <Input
                  id="boat_seats"
                  type="number"
                  min="1"
                  value={formData.boat_seats}
                  onChange={(e) => setFormData({ ...formData, boat_seats: e.target.value })}
                  placeholder="ex: 1, 2, 4, 8"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.has_coxswain}
                    onChange={(e) =>
                      setFormData({ ...formData, has_coxswain: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Avec barreur</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de modification */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier la catégorie</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la catégorie
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">
                  Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="ex: U17F1I"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-label">
                  Label <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="ex: U17 Féminin 1x Individuel"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-age_group">Groupe d'âge</Label>
                <Input
                  id="edit-age_group"
                  value={formData.age_group}
                  onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                  placeholder="ex: U17, U19, Senior"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gender">Genre</Label>
                <Select
                  value={formData.gender || undefined}
                  onValueChange={(value) => setFormData({ ...formData, gender: value || "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un genre (optionnel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Homme">Homme</SelectItem>
                    <SelectItem value="Femme">Femme</SelectItem>
                    <SelectItem value="Mixte">Mixte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-boat_seats">Nombre de places</Label>
                <Input
                  id="edit-boat_seats"
                  type="number"
                  min="1"
                  value={formData.boat_seats}
                  onChange={(e) => setFormData({ ...formData, boat_seats: e.target.value })}
                  placeholder="ex: 1, 2, 4, 8"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.has_coxswain}
                    onChange={(e) =>
                      setFormData({ ...formData, has_coxswain: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Avec barreur</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setCategoryToEdit(null);
              }}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Modification...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="pt-4">
              <div className="space-y-3">
                <p className="font-semibold text-foreground">
                  Êtes-vous sûr de vouloir supprimer la catégorie{" "}
                  <span className="text-red-600">
                    {categoryToDelete?.code} - {categoryToDelete?.label}
                  </span>
                  ?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    ⚠️ Cette action est irréversible. La catégorie sera retirée de tous les
                    événements qui l'utilisent.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setCategoryToDelete(null);
              }}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer définitivement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

