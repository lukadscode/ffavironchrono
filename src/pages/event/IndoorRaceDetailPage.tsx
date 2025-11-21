import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import { ArrowLeft, Download, Upload, FileText, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Category = {
  id: string;
  code: string;
  label: string;
  age_group: string;
  gender: string;
  boat_seats: number;
  has_coxswain: boolean;
};

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  gender: string;
  email: string | null;
  club_name: string | null;
};

type CrewParticipant = {
  id: string;
  crew_id: string;
  participant_id: string;
  is_coxswain: boolean;
  coxswain_weight: number | null;
  seat_position: number;
  participant: Participant;
};

type RaceCrew = {
  id: string;
  race_id: string;
  crew_id: string;
  lane: number;
  status: string | null;
  crew: {
    id: string;
    event_id: string;
    category_id: string;
    status: number;
    club_name: string;
    club_code: string;
    coach_name: string | null;
    category: Category;
    crew_participants: CrewParticipant[];
  };
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  lane_count?: number;
  race_phase?: {
    id: string;
    name: string;
  };
  race_crews: RaceCrew[];
};

type Event = {
  id: string;
  name: string;
};

type TimingPoint = {
  id: string;
  label: string;
  order_index: number;
  distance_m: number;
};

export default function IndoorRaceDetailPage() {
  const { eventId, raceId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [race, setRace] = useState<Race | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [distance, setDistance] = useState<number>(500); // Par défaut 500m pour indoor
  const [loading, setLoading] = useState(true);
  const [isDraggingTxtJson, setIsDraggingTxtJson] = useState(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const fileInputTxtJsonRef = useRef<HTMLInputElement>(null);
  const fileInputPdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (raceId && eventId) {
      fetchEvent();
      fetchRace();
      fetchDistance();
    }
  }, [raceId, eventId]);

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      setEvent(res.data.data);
    } catch (err) {
      console.error("Erreur chargement événement", err);
    }
  };

  const fetchDistance = async () => {
    try {
      const res = await api.get(`/timing-points/event/${eventId}`);
      const timingPoints = res.data.data || [];
      if (timingPoints.length > 0) {
        // Trier par order_index et prendre le dernier (finish)
        const sorted = timingPoints.sort((a: TimingPoint, b: TimingPoint) => 
          (b.order_index || 0) - (a.order_index || 0)
        );
        const lastPoint = sorted[0];
        if (lastPoint?.distance_m) {
          setDistance(lastPoint.distance_m);
        }
      }
    } catch (err) {
      console.error("Erreur chargement distance", err);
    }
  };

  const fetchRace = async () => {
    try {
      const raceRes = await api.get(`/races/${raceId}`);
      const raceData = raceRes.data.data;

      const raceCrewsRes = await api.get(`/race-crews/${raceId}`);
      const raceCrews = raceCrewsRes.data.data || [];

      setRace({
        ...raceData,
        race_crews: raceCrews.sort((a: RaceCrew, b: RaceCrew) => a.lane - b.lane),
      });
    } catch (err) {
      console.error("Erreur chargement course", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, type: "txtjson" | "pdf") => {
    if (!raceId) {
      toast({
        title: "Erreur",
        description: "ID de course manquant",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      // TODO: Remplacer par la route API appropriée
      const response = await api.post(`/races/${raceId}/upload-results`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast({
        title: "Fichier téléversé",
        description: `Le fichier ${file.name} a été téléversé avec succès`,
      });

      // Recharger les données de la course si nécessaire
      if (response.data.data) {
        fetchRace();
      }
    } catch (err: any) {
      console.error("Erreur upload fichier", err);
      toast({
        title: "Erreur",
        description: err.response?.data?.message || "Erreur lors du téléversement du fichier",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: "txtjson" | "pdf") => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, type);
    }
    // Réinitialiser l'input pour permettre de sélectionner le même fichier
    event.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent, type: "txtjson" | "pdf") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "txtjson") {
      setIsDraggingTxtJson(true);
    } else {
      setIsDraggingPdf(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent, type: "txtjson" | "pdf") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "txtjson") {
      setIsDraggingTxtJson(false);
    } else {
      setIsDraggingPdf(false);
    }
  };

  const handleDrop = (e: React.DragEvent, type: "txtjson" | "pdf") => {
    e.preventDefault();
    e.stopPropagation();

    if (type === "txtjson") {
      setIsDraggingTxtJson(false);
    } else {
      setIsDraggingPdf(false);
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (type === "txtjson") {
      const allowedTypes = ["text/plain", "application/json", "text/json"];
      const allowedExtensions = [".txt", ".json"];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

      if (
        !allowedTypes.includes(file.type) &&
        !allowedExtensions.includes(fileExtension)
      ) {
        toast({
          title: "Format invalide",
          description: "Veuillez déposer un fichier TXT ou JSON",
          variant: "destructive",
        });
        return;
      }
    } else if (type === "pdf") {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast({
          title: "Format invalide",
          description: "Veuillez déposer un fichier PDF",
          variant: "destructive",
        });
        return;
      }
    }

    handleFileUpload(file, type);
  };

  const generateRac2File = () => {
    if (!race || !event) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le fichier : données manquantes",
        variant: "destructive",
      });
      return;
    }

    // Récupérer le nombre total de couloirs (par défaut 64 pour indoor)
    const totalLanes = race.lane_count || 64;
    const laneCount = Math.max(totalLanes, race.race_crews.length > 0 
      ? Math.max(...race.race_crews.map(rc => rc.lane))
      : 0
    );

    // Créer un map des couloirs occupés
    const occupiedLanes = new Map<number, RaceCrew>();
    race.race_crews.forEach((rc) => {
      occupiedLanes.set(rc.lane, rc);
    });

    // Construire le tableau boats avec tous les couloirs
    const boats = [];
    for (let lane = 1; lane <= laneCount; lane++) {
      const raceCrew = occupiedLanes.get(lane);
      
      if (raceCrew) {
        // Couloir occupé
        const participants = raceCrew.crew.crew_participants
          .sort((a, b) => a.seat_position - b.seat_position)
          .map((cp) => cp.participant);

        // Formater le nom du participant (ou du bateau si plusieurs participants)
        let boatName = "";
        if (participants.length === 1) {
          // Individuel : format "NOM, Prénom"
          const p = participants[0];
          boatName = `${p.last_name.toUpperCase()}, ${p.first_name}`;
        } else {
          // Équipage : concaténer les noms
          boatName = participants
            .map((p) => `${p.last_name.toUpperCase()}, ${p.first_name}`)
            .join(" • ");
        }

        const categoryLabel = raceCrew.crew.category?.label || "";
        
        boats.push({
          class_name: categoryLabel || "Unknown",
          id: raceCrew.crew_id,
          lane_number: lane,
          name: boatName,
          participants: participants.map((p) => ({
            id: p.id,
            name: `${p.last_name.toUpperCase()}, ${p.first_name}`,
          })),
          affiliation: raceCrew.crew.club_code || "",
        });
      } else {
        // Couloir vide
        boats.push({
          class_name: "EMPTY",
          id: `Lane ${lane}`,
          lane_number: lane,
          name: "EMPTY",
          participants: [
            {
              id: `Lane ${lane}`,
              name: "Lane " + lane,
            },
          ],
          affiliation: "",
        });
      }
    }

    // Déterminer le type de course (individual ou team)
    // Si tous les équipages ont 1 participant, c'est individual, sinon team
    const allParticipantsCounts = race.race_crews.map(rc => 
      rc.crew.crew_participants?.length || 0
    );
    const isIndividual = allParticipantsCounts.length > 0 && 
      allParticipantsCounts.every(count => count === 1);
    const raceType = isIndividual ? "individual" : "team";

    // Construire l'objet rac2
    const rac2Data = {
      race_definition: {
        duration: distance,
        duration_type: "meters",
        event_name: event.name.toUpperCase(),
        name_long: race.name,
        name_short: race.id,
        race_id: race.id,
        race_type: raceType,
        boats: boats,
        split_type: "even",
        split_value: distance,
      },
    };

    // Convertir en JSON et télécharger
    const jsonContent = JSON.stringify(rac2Data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${race.name.replace(/\s+/g, "_")}_${race.id}.rac2`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Fichier généré",
      description: "Le fichier .rac2 a été téléchargé avec succès",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!race) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground mb-4">Course introuvable</p>
        <Button onClick={() => navigate(`/event/${eventId}/indoor`)}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec retour */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/event/${eventId}/indoor`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Course {race.race_number} - {race.name}
            </h2>
            {race.race_phase && (
              <p className="text-sm text-muted-foreground mt-1">
                Phase: {race.race_phase.name} • {dayjs(race.start_time).format("DD/MM/YYYY à HH:mm")}
              </p>
            )}
          </div>
        </div>
        <Button onClick={generateRac2File} className="gap-2">
          <Download className="w-4 h-4" />
          Télécharger .rac2
        </Button>
      </div>

      {/* Zones de dépôt de fichiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Zone TXT/JSON */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Résultats TXT/JSON
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDraggingTxtJson
                  ? "border-primary bg-primary/10"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={(e) => handleDragOver(e, "txtjson")}
              onDragLeave={(e) => handleDragLeave(e, "txtjson")}
              onDrop={(e) => handleDrop(e, "txtjson")}
              onClick={() => fileInputTxtJsonRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Glissez-déposez un fichier TXT ou JSON ici
              </p>
              <p className="text-xs text-muted-foreground mb-4">ou</p>
              <Button variant="outline" size="sm">
                Sélectionner un fichier
              </Button>
              <input
                ref={fileInputTxtJsonRef}
                type="file"
                accept=".txt,.json"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "txtjson")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Zone PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <File className="w-5 h-5" />
              Résultats PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDraggingPdf
                  ? "border-primary bg-primary/10"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={(e) => handleDragOver(e, "pdf")}
              onDragLeave={(e) => handleDragLeave(e, "pdf")}
              onDrop={(e) => handleDrop(e, "pdf")}
              onClick={() => fileInputPdfRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Glissez-déposez un fichier PDF ici
              </p>
              <p className="text-xs text-muted-foreground mb-4">ou</p>
              <Button variant="outline" size="sm">
                Sélectionner un fichier
              </Button>
              <input
                ref={fileInputPdfRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "pdf")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des équipages par couloir */}
      <Card>
        <CardHeader>
          <CardTitle>Équipages par couloir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 font-semibold">Couloir</th>
                  <th className="text-left py-2 px-4 font-semibold">Code Club</th>
                  <th className="text-left py-2 px-4 font-semibold">Club</th>
                  <th className="text-left py-2 px-4 font-semibold">Catégorie</th>
                  <th className="text-left py-2 px-4 font-semibold">Participants</th>
                </tr>
              </thead>
              <tbody>
                {race.race_crews.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      Aucun équipage assigné à cette course
                    </td>
                  </tr>
                ) : (
                  race.race_crews.map((raceCrew) => {
                    const participants = raceCrew.crew.crew_participants
                      .sort((a, b) => a.seat_position - b.seat_position)
                      .map((cp) => cp.participant);

                    return (
                      <tr key={raceCrew.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-lg">{raceCrew.lane}</td>
                        <td className="py-3 px-4 font-semibold">{raceCrew.crew.club_code}</td>
                        <td className="py-3 px-4">{raceCrew.crew.club_name}</td>
                        <td className="py-3 px-4">
                          {raceCrew.crew.category ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {raceCrew.crew.category.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {participants.map((participant, idx) => {
                              const crewParticipant = raceCrew.crew.crew_participants.find(
                                (cp) => cp.participant_id === participant.id
                              );
                              const isCoxswain = crewParticipant?.is_coxswain || false;

                              return (
                                <div
                                  key={participant.id}
                                  className={`text-sm ${isCoxswain ? "font-bold" : ""}`}
                                >
                                  {participant.first_name} {participant.last_name}
                                  {isCoxswain && (
                                    <span className="text-muted-foreground ml-1 text-xs">(B)</span>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({participant.license_number})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

