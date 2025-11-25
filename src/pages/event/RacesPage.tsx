import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import { Edit, Users, MapPin, Calendar, Trophy } from "lucide-react";
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
  age_group: string;
  gender: string;
  boat_seats: number;
  has_coxswain: boolean;
  distance_id?: string;
  distance?: {
    id: string;
    meters: number;
    label?: string;
    is_relay?: boolean;
    relay_count?: number;
  };
};

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  gender: string;
};

type CrewParticipant = {
  id: string;
  crew_id: string;
  participant_id: string;
  is_coxswain: boolean;
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

type Distance = {
  id: string;
  meters: number;
  is_relay?: boolean;
  relay_count?: number;
  label?: string;
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  lane_count?: number;
  distance_id?: string;
  distance?: Distance;
  race_type?: string;
  race_phase?: {
    id: string;
    name: string;
  };
  race_crews: RaceCrew[];
};

export default function RacesPage() {
  const { eventId } = useParams();
  const { toast } = useToast();
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    race_number: 1,
    start_time: "",
    distance_id: "",
  });
  const [availableDistances, setAvailableDistances] = useState<Distance[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchRaces();
      fetchDistances();
    }
  }, [eventId]);

  const fetchDistances = async () => {
    try {
      const res = await api.get(`/distances/event/${eventId}`);
      setAvailableDistances(res.data.data || []);
    } catch (err) {
      console.error("Erreur chargement distances", err);
    }
  };

  const fetchRaces = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/races/event/${eventId}`);
      const racesData = res.data.data || [];

      // Enrichir chaque course avec ses race-crews et participants
      const enrichedRaces = await Promise.all(
        racesData.map(async (race: Race) => {
          try {
            // Récupérer les race-crews
            const raceCrewsRes = await api.get(`/race-crews/${race.id}`);
            const raceCrews = raceCrewsRes.data.data || [];

            // Enrichir chaque race-crew avec les participants du crew
            const enrichedRaceCrews = await Promise.all(
              raceCrews.map(async (rc: any) => {
                try {
                  const crewRes = await api.get(`/crews/${rc.crew_id}`);
                  const crewData = crewRes.data.data || crewRes.data;
                  return {
                    ...rc,
                    crew: {
                      ...crewData,
                      crew_participants: crewData.crew_participants || [],
                    },
                  };
                } catch (err) {
                  console.error(`Erreur chargement crew ${rc.crew_id}:`, err);
                  return rc;
                }
              })
            );

            // Récupérer la distance si elle existe
            let distanceData: Distance | null = null;
            if (race.distance_id) {
              try {
                const distancesRes = await api.get(`/distances/event/${eventId}`);
                const allDistances = distancesRes.data.data || [];
                distanceData = allDistances.find((d: Distance) => d.id === race.distance_id) || null;
              } catch (err) {
                console.error("Erreur chargement distance", err);
              }
            }

            return {
              ...race,
              race_crews: enrichedRaceCrews.sort((a: RaceCrew, b: RaceCrew) => a.lane - b.lane),
              distance: distanceData || race.distance,
            };
          } catch (err) {
            console.error(`Erreur chargement course ${race.id}:`, err);
            return race;
          }
        })
      );

      const sorted = enrichedRaces.sort((a: Race, b: Race) => a.race_number - b.race_number);
      setRaces(sorted);
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les courses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRace = (race: Race) => {
    setSelectedRace(race);
    setEditForm({
      name: race.name,
      race_number: race.race_number,
      start_time: race.start_time ? dayjs(race.start_time).format("YYYY-MM-DDTHH:mm") : "",
      distance_id: race.distance_id || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedRace) return;

    try {
      setIsSaving(true);
      await api.put(`/races/${selectedRace.id}`, {
        name: editForm.name,
        race_number: editForm.race_number,
        start_time: editForm.start_time ? new Date(editForm.start_time).toISOString() : null,
        distance_id: editForm.distance_id || null,
      });

      toast({
        title: "Course mise à jour",
        description: "Les informations de la course ont été modifiées avec succès",
      });

      setEditDialogOpen(false);
      await fetchRaces();
      // Mettre à jour la course sélectionnée
      const updatedRace = races.find((r) => r.id === selectedRace.id);
      if (updatedRace) {
        handleSelectRace(updatedRace);
      }
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de mettre à jour la course",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "not_started":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">À venir</span>;
      case "in_progress":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">En cours</span>;
      case "non_official":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Non officiel</span>;
      case "official":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Officiel</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  // Récupérer toutes les catégories uniques de la course
  const getUniqueCategories = (race: Race): Category[] => {
    const categories = new Map<string, Category>();
    race.race_crews.forEach((rc) => {
      if (rc.crew.category) {
        categories.set(rc.crew.category.id, rc.crew.category);
      }
    });
    return Array.from(categories.values());
  };

  // Récupérer tous les participants de la course
  const getAllParticipants = (race: Race): Array<{
    crew: RaceCrew["crew"];
    participant: Participant;
    seat_position: number;
    is_coxswain: boolean;
    lane: number;
  }> => {
    const participants: Array<{
      crew: RaceCrew["crew"];
      participant: Participant;
      seat_position: number;
      is_coxswain: boolean;
      lane: number;
    }> = [];

    race.race_crews.forEach((rc) => {
      rc.crew.crew_participants
        ?.sort((a, b) => a.seat_position - b.seat_position)
        .forEach((cp) => {
          if (cp.participant) {
            participants.push({
              crew: rc.crew,
              participant: cp.participant,
              seat_position: cp.seat_position,
              is_coxswain: cp.is_coxswain,
              lane: rc.lane,
            });
          }
        });
    });

    return participants.sort((a, b) => a.lane - b.lane || a.seat_position - b.seat_position);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestion des courses</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste des courses */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {races.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucune course disponible
                </p>
              ) : (
                races.map((race) => (
                  <div
                    key={race.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRace?.id === race.id
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => handleSelectRace(race)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">
                          Course {race.race_number} - {race.name}
                        </div>
                        {race.race_phase && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Phase: {race.race_phase.name}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground mt-1">
                          {dayjs(race.start_time).format("DD/MM/YYYY à HH:mm")}
                        </div>
                      </div>
                      {getStatusBadge(race.status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Détails de la course sélectionnée */}
        {selectedRace ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Détails de la course</CardTitle>
                <Button onClick={() => setEditDialogOpen(true)} className="gap-2">
                  <Edit className="w-4 h-4" />
                  Modifier
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Informations générales */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Informations générales
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nom:</span>
                    <span className="font-medium">{selectedRace.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Numéro:</span>
                    <span className="font-medium">{selectedRace.race_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date et heure:</span>
                    <span className="font-medium">
                      {dayjs(selectedRace.start_time).format("DD/MM/YYYY à HH:mm")}
                    </span>
                  </div>
                  {selectedRace.race_phase && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phase:</span>
                      <span className="font-medium">{selectedRace.race_phase.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Statut:</span>
                    {getStatusBadge(selectedRace.status)}
                  </div>
                  {selectedRace.distance && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Distance:</span>
                      <span className="font-medium">
                        {selectedRace.distance.label || `${selectedRace.distance.meters}m`}
                        {selectedRace.distance.is_relay &&
                          selectedRace.distance.relay_count &&
                          ` (Relais ${selectedRace.distance.relay_count}x${selectedRace.distance.meters}m)`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Catégories */}
              {getUniqueCategories(selectedRace).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Catégories ({getUniqueCategories(selectedRace).length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {getUniqueCategories(selectedRace).map((cat) => (
                      <span
                        key={cat.id}
                        className="px-2 py-1 rounded-full text-xs font-medium border border-gray-300 bg-white text-gray-700"
                      >
                        {cat.label || cat.code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Participants */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participants ({getAllParticipants(selectedRace).length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Couloir</TableHead>
                        <TableHead>Équipage</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Participant</TableHead>
                        <TableHead>Licence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getAllParticipants(selectedRace).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.lane}</TableCell>
                          <TableCell>{item.crew.club_name}</TableCell>
                          <TableCell>
                            {item.is_coxswain ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium border border-gray-300 bg-white text-gray-700">
                                Barreur
                              </span>
                            ) : (
                              item.seat_position
                            )}
                          </TableCell>
                          <TableCell>
                            {item.participant.first_name} {item.participant.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.participant.license_number || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                Sélectionnez une course pour voir les détails
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de modification */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier la course</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la course sélectionnée
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="race_number">Numéro</Label>
              <Input
                id="race_number"
                type="number"
                value={editForm.race_number}
                onChange={(e) =>
                  setEditForm({ ...editForm, race_number: parseInt(e.target.value, 10) })
                }
              />
            </div>
            <div>
              <Label htmlFor="start_time">Date et heure</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={editForm.start_time}
                onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="distance_id">Distance</Label>
              <Select
                value={editForm.distance_id || "__none__"}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, distance_id: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une distance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune distance</SelectItem>
                  {availableDistances.map((dist) => (
                    <SelectItem key={dist.id} value={dist.id}>
                      {dist.label || `${dist.meters}m`}
                      {dist.is_relay &&
                        dist.relay_count &&
                        ` (Relais ${dist.relay_count}x${dist.meters}m)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
