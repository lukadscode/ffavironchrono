import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Loader2, Users, Flag } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

type Crew = {
  id: string;
  club_name: string;
  club_code: string;
  coach_name?: string | null;
  status?: number;
  category?: {
    id: string;
    code: string;
    label: string;
  };
  crew_participants?: Array<{
    id: string;
    seat_position: number;
    is_coxswain: boolean;
    participant: {
      id: string;
      first_name: string;
      last_name: string;
      license_number?: string;
      email?: string;
      gender?: string;
      club_name?: string;
    };
  }>;
};

type Race = {
  id: string;
  name: string;
  race_number: number;
  start_time: string;
  status: string;
  distance_id?: string;
  distance?: {
    id: string;
    meters: number;
    label?: string;
    is_relay?: boolean;
  };
  race_crews?: Array<{
    lane: number;
    crew_id: string;
    crew: Crew;
  }>;
  race_phase?: {
    id: string;
    name: string;
  };
};

type Event = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
};

export default function ExportPage() {
  const { eventId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [exportingGlobal, setExportingGlobal] = useState(false);
  const [exportingStartlist, setExportingStartlist] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      setEvent(res.data.data || res.data);
    } catch (err) {
      console.error("Erreur chargement événement:", err);
    }
  };

  // Fonction pour formater le temps en millisecondes
  const formatTime = (ms: number | null): string => {
    if (ms === null || ms === undefined) return "";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
  };

  // Export Excel global de tous les équipages avec participants et résultats
  const exportGlobalExcel = async () => {
    if (!eventId) return;

    setExportingGlobal(true);
    try {
      // Vérifier le type d'événement (indoor ou normal)
      let isIndoorEvent = false;
      try {
        const eventRes = await api.get(`/events/${eventId}`);
        const eventData = eventRes.data.data || eventRes.data;
        const raceType = eventData.race_type?.toLowerCase() || "";
        isIndoorEvent = raceType.includes("indoor");
      } catch (err) {
        console.error("Erreur vérification type événement", err);
      }

      // Récupérer tous les équipages avec leurs participants
      const crewsRes = await api.get(`/crews/event/${eventId}`);
      let crews: Crew[] = crewsRes.data.data || [];
      
      // TOUJOURS enrichir chaque équipage avec ses participants complets
      crews = await Promise.all(
        crews.map(async (crew) => {
          try {
            const crewDetailRes = await api.get(`/crews/${crew.id}`);
            const crewDetail = crewDetailRes.data.data || crewDetailRes.data;
            return {
              ...crew,
              crew_participants: crewDetail.crew_participants || crewDetail.CrewParticipants || crew.crew_participants || [],
            };
          } catch (err) {
            console.error(`Erreur récupération participants pour équipage ${crew.id}:`, err);
            return crew;
          }
        })
      );

      // Récupérer les phases
      const phasesRes = await api.get(`/race-phases/${eventId}`);
      const phases = phasesRes.data.data || [];

      // Récupérer les distances
      const distancesRes = await api.get(`/distances/event/${eventId}`);
      const distances = distancesRes.data.data || [];
      const distanceMap = new Map(distances.map((d: any) => [d.id, d]));

      // Récupérer toutes les courses avec leurs équipages
      const racesRes = await api.get(`/races/event/${eventId}`);
      let races: Race[] = racesRes.data.data || [];

      // Enrichir les courses avec leurs distances et race_crews si nécessaire
      races = await Promise.all(
        races.map(async (race) => {
          // Si la course n'a pas de race_crews, les récupérer
          if (!race.race_crews || race.race_crews.length === 0) {
            try {
              const raceCrewsRes = await api.get(`/race-crews/${race.id}`);
              race.race_crews = raceCrewsRes.data.data || [];
            } catch (err) {
              console.error(`Erreur récupération race-crews pour ${race.id}:`, err);
              race.race_crews = [];
            }
          }
          
          // Enrichir chaque équipage avec ses participants si nécessaire
          if (race.race_crews && race.race_crews.length > 0) {
            race.race_crews = await Promise.all(
              race.race_crews.map(async (rc) => {
                // Si l'équipage n'a pas de participants, les récupérer
                if (!rc.crew.crew_participants || rc.crew.crew_participants.length === 0) {
                  try {
                    const crewDetailRes = await api.get(`/crews/${rc.crew_id}`);
                    const crewDetail = crewDetailRes.data.data || crewDetailRes.data;
                    return {
                      ...rc,
                      crew: {
                        ...rc.crew,
                        crew_participants: crewDetail.crew_participants || crewDetail.CrewParticipants || [],
                      },
                    };
                  } catch (err) {
                    console.error(`Erreur récupération participants pour équipage ${rc.crew_id}:`, err);
                    return rc;
                  }
                }
                return rc;
              })
            );
          }

          // Si la course n'a pas de distance mais a un distance_id, la récupérer
          if (!race.distance && race.distance_id) {
            const distance = distanceMap.get(race.distance_id) as any;
            if (distance && distance.id && distance.meters !== undefined) {
              race.distance = {
                id: distance.id,
                meters: distance.meters,
                label: distance.label,
                is_relay: distance.is_relay,
              };
            }
          }

          return race;
        })
      );

      // Créer un map des résultats par équipage (timings pour courses normales, indoor pour courses indoor)
      const crewResults = new Map<string, any[]>();
      
      // Pour chaque course, récupérer les résultats (timings ou indoor)
      for (const race of races) {
        try {
          // Pour les événements indoor, récupérer les résultats indoor
          if (isIndoorEvent) {
            try {
              const indoorRes = await api.get(`/indoor-results/race/${race.id}`).catch(() => ({ data: { data: null } }));
              const indoorData = indoorRes.data.data;
              
              if (indoorData && indoorData.participants && indoorData.participants.length > 0) {
                // Pour chaque participant indoor, créer un résultat
                indoorData.participants.forEach((participant: any) => {
                  if (participant.crew_id) {
                    if (!crewResults.has(participant.crew_id)) {
                      crewResults.set(participant.crew_id, []);
                    }
                    
                    crewResults.get(participant.crew_id)?.push({
                      race_id: race.id,
                      race_name: race.name,
                      race_number: race.race_number,
                      lane: race.race_crews?.find((rc: any) => rc.crew_id === participant.crew_id)?.lane || "",
                      start_time: race.start_time,
                      status: race.status,
                      phase: race.race_phase?.name || "",
                      phase_id: race.race_phase?.id || "",
                      distance: race.distance?.meters || race.distance?.label || "",
                      distance_label: race.distance?.label || "",
                      is_relay: race.distance?.is_relay || false,
                      is_indoor: true,
                      // Résultats indoor
                      place: participant.place || "",
                      time_display: participant.time_display || "",
                      time_ms: participant.time_ms || null,
                      distance_indoor: participant.distance || "",
                      avg_pace: participant.avg_pace || "",
                      spm: participant.spm || "",
                      calories: participant.calories || "",
                      // Pas de temps final au format timing pour indoor
                      final_time_ms: participant.time_ms || null,
                      final_time: participant.time_display || "",
                      position: participant.place || null,
                      total_crews: indoorData.participants.length,
                    });
                  }
                });
              }
            } catch (indoorErr: any) {
              // 404 signifie qu'il n'y a pas encore de résultats indoor, c'est normal
              if (indoorErr?.response?.status !== 404) {
                console.error(`Erreur récupération résultats indoor pour course ${race.id}:`, indoorErr);
              }
            }
          } else {
            // Pour les courses normales, récupérer les timings
            const timingsRes = await api.get(`/timings/race/${race.id}`).catch(() => ({ data: { data: [] } }));
            const allTimings = timingsRes.data.data || [];

            // Récupérer les timing points
            const timingPointsRes = await api.get(`/timing-points/race/${race.id}`).catch(() => ({ data: { data: [] } }));
            const timingPoints = timingPointsRes.data.data || [];
            const lastTimingPoint = timingPoints.length > 0 
              ? timingPoints.reduce((last: any, current: any) => 
                  (current.order_index > last.order_index ? current : last), timingPoints[0])
              : null;

            // Récupérer les assignments
            const assignmentsRes = await api.get(`/timing-assignments/race/${race.id}`).catch(() => ({ data: { data: [] } }));
            const assignments = assignmentsRes.data.data || [];
            const timingToCrew = new Map<string, string>();
            assignments.forEach((a: any) => {
              if (a.timing_id && a.crew_id) {
                timingToCrew.set(a.timing_id, a.crew_id);
              }
            });

            // Grouper les timings par crew_id
            const timingsByCrew = new Map<string, any[]>();
            allTimings.forEach((timing: any) => {
              const crewId = timing.crew_id || timingToCrew.get(timing.id);
              if (crewId && timing.relative_time_ms !== null) {
                if (!timingsByCrew.has(crewId)) {
                  timingsByCrew.set(crewId, []);
                }
                timingsByCrew.get(crewId)!.push(timing);
              }
            });

            // Pour chaque équipage dans la course
            race.race_crews?.forEach((rc) => {
              if (!crewResults.has(rc.crew_id)) {
                crewResults.set(rc.crew_id, []);
              }

              // Trouver le timing final
              const crewTimings = timingsByCrew.get(rc.crew_id) || [];
              const finishTiming = lastTimingPoint 
                ? crewTimings.find((t: any) => t.timing_point_id === lastTimingPoint.id)
                : null;

              // Calculer le classement (trier tous les équipages de la course par temps)
              const allCrewTimings = Array.from(timingsByCrew.entries())
                .map(([cid, timings]) => {
                  const finish = lastTimingPoint 
                    ? timings.find((t: any) => t.timing_point_id === lastTimingPoint.id)
                    : null;
                  return { crew_id: cid, time: finish?.relative_time_ms || null };
                })
                .filter((r) => r.time !== null)
                .sort((a, b) => (a.time || 0) - (b.time || 0));

              const position = finishTiming?.relative_time_ms !== null && finishTiming?.relative_time_ms !== undefined
                ? allCrewTimings.findIndex((r) => r.crew_id === rc.crew_id) + 1
                : null;

              crewResults.get(rc.crew_id)?.push({
                race_id: race.id,
                race_name: race.name,
                race_number: race.race_number,
                lane: rc.lane,
                start_time: race.start_time,
                status: race.status,
                phase: race.race_phase?.name || "",
                phase_id: race.race_phase?.id || "",
                distance: race.distance?.meters || race.distance?.label || "",
                distance_label: race.distance?.label || "",
                is_relay: race.distance?.is_relay || false,
                is_indoor: false,
                // Résultats timing
                final_time_ms: finishTiming?.relative_time_ms || null,
                final_time: finishTiming?.relative_time_ms ? formatTime(finishTiming.relative_time_ms) : "",
                position: position,
                total_crews: race.race_crews?.length || 0,
              });
            });
          }
        } catch (err) {
          console.error(`Erreur récupération résultats pour course ${race.id}:`, err);
          // Ajouter quand même les infos de base sans résultats
          race.race_crews?.forEach((rc) => {
            if (!crewResults.has(rc.crew_id)) {
              crewResults.set(rc.crew_id, []);
            }
            crewResults.get(rc.crew_id)?.push({
              race_id: race.id,
              race_name: race.name,
              race_number: race.race_number,
              lane: rc.lane,
              start_time: race.start_time,
              status: race.status,
              phase: race.race_phase?.name || "",
              phase_id: race.race_phase?.id || "",
              distance: race.distance?.meters || race.distance?.label || "",
              distance_label: race.distance?.label || "",
              is_relay: race.distance?.is_relay || false,
              is_indoor: isIndoorEvent,
              final_time_ms: null,
              final_time: "",
              position: null,
              total_crews: race.race_crews?.length || 0,
            });
          });
        }
      }

      // Préparer les données pour Excel avec toutes les informations
      const rows: any[] = [];

      crews.forEach((crew) => {
        const participants = crew.crew_participants || [];
        const sortedParticipants = [...participants].sort((a, b) => {
          if (a.is_coxswain && !b.is_coxswain) return 1;
          if (!a.is_coxswain && b.is_coxswain) return -1;
          return (a.seat_position || 0) - (b.seat_position || 0);
        });
        const results = crewResults.get(crew.id) || [];

        if (sortedParticipants.length === 0) {
          // Équipage sans participants
          if (results.length > 0) {
            results.forEach((result, idx) => {
              rows.push({
                "ID Équipage": idx === 0 ? crew.id : "",
                "Statut Équipage": idx === 0 ? (crew.status || "") : "",
                "Club": idx === 0 ? crew.club_name || "" : "",
                "Code Club": idx === 0 ? crew.club_code || "" : "",
                "Entraîneur": idx === 0 ? crew.coach_name || "" : "",
                "Catégorie": idx === 0 ? crew.category?.label || "" : "",
                "Code Catégorie": idx === 0 ? crew.category?.code || "" : "",
                "Prénom Participant": "",
                "Nom Participant": "",
                "Position Bateau": "",
                "Barreur": "",
                "Licence": "",
                "Email": "",
                "Genre": "",
                "Club Participant": "",
                "ID Course": result.race_id,
                "Course": result.race_name,
                "Numéro Course": result.race_number,
                "Phase": result.phase,
                "Distance": result.distance,
                "Distance Label": result.distance_label,
                "Relais": result.is_relay ? "Oui" : "Non",
                "Couloir": result.lane,
                "Heure Départ": dayjs(result.start_time).format("DD/MM/YYYY HH:mm:ss"),
                "Statut Course": result.status,
                "Type Course": result.is_indoor ? "Indoor" : "Normal",
                "Temps Final (ms)": result.final_time_ms || "",
                "Temps Final": result.final_time,
                "Classement": result.position || "",
                "Total Équipages": result.total_crews,
                // Colonnes spécifiques indoor
                "Place (Indoor)": result.is_indoor ? (result.place || "") : "",
                "Distance (Indoor)": result.is_indoor ? (result.distance_indoor || "") : "",
                "Allure (Indoor)": result.is_indoor ? (result.avg_pace || "") : "",
                "SPM (Indoor)": result.is_indoor ? (result.spm || "") : "",
                "Calories (Indoor)": result.is_indoor ? (result.calories || "") : "",
              });
            });
          } else {
            rows.push({
              "ID Équipage": crew.id,
              "Statut Équipage": crew.status || "",
              "Club": crew.club_name || "",
              "Code Club": crew.club_code || "",
              "Entraîneur": crew.coach_name || "",
              "Catégorie": crew.category?.label || "",
              "Code Catégorie": crew.category?.code || "",
              "Prénom Participant": "",
              "Nom Participant": "",
              "Position Bateau": "",
              "Barreur": "",
              "Licence": "",
              "Email": "",
              "Genre": "",
              "Club Participant": "",
              "ID Course": "",
              "Course": "",
              "Numéro Course": "",
              "Phase": "",
              "Distance": "",
              "Distance Label": "",
              "Relais": "",
              "Couloir": "",
              "Heure Départ": "",
              "Statut Course": "",
              "Type Course": "",
              "Temps Final (ms)": "",
              "Temps Final": "",
              "Classement": "",
              "Total Équipages": "",
              // Colonnes spécifiques indoor
              "Place (Indoor)": "",
              "Distance (Indoor)": "",
              "Allure (Indoor)": "",
              "SPM (Indoor)": "",
              "Calories (Indoor)": "",
            });
          }
        } else {
          // Pour chaque participant
          sortedParticipants.forEach((cp, participantIndex) => {
            const participant = cp.participant;
            const isFirstParticipant = participantIndex === 0;

            if (results.length > 0) {
              // Une ligne par participant par course
              results.forEach((result, resultIndex) => {
                const isFirstResult = resultIndex === 0;
                rows.push({
                  "ID Équipage": isFirstParticipant && isFirstResult ? crew.id : "",
                  "Statut Équipage": isFirstParticipant && isFirstResult ? (crew.status || "") : "",
                  "Club": isFirstParticipant && isFirstResult ? crew.club_name || "" : "",
                  "Code Club": isFirstParticipant && isFirstResult ? crew.club_code || "" : "",
                  "Entraîneur": isFirstParticipant && isFirstResult ? crew.coach_name || "" : "",
                  "Catégorie": isFirstParticipant && isFirstResult ? crew.category?.label || "" : "",
                  "Code Catégorie": isFirstParticipant && isFirstResult ? crew.category?.code || "" : "",
                  "Prénom Participant": participant.first_name || "",
                  "Nom Participant": participant.last_name || "",
                  "Position Bateau": cp.is_coxswain ? "Barreur" : (cp.seat_position || ""),
                  "Barreur": cp.is_coxswain ? "Oui" : "Non",
                  "Licence": participant.license_number || "",
                  "Email": participant.email || "",
                  "Genre": participant.gender || "",
                  "Club Participant": participant.club_name || "",
                  "ID Course": isFirstResult ? result.race_id : "",
                  "Course": isFirstResult ? result.race_name : "",
                  "Numéro Course": isFirstResult ? result.race_number : "",
                  "Phase": isFirstResult ? result.phase : "",
                  "Distance": isFirstResult ? result.distance : "",
                  "Distance Label": isFirstResult ? result.distance_label : "",
                  "Relais": isFirstResult ? (result.is_relay ? "Oui" : "Non") : "",
                  "Couloir": isFirstResult ? result.lane : "",
                  "Heure Départ": isFirstResult ? dayjs(result.start_time).format("DD/MM/YYYY HH:mm:ss") : "",
                  "Statut Course": isFirstResult ? result.status : "",
                  "Type Course": isFirstResult ? (result.is_indoor ? "Indoor" : "Normal") : "",
                  "Temps Final (ms)": isFirstResult ? (result.final_time_ms || "") : "",
                  "Temps Final": isFirstResult ? result.final_time : "",
                  "Classement": isFirstResult ? (result.position || "") : "",
                  "Total Équipages": isFirstResult ? result.total_crews : "",
                  // Colonnes spécifiques indoor
                  "Place (Indoor)": isFirstResult && result.is_indoor ? (result.place || "") : "",
                  "Distance (Indoor)": isFirstResult && result.is_indoor ? (result.distance_indoor || "") : "",
                  "Allure (Indoor)": isFirstResult && result.is_indoor ? (result.avg_pace || "") : "",
                  "SPM (Indoor)": isFirstResult && result.is_indoor ? (result.spm || "") : "",
                  "Calories (Indoor)": isFirstResult && result.is_indoor ? (result.calories || "") : "",
                });
              });
            } else {
              // Pas de course assignée
              rows.push({
                "ID Équipage": isFirstParticipant ? crew.id : "",
                "Statut Équipage": isFirstParticipant ? (crew.status || "") : "",
                "Club": isFirstParticipant ? crew.club_name || "" : "",
                "Code Club": isFirstParticipant ? crew.club_code || "" : "",
                "Entraîneur": isFirstParticipant ? crew.coach_name || "" : "",
                "Catégorie": isFirstParticipant ? crew.category?.label || "" : "",
                "Code Catégorie": isFirstParticipant ? crew.category?.code || "" : "",
                "Prénom Participant": participant.first_name || "",
                "Nom Participant": participant.last_name || "",
                "Position Bateau": cp.is_coxswain ? "Barreur" : (cp.seat_position || ""),
                "Barreur": cp.is_coxswain ? "Oui" : "Non",
                "Licence": participant.license_number || "",
                "Email": participant.email || "",
                "Genre": participant.gender || "",
                "Club Participant": participant.club_name || "",
                "ID Course": "",
                "Course": "",
                "Numéro Course": "",
                "Phase": "",
                "Distance": "",
                "Distance Label": "",
                "Relais": "",
                "Couloir": "",
                "Heure Départ": "",
                "Statut Course": "",
                "Temps Final (ms)": "",
                "Temps Final": "",
                "Classement": "",
                "Total Équipages": "",
              });
            }
          });
        }
      });

      // Créer le workbook Excel
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Équipages");

      // Télécharger
      const fileName = `Export_Global_${event?.name?.replace(/\s+/g, "_") || "Event"}_${dayjs().format("YYYY-MM-DD")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export réussi",
        description: `Fichier Excel généré avec ${rows.length} lignes`,
      });
    } catch (err: any) {
      console.error("Erreur export global:", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de générer l'export Excel",
        variant: "destructive",
      });
    } finally {
      setExportingGlobal(false);
    }
  };

  // Export Startlist en CSV/Excel et PDF
  const exportStartlist = async (format: "excel" | "csv" | "pdf") => {
    if (!eventId) return;

    setExportingStartlist(true);
    try {
      // Récupérer toutes les courses avec leurs équipages
      const racesRes = await api.get(`/races/event/${eventId}`);
      let races: Race[] = (racesRes.data.data || []).sort((a: Race, b: Race) => 
        a.race_number - b.race_number
      );
      
      // Enrichir chaque course avec ses équipages et leurs participants
      races = await Promise.all(
        races.map(async (race) => {
          // Si la course n'a pas de race_crews, les récupérer
          if (!race.race_crews || race.race_crews.length === 0) {
            try {
              const raceCrewsRes = await api.get(`/race-crews/${race.id}`);
              race.race_crews = raceCrewsRes.data.data || [];
            } catch (err) {
              console.error(`Erreur récupération race-crews pour ${race.id}:`, err);
              race.race_crews = [];
            }
          }
          
          // Enrichir chaque équipage avec ses participants si nécessaire
          if (race.race_crews && race.race_crews.length > 0) {
            race.race_crews = await Promise.all(
              race.race_crews.map(async (rc) => {
                // Si l'équipage n'a pas de participants, les récupérer
                if (!rc.crew.crew_participants || rc.crew.crew_participants.length === 0) {
                  try {
                    const crewDetailRes = await api.get(`/crews/${rc.crew_id}`);
                    const crewDetail = crewDetailRes.data.data || crewDetailRes.data;
                    return {
                      ...rc,
                      crew: {
                        ...rc.crew,
                        crew_participants: crewDetail.crew_participants || crewDetail.CrewParticipants || [],
                      },
                    };
                  } catch (err) {
                    console.error(`Erreur récupération participants pour équipage ${rc.crew_id}:`, err);
                    return rc;
                  }
                }
                return rc;
              })
            );
          }
          
          return race;
        })
      );

      if (format === "pdf") {
        // Fonction pour charger le logo (une seule fois)
        const loadLogo = (): Promise<string | null> => {
          return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  resolve(canvas.toDataURL("image/png"));
                } else {
                  resolve(null);
                }
              } catch (err) {
                console.warn("Erreur conversion logo", err);
                resolve(null);
              }
            };
            img.onerror = () => {
              console.warn("Impossible de charger le logo");
              resolve(null);
            };
            img.src = "https://www.ffaviron.fr/wp-content/uploads/2025/06/FFAviron-nouveau-site.png";
          });
        };

        // Charger le logo une seule fois
        const logoDataUrl = await loadLogo();

        // Générer le PDF côté frontend avec jsPDF
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        // Fonction pour ajouter l'en-tête avec logo sur chaque page
        const addHeader = (logoUrl: string | null) => {
          if (logoUrl) {
            // Logo à gauche (hauteur 12mm pour optimiser l'espace)
            try {
              doc.addImage(logoUrl, "PNG", 10, 5, 35, 12);
            } catch (err) {
              console.warn("Erreur ajout logo", err);
            }
          }

          // Titre centré
          doc.setFontSize(15);
          doc.setFont("helvetica", "bold");
          doc.text("LISTE DE DÉPART", 105, 12, { align: "center" });
          
          if (event) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(event.name, 105, 17, { align: "center" });
            if (event.location) {
              doc.setFontSize(8);
              doc.text(event.location, 105, 21, { align: "center" });
            }
            if (event.start_date) {
              const startDate = dayjs(event.start_date);
              const endDate = event.end_date ? dayjs(event.end_date) : null;
              const dateStr = endDate && !startDate.isSame(endDate, "day")
                ? `${startDate.format("DD/MM/YYYY")} - ${endDate.format("DD/MM/YYYY")}`
                : startDate.format("DD/MM/YYYY");
              doc.text(dateStr, 105, 24, { align: "center" });
            }
          }

          // Ligne de séparation
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(10, 27, 200, 27);
        };

        // Ajouter l'en-tête sur la première page
        addHeader(logoDataUrl);

        let yPosition = 32; // Commencer juste après l'en-tête

        // Pour chaque course
        for (let raceIndex = 0; raceIndex < races.length; raceIndex++) {
          const race = races[raceIndex];
          
          // Vérifier si on doit créer une nouvelle page (optimisé : plus d'espace disponible)
          if (yPosition > 275) {
            doc.addPage();
            addHeader(logoDataUrl);
            yPosition = 32; // Réinitialiser après l'en-tête
          }

          // En-tête de course (plus compact)
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          const raceTitle = `Course ${race.race_number}: ${race.name}`;
          doc.text(raceTitle, 10, yPosition);
          yPosition += 5;

          // Informations de la course (plus compact)
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          const raceInfo: string[] = [];
          if (race.start_time) {
            raceInfo.push(`Départ: ${dayjs(race.start_time).format("DD/MM/YYYY HH:mm")}`);
          }
          if (race.race_phase?.name) {
            raceInfo.push(`Phase: ${race.race_phase.name}`);
          }
          if (race.distance?.label || race.distance?.meters) {
            raceInfo.push(`${race.distance.label || `${race.distance.meters}m`}`);
          }
          
          if (raceInfo.length > 0) {
            doc.text(raceInfo.join(" • "), 10, yPosition);
            yPosition += 4;
          }

          // Tableau des équipages
          const raceCrews = (race.race_crews || []).sort((a, b) => a.lane - b.lane);
          
          if (raceCrews.length === 0) {
            doc.setFontSize(8);
            doc.text("Aucun équipage assigné", 10, yPosition);
            yPosition += 6;
          } else {
            // Préparer les données pour le tableau (format compact)
            const tableData = raceCrews.map((rc) => {
              const crew = rc.crew;
              const participants = crew.crew_participants || [];
              const sortedParticipants = [...participants].sort((a, b) => {
                if (a.is_coxswain && !b.is_coxswain) return 1;
                if (!a.is_coxswain && b.is_coxswain) return -1;
                return (a.seat_position || 0) - (b.seat_position || 0);
              });

              // Format compact des noms : NOM Prénom (Pos) ou NOM Prénom (B)
              const participantNames = sortedParticipants
                .map((cp) => {
                  const p = cp.participant;
                  const name = `${p.last_name.toUpperCase()} ${p.first_name}`;
                  const position = cp.is_coxswain ? " (B)" : ` (${cp.seat_position})`;
                  return `${name}${position}`;
                })
                .join(", ");

              // Licences compactes
              const licenses = sortedParticipants
                .map((cp) => cp.participant.license_number || "")
                .filter(Boolean)
                .join(", ");

              return [
                rc.lane.toString(),
                crew.club_name || "",
                crew.club_code || "",
                crew.category?.label || "",
                participantNames || "Aucun participant",
                licenses || "",
              ];
            });

            autoTable(doc, {
              startY: yPosition,
              head: [["C", "Club", "Code", "Catégorie", "Participants", "Licences"]],
              body: tableData,
              styles: { 
                fontSize: 7, 
                cellPadding: 1.5,
                lineWidth: 0.1,
                lineColor: [200, 200, 200]
              },
              headStyles: { 
                fillColor: [66, 139, 202], 
                textColor: 255, 
                fontStyle: "bold",
                fontSize: 7
              },
              alternateRowStyles: { fillColor: [250, 250, 250] },
              margin: { left: 10, right: 10, top: 2 },
              columnStyles: {
                0: { cellWidth: 8, halign: "center" }, // Couloir
                1: { cellWidth: 35 }, // Club
                2: { cellWidth: 18 }, // Code
                3: { cellWidth: 30 }, // Catégorie
                4: { cellWidth: 60 }, // Participants
                5: { cellWidth: 25 }, // Licences
              },
              tableWidth: "auto",
            });

            // Récupérer la position Y après le tableau
            const finalY = (doc as any).lastAutoTable.finalY || yPosition + (raceCrews.length * 5);
            yPosition = finalY + 4; // Espacement réduit entre les courses
          }

          // Séparateur entre les courses (plus discret)
          if (raceIndex < races.length - 1) {
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.2);
            doc.line(10, yPosition, 200, yPosition);
            yPosition += 3;
          }
        }

        // Ajouter l'en-tête sur toutes les pages (sauf la première déjà faite) et le pied de page
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          
          // Réajouter l'en-tête sur les pages suivantes (la première a déjà l'en-tête)
          if (i > 1) {
            addHeader(logoDataUrl);
          }
          
          // Pied de page
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(120, 120, 120);
          doc.text(
            `Page ${i} / ${pageCount} - Généré le ${dayjs().format("DD/MM/YYYY à HH:mm")}`,
            105,
            287,
            { align: "center" }
          );
          doc.setTextColor(0, 0, 0); // Réinitialiser la couleur
        }

        // Télécharger le PDF
        const fileName = `Startlist_${event?.name?.replace(/\s+/g, "_") || "Event"}_${dayjs().format("YYYY-MM-DD")}.pdf`;
        doc.save(fileName);

        toast({
          title: "Export PDF réussi",
          description: "Fichier PDF généré et téléchargé",
        });
      } else {
        // Générer Excel ou CSV avec une meilleure structure
        const allRows: any[] = [];

        // En-tête global
        allRows.push({
          "COURSE": "=== STARTLIST ===",
          "NUMÉRO": "",
          "HEURE DÉPART": "",
          "STATUT": "",
          "PHASE": "",
          "COULOIR": "",
          "CLUB": "",
          "CODE CLUB": "",
          "CATÉGORIE": "",
          "CODE CATÉGORIE": "",
          "PARTICIPANTS": "",
          "LICENCES": "",
        });

        races.forEach((race, raceIndex) => {
          // Séparateur de course
          if (raceIndex > 0) {
            allRows.push({});
          }

          // En-tête de course avec informations détaillées
          allRows.push({
            "COURSE": `COURSE ${race.race_number}: ${race.name}`,
            "NUMÉRO": race.race_number,
            "HEURE DÉPART": dayjs(race.start_time).format("DD/MM/YYYY HH:mm"),
            "STATUT": race.status,
            "PHASE": race.race_phase?.name || "",
            "COULOIR": "",
            "CLUB": "",
            "CODE CLUB": "",
            "CATÉGORIE": "",
            "CODE CATÉGORIE": "",
            "PARTICIPANTS": "",
            "LICENCES": "",
          });

          // En-tête des colonnes pour les équipages
          allRows.push({
            "COURSE": "",
            "NUMÉRO": "",
            "HEURE DÉPART": "",
            "STATUT": "",
            "PHASE": "",
            "COULOIR": "COULOIR",
            "CLUB": "CLUB",
            "CODE CLUB": "CODE",
            "CATÉGORIE": "CATÉGORIE",
            "CODE CATÉGORIE": "CODE CAT.",
            "PARTICIPANTS": "PARTICIPANTS",
            "LICENCES": "LICENCES",
          });

          // Équipages de la course
          const raceCrews = (race.race_crews || []).sort((a, b) => a.lane - b.lane);
          
          if (raceCrews.length === 0) {
            allRows.push({
              "COURSE": "",
              "NUMÉRO": "",
              "HEURE DÉPART": "",
              "STATUT": "",
              "PHASE": "",
              "COULOIR": "Aucun équipage",
              "CLUB": "",
              "CODE CLUB": "",
              "CATÉGORIE": "",
              "CODE CATÉGORIE": "",
              "PARTICIPANTS": "",
              "LICENCES": "",
            });
          } else {
            raceCrews.forEach((rc) => {
              const crew = rc.crew;
              const participants = crew.crew_participants || [];
              const sortedParticipants = [...participants].sort((a, b) => a.seat_position - b.seat_position);
              
              // Formater les participants avec leurs positions
              const participantNames = sortedParticipants
                .map((cp) => {
                  const p = cp.participant;
                  const name = `${p.last_name.toUpperCase()}, ${p.first_name}`;
                  const position = cp.is_coxswain ? " (Barreur)" : ` (Pos. ${cp.seat_position})`;
                  return `${name}${position}`;
                })
                .join(" • ");

              const licenses = sortedParticipants
                .map((cp) => cp.participant.license_number || "")
                .filter(Boolean)
                .join(", ");

              allRows.push({
                "COURSE": "",
                "NUMÉRO": "",
                "HEURE DÉPART": "",
                "STATUT": "",
                "PHASE": "",
                "COULOIR": rc.lane,
                "CLUB": crew.club_name || "",
                "CODE CLUB": crew.club_code || "",
                "CATÉGORIE": crew.category?.label || "",
                "CODE CATÉGORIE": crew.category?.code || "",
                "PARTICIPANTS": participantNames,
                "LICENCES": licenses,
              });
            });
          }
        });

        if (format === "excel") {
          const ws = XLSX.utils.json_to_sheet(allRows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Startlist");

          const fileName = `Startlist_${event?.name?.replace(/\s+/g, "_") || "Event"}_${dayjs().format("YYYY-MM-DD")}.xlsx`;
          XLSX.writeFile(wb, fileName);

          toast({
            title: "Export Excel réussi",
            description: "Fichier Excel téléchargé",
          });
        } else if (format === "csv") {
          const ws = XLSX.utils.json_to_sheet(allRows);
          const csv = XLSX.utils.sheet_to_csv(ws);

          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `Startlist_${event?.name?.replace(/\s+/g, "_") || "Event"}_${dayjs().format("YYYY-MM-DD")}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          toast({
            title: "Export CSV réussi",
            description: "Fichier CSV téléchargé",
          });
        }
      }
    } catch (err: any) {
      console.error("Erreur export startlist:", err);
      toast({
        title: "Erreur",
        description: err?.response?.data?.message || "Impossible de générer l'export",
        variant: "destructive",
      });
    } finally {
      setExportingStartlist(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Exports</h1>
        <p className="text-muted-foreground">
          Exportez les données de l'événement dans différents formats
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Global Excel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Export Global Excel
            </CardTitle>
            <CardDescription>
              Export complet de tous les équipages avec leurs participants et résultats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cet export contient :
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Informations des équipages (club, catégorie, entraîneur)</li>
              <li>Liste complète des participants avec leurs positions</li>
              <li>Résultats et affectations aux courses</li>
            </ul>
            <Button
              onClick={exportGlobalExcel}
              disabled={exportingGlobal}
              className="w-full"
            >
              {exportingGlobal ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Export Startlist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export Startlist
            </CardTitle>
            <CardDescription>
              Liste de départ par course avec équipages, catégories et participants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Formats disponibles :
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => exportStartlist("excel")}
                disabled={exportingStartlist}
                variant="outline"
                className="w-full justify-start"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {exportingStartlist ? "Génération..." : "Excel (.xlsx)"}
              </Button>
              <Button
                onClick={() => exportStartlist("csv")}
                disabled={exportingStartlist}
                variant="outline"
                className="w-full justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                {exportingStartlist ? "Génération..." : "CSV (.csv)"}
              </Button>
              <Button
                onClick={() => exportStartlist("pdf")}
                disabled={exportingStartlist}
                variant="outline"
                className="w-full justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                {exportingStartlist ? "Génération..." : "PDF (.pdf)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

