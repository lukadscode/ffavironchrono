import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2 } from "lucide-react";
import dayjs from "dayjs";

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  race_phase?: {
    id: string;
    name: string;
  };
};

type RaceCrew = {
  lane: number;
  crew_id: string;
  crew: {
    id: string;
    club_code?: string;
    category?: {
      label: string;
    };
    crew_participants: Array<{
      seat_position: number;
      participant: {
        id: string;
        first_name: string;
        last_name: string;
      };
    }>;
  };
};

type FullRace = Race & {
  race_crews: RaceCrew[];
  lane_count?: number;
  distance?: {
    id: string;
    meters: number | null;
    is_relay?: boolean;
    relay_count?: number | null;
    is_time_based: boolean;
    duration_seconds: number | null;
    label: string;
  } | null;
  distance_id?: string | null;
};

type Event = {
  id: string;
  name: string;
};

export default function IndoorPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  useEffect(() => {
    if (eventId) fetchRaces();
  }, [eventId]);

  const fetchRaces = async () => {
    try {
      const res = await api.get(`/races/event/${eventId}`);
      const racesData = res.data.data || [];
      const sorted = racesData.sort((a: Race, b: Race) => a.race_number - b.race_number);
      setRaces(sorted);
    } catch (err) {
      console.error("Erreur chargement courses", err);
    } finally {
      setLoading(false);
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
        return null;
    }
  };

  const generateRac2ForRace = async (race: FullRace, event: Event, distances: any[]): Promise<void> => {
    // Vérifier que la course a des équipages
    if (!race.race_crews || race.race_crews.length === 0) {
      console.warn(`Course ${race.name} n'a pas d'équipages, fichier .rac2 non généré`);
      return;
    }

    // Récupérer la distance de la course
    let finalRaceDistance = race.distance;
    if (!finalRaceDistance && race.distance_id) {
      finalRaceDistance = distances.find((d: any) => d.id === race.distance_id) || null;
    }

    // Récupérer le nombre total de couloirs
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

    // Construire le tableau boats
    const boats = [];
    for (let lane = 1; lane <= laneCount; lane++) {
      const raceCrew = occupiedLanes.get(lane);
      
      if (raceCrew) {
        const participants = raceCrew.crew.crew_participants
          .sort((a, b) => a.seat_position - b.seat_position)
          .map((cp) => cp.participant);

        let boatName = "";
        if (participants.length === 1) {
          const p = participants[0];
          boatName = `${p.last_name.toUpperCase()}, ${p.first_name}`;
        } else {
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
        boats.push({
          class_name: "X",
          id: `Lane ${lane}`,
          lane_number: lane,
          name: "X",
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

    // Déterminer si c'est une distance basée sur le temps
    const currentDistance = finalRaceDistance;
    const isTimeBased = currentDistance?.is_time_based === true;
    const durationSeconds = currentDistance?.duration_seconds ? Number(currentDistance.duration_seconds) : null;
    
    // Déterminer si c'est un relais (les courses basées sur le temps ne peuvent pas être des relais)
    const isRelay = !isTimeBased && (currentDistance?.is_relay === true || (typeof currentDistance?.is_relay === 'number' && currentDistance.is_relay === 1));
    const relayCount = currentDistance?.relay_count ? Number(currentDistance.relay_count) : null;
    const relayDistance = currentDistance?.meters ? Number(currentDistance.meters) : 500; // Par défaut 500m pour indoor
    const distance = relayDistance;

    const totalDistance = isRelay && relayCount && relayDistance 
      ? relayDistance * relayCount 
      : (currentDistance?.meters ? Number(currentDistance.meters) : distance);

    // Déterminer le type de course
    let raceType: string;
    if (isRelay) {
      raceType = "relay";
    } else {
      const allParticipantsCounts = race.race_crews.map(rc => 
        rc.crew.crew_participants?.length || 0
      );
      const isIndividual = allParticipantsCounts.length > 0 && 
        allParticipantsCounts.every(count => count === 1);
      raceType = isIndividual ? "individual" : "team";
    }

    // Construire le nom long
    let nameLong = race.name;
    if (currentDistance) {
      const distanceLabel = currentDistance.label || race.name;
      const firstCrew = race.race_crews[0];
      if (firstCrew?.crew?.category?.label) {
        nameLong = `${distanceLabel} ${firstCrew.crew.category.label}`;
      } else {
        nameLong = distanceLabel;
      }
    }

    // Valeurs finales pour le fichier .rac2
    const finalDuration = isTimeBased && durationSeconds
      ? durationSeconds
      : (isRelay && relayCount && relayDistance 
        ? relayDistance * relayCount 
        : totalDistance);
    // Pour les courses indoor, le split est toujours fixé à 250m
    const finalSplitValue = 250;
    const finalDurationType = isTimeBased ? "seconds" : "meters";

    // Construire l'objet rac2
    const rac2Data: any = {
      race_definition: {
        duration: finalDuration,
        duration_type: finalDurationType,
        event_name: event.name.toUpperCase(),
        name_long: nameLong,
        name_short: race.id,
        race_id: race.id,
        race_type: raceType,
        boats: boats,
        split_type: "even",
        split_value: finalSplitValue,
        team_size: 1,
        handicap_enabled: false,
        time_cap: 0,
      },
    };

    if (isRelay) {
      rac2Data.race_definition.display_prompt_at_splits = true;
      rac2Data.race_definition.sound_horn_at_splits = true;
    }

    // Télécharger le fichier
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
  };

  const downloadAllRac2Files = async () => {
    if (!eventId || races.length === 0) {
      toast({
        title: "Erreur",
        description: "Aucune course disponible",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingAll(true);

    try {
      // Récupérer les informations de l'événement
      const eventRes = await api.get(`/events/${eventId}`);
      const event: Event = eventRes.data.data || eventRes.data;

      // Récupérer toutes les distances
      const distancesRes = await api.get(`/distances/event/${eventId}`);
      const distances = distancesRes.data.data || [];

      // Récupérer les détails complets de chaque course avec leurs équipages
      const fullRaces: FullRace[] = [];
      for (const race of races) {
        try {
          const raceRes = await api.get(`/races/${race.id}`);
          const raceData = raceRes.data.data || raceRes.data;
          
          // Vérifier si race_crews est déjà inclus, sinon le récupérer
          let raceCrews = raceData.race_crews || [];
          if (!raceCrews || raceCrews.length === 0) {
            try {
              const raceCrewsRes = await api.get(`/race-crews/${race.id}`);
              raceCrews = raceCrewsRes.data.data || raceCrewsRes.data || [];
            } catch (err) {
              console.error(`Erreur lors de la récupération des équipages pour la course ${race.id}:`, err);
              raceCrews = [];
            }
          }
          
          const fullRace: FullRace = {
            ...raceData,
            race_crews: raceCrews,
          };
          
          // Ne générer que si la course a des équipages
          if (raceCrews.length > 0) {
            fullRaces.push(fullRace);
          }
        } catch (err) {
          console.error(`Erreur lors de la récupération de la course ${race.id}:`, err);
        }
      }

      if (fullRaces.length === 0) {
        toast({
          title: "Aucune course avec équipages",
          description: "Aucune course ne contient d'équipages à exporter",
          variant: "destructive",
        });
        return;
      }

      // Générer et télécharger chaque fichier .rac2
      let successCount = 0;
      for (const race of fullRaces) {
        try {
          await generateRac2ForRace(race, event, distances);
          successCount++;
          // Petit délai entre chaque téléchargement pour éviter de surcharger le navigateur
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`Erreur lors de la génération du fichier pour ${race.name}:`, err);
        }
      }

      toast({
        title: "Téléchargement terminé",
        description: `${successCount} fichier(s) .rac2 téléchargé(s) sur ${fullRaces.length}`,
      });
    } catch (err: any) {
      console.error("Erreur lors du téléchargement des fichiers:", err);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger tous les fichiers .rac2",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingAll(false);
    }
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
        <h2 className="text-2xl font-bold text-slate-900">Indoor - Liste des courses</h2>
        {races.length > 0 && (
          <Button
            onClick={downloadAllRac2Files}
            disabled={isDownloadingAll}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isDownloadingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Téléchargement...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Télécharger tous les .rac2
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground py-8">
            Aucune course disponible
          </p>
        ) : (
          races.map((race) => (
            <Card
              key={race.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/event/${eventId}/indoor/${race.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg">
                  Course {race.race_number} - {race.name}
                </CardTitle>
                {race.race_phase && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Phase: {race.race_phase.name}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {dayjs(race.start_time).format("HH:mm")}
                  </span>
                  {getStatusBadge(race.status)}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}


