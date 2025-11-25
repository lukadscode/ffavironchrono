import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Trophy, Edit, Loader2, Star } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// Badge component inline car peut ne pas exister
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${className || ""}`}>
      {children}
    </span>
  );
}

type ScoringTemplate = {
  id: string;
  name: string;
  type: "indoor_points" | "defis_capitaux" | "custom";
  config: any;
  is_default: boolean;
};

type IndoorPointsConfig = {
  points_indoor: {
    "1_3_participants": Array<{ place: number; individuel: number; relais: number }>;
    "4_6_participants": Array<{ place: number; individuel: number; relais: number }>;
    "7_12_participants": Array<{ place: number; individuel: number; relais: number }>;
    "13_plus_participants": Array<{ place: number | string; individuel: number; relais: number }>;
  };
};

type DefisCapitauxConfig = {
  classement_defis_capitaux: Array<{ rang: number; points: number }>;
};

export default function ScoringTemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<ScoringTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Vérifier si l'utilisateur est superadmin
  const isSuperAdmin = user?.role === "superadmin";

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate("/dashboard");
      return;
    }

    fetchTemplates();
  }, [isSuperAdmin, navigate]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      // Utiliser l'endpoint correct selon la documentation API: /rankings/templates
      const res = await api.get("/rankings/templates");
      
      setTemplates(res.data.data || res.data || []);
    } catch (err: any) {
      console.error("Erreur chargement templates", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de charger les templates de scoring",
        variant: "destructive",
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: ScoringTemplate) => {
    setCurrentTemplate(template);
    setEditDialogOpen(true);
  };

  const handleSave = async (updatedConfig: any) => {
    if (!currentTemplate) return;

    try {
      setIsSaving(true);
      // Utiliser l'endpoint correct selon la documentation API: /rankings/templates/:id
      await api.put(`/rankings/templates/${currentTemplate.id}`, {
        name: currentTemplate.name,
        config: updatedConfig,
        is_default: currentTemplate.is_default,
      });

      toast({
        title: "Template mis à jour",
        description: "Le template a été modifié avec succès",
      });

      setEditDialogOpen(false);
      setCurrentTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de mettre à jour le template",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      // D'abord, enlever le flag is_default de tous les templates du même type
      const template = templates.find((t) => t.id === templateId);
      if (!template) return;

      const sameTypeTemplates = templates.filter((t) => t.type === template.type);
      
      // Utiliser l'endpoint correct selon la documentation API: /rankings/templates/:id
      await Promise.all(
        sameTypeTemplates.map((t) =>
          api.put(`/rankings/templates/${t.id}`, { 
            ...t, 
            is_default: t.id === templateId 
          })
        )
      );

      toast({
        title: "Template par défaut mis à jour",
        description: "Le template par défaut a été modifié",
      });

      fetchTemplates();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de définir le template par défaut",
        variant: "destructive",
      });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "indoor_points":
        return "Points Indoor";
      case "defis_capitaux":
        return "Défis des Capitales";
      case "custom":
        return "Personnalisé";
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "indoor_points":
        return "bg-blue-100 text-blue-800";
      case "defis_capitaux":
        return "bg-purple-100 text-purple-800";
      case "custom":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            Gestion des templates de scoring
          </h1>
          <p className="text-muted-foreground mt-2">
            Configurez les points attribués aux différents classements
          </p>
        </div>
      </div>

      {/* Liste des templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates de scoring</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Par défaut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Aucun template trouvé
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(template.type)}>
                        {getTypeLabel(template.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {template.is_default ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Star className="w-3 h-3 mr-1" />
                          Par défaut
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!template.is_default && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefault(template.id)}
                          >
                            Définir par défaut
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Modifier
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog d'édition */}
      {currentTemplate && (
        <EditTemplateDialog
          template={currentTemplate}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}

// Composant pour éditer un template
function EditTemplateDialog({
  template,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: {
  template: ScoringTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: any) => void;
  isSaving: boolean;
}) {
  const [config, setConfig] = useState<any>(template.config);

  useEffect(() => {
    setConfig(template.config);
  }, [template]);

  const handleSaveClick = () => {
    onSave(config);
  };

  if (template.type === "indoor_points") {
    return (
      <EditIndoorPointsDialog
        template={template}
        open={open}
        onOpenChange={onOpenChange}
        onSave={handleSaveClick}
        isSaving={isSaving}
        config={config as IndoorPointsConfig}
        setConfig={setConfig}
      />
    );
  }

  if (template.type === "defis_capitaux") {
    return (
      <EditDefisCapitauxDialog
        template={template}
        open={open}
        onOpenChange={onOpenChange}
        onSave={handleSaveClick}
        isSaving={isSaving}
        config={config as DefisCapitauxConfig}
        setConfig={setConfig}
      />
    );
  }

  return null;
}

// Composant pour éditer les points Indoor
function EditIndoorPointsDialog({
  template,
  open,
  onOpenChange,
  onSave,
  isSaving,
  config,
  setConfig,
}: {
  template: ScoringTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
  config: IndoorPointsConfig;
  setConfig: (config: IndoorPointsConfig) => void;
}) {
  const updatePoints = (
    category: keyof IndoorPointsConfig["points_indoor"],
    index: number,
    field: "individuel" | "relais",
    value: number
  ) => {
    const newConfig = { ...config };
    newConfig.points_indoor[category] = [...newConfig.points_indoor[category]];
    newConfig.points_indoor[category][index] = {
      ...newConfig.points_indoor[category][index],
      [field]: value,
    };
    setConfig(newConfig);
  };

  const categories: Array<{
    key: keyof IndoorPointsConfig["points_indoor"];
    label: string;
  }> = [
    { key: "1_3_participants", label: "1-3 participants" },
    { key: "4_6_participants", label: "4-6 participants" },
    { key: "7_12_participants", label: "7-12 participants" },
    { key: "13_plus_participants", label: "13+ participants" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le template: {template.name}</DialogTitle>
          <DialogDescription>
            Configurez les points attribués selon le nombre de participants et la place
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {categories.map((cat) => (
            <Card key={cat.key}>
              <CardHeader>
                <CardTitle className="text-lg">{cat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-2 font-semibold text-sm pb-2 border-b">
                    <div className="col-span-2">Place</div>
                    <div className="col-span-5">Individuel</div>
                    <div className="col-span-5">Relais</div>
                  </div>
                  {config.points_indoor[cat.key].map((point, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2 font-medium">
                        {typeof point.place === "number" ? point.place : point.place}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={point.individuel}
                        onChange={(e) =>
                          updatePoints(cat.key, index, "individuel", parseFloat(e.target.value) || 0)
                        }
                        className="col-span-5"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={point.relais}
                        onChange={(e) =>
                          updatePoints(cat.key, index, "relais", parseFloat(e.target.value) || 0)
                        }
                        className="col-span-5"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Composant pour éditer les points Défis des Capitales
function EditDefisCapitauxDialog({
  template,
  open,
  onOpenChange,
  onSave,
  isSaving,
  config,
  setConfig,
}: {
  template: ScoringTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
  config: DefisCapitauxConfig;
  setConfig: (config: DefisCapitauxConfig) => void;
}) {
  const updatePoints = (index: number, points: number) => {
    const newConfig = { ...config };
    newConfig.classement_defis_capitaux = [...newConfig.classement_defis_capitaux];
    newConfig.classement_defis_capitaux[index] = {
      ...newConfig.classement_defis_capitaux[index],
      points,
    };
    setConfig(newConfig);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le template: {template.name}</DialogTitle>
          <DialogDescription>
            Configurez les points attribués selon le rang dans le classement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Points par rang</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {config.classement_defis_capitaux.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <Label className="text-sm font-medium">Rang {item.rang}</Label>
                    <Input
                      type="number"
                      value={item.points}
                      onChange={(e) => updatePoints(index, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

