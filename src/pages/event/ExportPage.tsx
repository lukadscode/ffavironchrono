import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Loader2, Users, Flag } from "lucide-react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";

type Crew = {
  id: string;
  club_name: string;
  club_code: string;
  coach_name?: string | null;
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

  // Export Excel global de tous les équipages avec participants et résultats
  const exportGlobalExcel = async () => {
    if (!eventId) return;

    setExportingGlobal(true);
    try {
      // Récupérer tous les équipages
      const crewsRes = await api.get(`/crews/event/${eventId}`);
      const crews: Crew[] = crewsRes.data.data || [];

      // Récupérer toutes les courses pour les résultats
      const racesRes = await api.get(`/races/event/${eventId}`);
      const races: Race[] = racesRes.data.data || [];

      // Créer un map des résultats par équipage
      const crewResults = new Map<string, any[]>();
      races.forEach((race) => {
        race.race_crews?.forEach((rc) => {
          if (!crewResults.has(rc.crew_id)) {
            crewResults.set(rc.crew_id, []);
          }
          crewResults.get(rc.crew_id)?.push({
            race_name: race.name,
            race_number: race.race_number,
            lane: rc.lane,
            start_time: race.start_time,
            status: race.status,
            phase: race.race_phase?.name || "",
          });
        });
      });

      // Préparer les données pour Excel
      const rows: any[] = [];

      crews.forEach((crew) => {
        const participants = crew.crew_participants || [];
        const results = crewResults.get(crew.id) || [];

        if (participants.length === 0) {
          // Équipage sans participants
          rows.push({
            "ID Équipage": crew.id,
            "Club": crew.club_name || "",
            "Code Club": crew.club_code || "",
            "Entraîneur": crew.coach_name || "",
            "Catégorie": crew.category?.label || "",
            "Code Catégorie": crew.category?.code || "",
            "Prénom Participant": "",
            "Nom Participant": "",
            "Position": "",
            "Barreur": "",
            "Licence": "",
            "Email": "",
            "Genre": "",
            "Course": "",
            "Numéro Course": "",
            "Couloir": "",
            "Heure Départ": "",
            "Statut": "",
            "Phase": "",
          });
        } else {
          // Pour chaque participant
          participants.forEach((cp, index) => {
            const participant = cp.participant;
            const isFirstRow = index === 0;

            rows.push({
              "ID Équipage": isFirstRow ? crew.id : "",
              "Club": isFirstRow ? crew.club_name || "" : "",
              "Code Club": isFirstRow ? crew.club_code || "" : "",
              "Entraîneur": isFirstRow ? crew.coach_name || "" : "",
              "Catégorie": isFirstRow ? crew.category?.label || "" : "",
              "Code Catégorie": isFirstRow ? crew.category?.code || "" : "",
              "Prénom Participant": participant.first_name || "",
              "Nom Participant": participant.last_name || "",
              "Position": cp.seat_position || "",
              "Barreur": cp.is_coxswain ? "Oui" : "Non",
              "Licence": participant.license_number || "",
              "Email": participant.email || "",
              "Genre": participant.gender || "",
              "Course": isFirstRow && results.length > 0 ? results[0].race_name : "",
              "Numéro Course": isFirstRow && results.length > 0 ? results[0].race_number : "",
              "Couloir": isFirstRow && results.length > 0 ? results[0].lane : "",
              "Heure Départ": isFirstRow && results.length > 0 ? dayjs(results[0].start_time).format("DD/MM/YYYY HH:mm") : "",
              "Statut": isFirstRow && results.length > 0 ? results[0].status : "",
              "Phase": isFirstRow && results.length > 0 ? results[0].phase : "",
            });
          });

          // Ajouter les autres résultats si plusieurs courses
          if (results.length > 1) {
            results.slice(1).forEach((result) => {
              rows.push({
                "ID Équipage": "",
                "Club": "",
                "Code Club": "",
                "Entraîneur": "",
                "Catégorie": "",
                "Code Catégorie": "",
                "Prénom Participant": "",
                "Nom Participant": "",
                "Position": "",
                "Barreur": "",
                "Licence": "",
                "Email": "",
                "Genre": "",
                "Course": result.race_name,
                "Numéro Course": result.race_number,
                "Couloir": result.lane,
                "Heure Départ": dayjs(result.start_time).format("DD/MM/YYYY HH:mm"),
                "Statut": result.status,
                "Phase": result.phase,
              });
            });
          }
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
      const races: Race[] = (racesRes.data.data || []).sort((a: Race, b: Race) => 
        a.race_number - b.race_number
      );

      if (format === "pdf") {
        // Utiliser l'API backend pour le PDF avec gestion d'erreur robuste
        try {
          const res = await api.get(`/exports/startlist/event/${eventId}`, {
            responseType: "blob",
            validateStatus: () => true, // Ne pas rejeter automatiquement les erreurs HTTP
          });

          // Vérifier le statut de la réponse
          if (res.status < 200 || res.status >= 300) {
            let errorMsg = `HTTP ${res.status}`;
            try {
              const text = await (res.data as any).text?.();
              if (text) {
                try {
                  const json = JSON.parse(text);
                  errorMsg = json?.message || json?.error || errorMsg;
                } catch {
                  errorMsg = text;
                }
              }
            } catch {}
            
            toast({
              title: "Erreur export PDF",
              description: errorMsg || "L'endpoint PDF n'est pas disponible. Veuillez utiliser Excel ou CSV.",
              variant: "destructive",
            });
            return;
          }

          // Vérifier que c'est bien un PDF
          const contentType = (res.headers?.["content-type"] || "").toLowerCase();
          if (!contentType.includes("pdf")) {
            toast({
              title: "Erreur export PDF",
              description: "Le serveur n'a pas renvoyé un fichier PDF valide. Veuillez utiliser Excel ou CSV.",
              variant: "destructive",
            });
            return;
          }

          const blob = new Blob([res.data], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `Startlist_${event?.name?.replace(/\s+/g, "_") || "Event"}_${dayjs().format("YYYY-MM-DD")}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          toast({
            title: "Export PDF réussi",
            description: "Fichier PDF téléchargé",
          });
        } catch (err: any) {
          console.error("Erreur export PDF:", err);
          toast({
            title: "Erreur export PDF",
            description: err?.response?.data?.message || err?.message || "Impossible de générer le PDF. Veuillez utiliser Excel ou CSV.",
            variant: "destructive",
          });
        }
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

