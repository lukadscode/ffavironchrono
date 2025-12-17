import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Users, Plus, Trash2, AlertTriangle } from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "user" | "commission" | "admin" | "superadmin";
  status?: "active" | "inactive";
  num_license?: string;
  created_at?: string;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function UsersManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Dialog pour créer un utilisateur
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    num_license: "",
    role: "user" as "user" | "commission" | "admin" | "superadmin",
  });
  
  // Dialog pour supprimer un utilisateur
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Vérifier si l'utilisateur est admin ou superadmin
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperAdmin = user?.role === "superadmin";

  const fetchUsers = useCallback(async () => {
    try {
      // Construire les paramètres de requête
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };
      
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      
      if (roleFilter !== "all") {
        params.role = roleFilter;
      }

      const res = await api.get("/users", { params });
      
      // Gérer la réponse avec pagination
      const usersData = res.data.data || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
      
      // Gérer la pagination si disponible
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      } else {
        setPagination(null);
      }
    } catch (err: any) {
      console.error("Erreur chargement utilisateurs", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de charger les utilisateurs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, roleFilter, toast]);

  // Réinitialiser la page quand la recherche ou le filtre change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, roleFilter]);

  // Charger les utilisateurs quand les paramètres changent
  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    setLoading(true);
    
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, searchQuery || roleFilter !== "all" ? 500 : 0); // Debounce seulement pour recherche/filtre

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, navigate, currentPage, searchQuery, roleFilter]); // fetchUsers est dans useCallback

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Ne pas permettre de modifier son propre rôle
    if (userId === user?.id) {
      toast({
        title: "Erreur",
        description: "Vous ne pouvez pas modifier votre propre rôle",
        variant: "destructive",
      });
      return;
    }

    setUpdatingRoles((prev) => new Set(prev).add(userId));

    try {
      await api.patch(`/users/${userId}`, { role: newRole });
      
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, role: newRole as User["role"] } : u
        )
      );

      toast({
        title: "Succès",
        description: "Rôle mis à jour avec succès",
      });
    } catch (err: any) {
      console.error("Erreur mise à jour rôle", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de mettre à jour le rôle",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoles((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir le nom et l'email",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const payload: any = {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      };
      
      if (newUser.num_license.trim()) {
        payload.num_license = newUser.num_license.trim();
      }

      const res = await api.post("/users", payload);
      
      toast({
        title: "Succès",
        description: `Utilisateur créé. Un email avec le mot de passe temporaire a été envoyé à ${newUser.email}.`,
      });

      // Réinitialiser le formulaire
      setNewUser({
        name: "",
        email: "",
        num_license: "",
        role: "user",
      });
      setCreateDialogOpen(false);

      // Recharger la liste
      await fetchUsers();
    } catch (err: any) {
      console.error("Erreur création utilisateur", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de créer l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (userItem: User) => {
    if (userItem.id === user?.id) {
      toast({
        title: "Erreur",
        description: "Vous ne pouvez pas désactiver votre propre compte",
        variant: "destructive",
      });
      return;
    }
    setUserToDelete(userItem);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      
      toast({
        title: "Succès",
        description: `L'utilisateur "${userToDelete.name}" a été désactivé.`,
      });

      setDeleteDialogOpen(false);
      setUserToDelete(null);

      // Recharger la liste
      await fetchUsers();
    } catch (err: any) {
      console.error("Erreur désactivation utilisateur", err);
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Impossible de désactiver l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Les utilisateurs sont déjà filtrés côté serveur
  const filteredUsers = users;

  // Obtenir le label du rôle
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "superadmin":
        return "Super Admin";
      case "admin":
        return "Admin";
      case "commission":
        return "Commission";
      case "user":
        return "Utilisateur";
      default:
        return role;
    }
  };

  // Obtenir la couleur du badge selon le rôle
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "superadmin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "admin":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "commission":
        return "bg-green-100 text-green-700 border-green-200";
      case "user":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            Gestion des utilisateurs
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gérez les utilisateurs et leurs droits d'accès
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Créer un utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Créer un utilisateur</DialogTitle>
              <DialogDescription className="text-sm">
                Un mot de passe temporaire sera généré et envoyé par email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                  placeholder="Jean Dupont"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  placeholder="jean@example.com"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num_license">Numéro de licence</Label>
                <Input
                  id="num_license"
                  value={newUser.num_license}
                  onChange={(e) =>
                    setNewUser({ ...newUser, num_license: e.target.value })
                  }
                  placeholder="123456789"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) =>
                    setNewUser({
                      ...newUser,
                      role: value as "user" | "commission" | "admin" | "superadmin",
                    })
                  }
                  disabled={isCreating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {isSuperAdmin && (
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setNewUser({
                    name: "",
                    email: "",
                    num_license: "",
                    role: "user",
                  });
                }}
                disabled={isCreating}
              >
                Annuler
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? (
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
      </div>

      {/* Barres de recherche et filtre */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="commission">Commission</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery
                ? "Aucun utilisateur ne correspond à votre recherche."
                : "Aucun utilisateur trouvé."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Utilisateurs
              {pagination && (
                <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-2">
                  ({pagination.total} au total)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Nom</TableHead>
                    <TableHead className="min-w-[180px] hidden sm:table-cell">Email</TableHead>
                    <TableHead className="min-w-[100px]">Statut</TableHead>
                    <TableHead className="min-w-[120px]">Rôle</TableHead>
                    <TableHead className="text-right min-w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userItem) => (
                    <TableRow 
                      key={userItem.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/dashboard/users-management/${userItem.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span>{userItem.name}</span>
                          {userItem.id === user?.id && (
                            <span className="text-xs text-muted-foreground">
                              (Vous)
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:hidden text-muted-foreground mt-1">
                          {userItem.email}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{userItem.email}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${
                            userItem.status === "active"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-orange-100 text-orange-700 border-orange-200"
                          }`}
                        >
                          {userItem.status === "active" ? "Actif" : "Inactif"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(
                            userItem.role
                          )}`}
                        >
                          {getRoleLabel(userItem.role)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div 
                          className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Select
                            value={userItem.role}
                            onValueChange={(newRole) =>
                              handleRoleChange(userItem.id, newRole)
                            }
                            disabled={
                              updatingRoles.has(userItem.id) ||
                              userItem.id === user?.id
                            }
                          >
                            <SelectTrigger className="w-full sm:w-[150px]">
                              {updatingRoles.has(userItem.id) ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Mise à jour...</span>
                                </div>
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Utilisateur</SelectItem>
                              <SelectItem value="commission">Commission</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              {isSuperAdmin && (
                                <SelectItem value="superadmin">
                                  Super Admin
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(userItem);
                            }}
                            disabled={userItem.id === user?.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            
            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Page {pagination.page} sur {pagination.totalPages}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => {
                      setCurrentPage((prev) => Math.max(1, prev - 1));
                      setLoading(true);
                    }}
                    disabled={currentPage === 1 || loading}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => {
                      setCurrentPage((prev) =>
                        Math.min(pagination.totalPages, prev + 1)
                      );
                      setLoading(true);
                    }}
                    disabled={
                      currentPage === pagination.totalPages || loading
                    }
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Désactiver l'utilisateur
            </DialogTitle>
            <DialogDescription className="pt-4">
              <p className="font-semibold text-foreground mb-2">
                Êtes-vous sûr de vouloir désactiver l'utilisateur "{userToDelete?.name}" ?
              </p>
              <p className="text-sm text-muted-foreground">
                L'utilisateur ne sera pas supprimé, mais son statut sera mis à "inactif".
                Il ne pourra plus se connecter jusqu'à ce que son compte soit réactivé.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setUserToDelete(null);
              }}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Désactivation...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Désactiver
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

