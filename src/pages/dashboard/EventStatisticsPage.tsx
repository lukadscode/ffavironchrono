import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, User, UserCheck, UsersRound, Building2, Download, FileSpreadsheet, FileText, BarChart3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

interface EventStatistics {
  event_id: string;
  total_participants: number;
  participants_homme: number;
  participants_femme: number;
  total_crews: number;
  total_clubs: number;
}

interface Event {
  id: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
}

interface EventOption {
  id: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
}

export default function EventStatisticsPage() {
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingGlobalStats, setLoadingGlobalStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "csv" | "pdf" | false>(false);
  const [exportingGlobal, setExportingGlobal] = useState<"excel" | "csv" | "pdf" | false>(false);
  const [activeTab, setActiveTab] = useState<"event" | "global">("event");
  const [globalStatistics, setGlobalStatistics] = useState<{
    total_events: number;
    total_participants: number;
    participants_homme: number;
    participants_femme: number;
    total_crews: number;
    total_clubs: number;
    events: Array<{
      event_id: string;
      event_name: string;
      total_participants: number;
      participants_homme: number;
      participants_femme: number;
      total_crews: number;
      total_clubs: number;
    }>;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchEvent();
      fetchStatistics();
    } else {
      setStatistics(null);
      setEvent(null);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (activeTab === "global") {
      fetchGlobalStatistics();
    }
  }, [activeTab, events]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get("/events");
      const eventsData = res.data.data || [];
      setEvents(eventsData);
      
      // Sélectionner le premier événement par défaut
      if (eventsData.length > 0) {
        setSelectedEventId(eventsData[0].id);
      }
    } catch (err) {
      console.error("Erreur chargement événements:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les événements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEvent = async () => {
    if (!selectedEventId) return;
    try {
      const res = await api.get(`/events/${selectedEventId}`);
      setEvent(res.data.data || res.data);
    } catch (err) {
      console.error("Erreur chargement événement:", err);
    }
  };

  const fetchStatistics = async () => {
    if (!selectedEventId) return;

    setLoadingStats(true);
    setError(null);
    try {
      const response = await api.get(`/events/${selectedEventId}/statistics`);
      
      if (response.data.status === "success") {
        setStatistics(response.data.data);
      } else {
        setError(response.data.message || "Erreur lors de la récupération des statistiques");
      }
    } catch (err: any) {
      console.error("Erreur récupération statistiques:", err);
      setError(err?.response?.data?.message || "Impossible de charger les statistiques");
    } finally {
      setLoadingStats(false);
    }
  };

  // Calculer les pourcentages et ratios
  const statsCalculations = useMemo(() => {
    if (!statistics) return null;

    const hommesPercentage = statistics.total_participants > 0
      ? ((statistics.participants_homme / statistics.total_participants) * 100).toFixed(1)
      : "0";
    
    const femmesPercentage = statistics.total_participants > 0
      ? ((statistics.participants_femme / statistics.total_participants) * 100).toFixed(1)
      : "0";

    const participantsPerCrew = statistics.total_crews > 0
      ? (statistics.total_participants / statistics.total_crews).toFixed(1)
      : "0";

    const crewsPerClub = statistics.total_clubs > 0
      ? (statistics.total_crews / statistics.total_clubs).toFixed(1)
      : "0";

    return {
      hommesPercentage,
      femmesPercentage,
      participantsPerCrew,
      crewsPerClub,
    };
  }, [statistics]);

  const exportStatistics = async (format: "excel" | "csv" | "pdf") => {
    if (!statistics || !event || !statsCalculations) return;

    setExporting(format);
    try {
      const { hommesPercentage, femmesPercentage, participantsPerCrew, crewsPerClub } = statsCalculations;

      const exportData = [
        { "Statistique": "Participants totaux", "Valeur": statistics.total_participants },
        { "Statistique": "Participants hommes", "Valeur": statistics.participants_homme, "Pourcentage": `${hommesPercentage}%` },
        { "Statistique": "Participants femmes", "Valeur": statistics.participants_femme, "Pourcentage": `${femmesPercentage}%` },
        { "Statistique": "Total équipages", "Valeur": statistics.total_crews },
        { "Statistique": "Total clubs", "Valeur": statistics.total_clubs },
        { "Statistique": "Participants par équipage", "Valeur": participantsPerCrew },
        { "Statistique": "Équipages par club", "Valeur": crewsPerClub },
      ];

      if (format === "excel") {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Statistiques");
        
        const fileName = `statistiques_${event.name || "event"}_${dayjs().format("YYYY-MM-DD")}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        toast({
          title: "Export Excel réussi",
          description: "Fichier Excel téléchargé",
        });
      } else if (format === "csv") {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `statistiques_${event.name || "event"}_${dayjs().format("YYYY-MM-DD")}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Export CSV réussi",
          description: "Fichier CSV téléchargé",
        });
      } else if (format === "pdf") {
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        // En-tête
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Statistiques de l'événement", 105, 20, { align: "center" });
        
        if (event) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text(event.name, 105, 28, { align: "center" });
          if (event.location) {
            doc.setFontSize(10);
            doc.text(event.location, 105, 33, { align: "center" });
          }
          if (event.start_date) {
            const startDate = dayjs(event.start_date);
            const endDate = event.end_date ? dayjs(event.end_date) : null;
            const dateStr = endDate && !startDate.isSame(endDate, "day")
              ? `${startDate.format("DD/MM/YYYY")} - ${endDate.format("DD/MM/YYYY")}`
              : startDate.format("DD/MM/YYYY");
            doc.text(dateStr, 105, 38, { align: "center" });
          }
        }

        // Tableau des statistiques
        const tableData = exportData.map((row) => [
          row.Statistique,
          row.Valeur?.toString() || "",
          row.Pourcentage || "",
        ]);

        autoTable(doc, {
          startY: 45,
          head: [["Statistique", "Valeur", "Pourcentage"]],
          body: tableData,
          styles: {
            fontSize: 10,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 40, halign: "center" },
            2: { cellWidth: 40, halign: "center" },
          },
          margin: { top: 45, left: 20, right: 20 },
        });

        const fileName = `statistiques_${event.name || "event"}_${dayjs().format("YYYY-MM-DD")}.pdf`;
        doc.save(fileName);

        toast({
          title: "Export PDF réussi",
          description: "Fichier PDF téléchargé",
        });
      }
    } catch (err: any) {
      console.error("Erreur export statistiques:", err);
      toast({
        title: "Erreur",
        description: "Impossible de générer l'export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const fetchGlobalStatistics = async () => {
    if (events.length === 0) return;

    setLoadingGlobalStats(true);
    setError(null);
    try {
      // Récupérer les statistiques de tous les événements
      const allStats = await Promise.all(
        events.map(async (evt) => {
          try {
            const response = await api.get(`/events/${evt.id}/statistics`);
            if (response.data.status === "success") {
              return {
                event_id: evt.id,
                event_name: evt.name,
                ...response.data.data,
              };
            }
            return null;
          } catch (err) {
            console.error(`Erreur statistiques pour ${evt.id}:`, err);
            return null;
          }
        })
      );

      // Filtrer les résultats null et agréger
      const validStats = allStats.filter((s) => s !== null) as Array<{
        event_id: string;
        event_name: string;
        total_participants: number;
        participants_homme: number;
        participants_femme: number;
        total_crews: number;
        total_clubs: number;
      }>;
      
      // Récupérer les clubs uniques de tous les événements
      const uniqueClubsSet = new Set<string>();
      await Promise.all(
        events.map(async (evt) => {
          try {
            const crewsRes = await api.get(`/crews?event_id=${evt.id}`);
            const crews = crewsRes.data.data || crewsRes.data || [];
            crews.forEach((crew: any) => {
              if (crew.club_code) {
                uniqueClubsSet.add(crew.club_code);
              } else if (crew.club_name) {
                uniqueClubsSet.add(crew.club_name);
              }
            });
          } catch (err) {
            console.error(`Erreur récupération clubs pour ${evt.id}:`, err);
          }
        })
      );
      
      const globalStats = {
        total_events: validStats.length,
        total_participants: validStats.reduce((sum, s) => sum + (s?.total_participants || 0), 0),
        participants_homme: validStats.reduce((sum, s) => sum + (s?.participants_homme || 0), 0),
        participants_femme: validStats.reduce((sum, s) => sum + (s?.participants_femme || 0), 0),
        total_crews: validStats.reduce((sum, s) => sum + (s?.total_crews || 0), 0),
        total_clubs: uniqueClubsSet.size || validStats.reduce((sum, s) => sum + (s?.total_clubs || 0), 0),
        events: validStats.map((s) => ({
          event_id: s.event_id,
          event_name: s.event_name,
          total_participants: s.total_participants,
          participants_homme: s.participants_homme,
          participants_femme: s.participants_femme,
          total_crews: s.total_crews,
          total_clubs: s.total_clubs,
        })),
      };

      setGlobalStatistics(globalStats);
    } catch (err: any) {
      console.error("Erreur récupération statistiques globales:", err);
      setError(err?.response?.data?.message || "Impossible de charger les statistiques globales");
    } finally {
      setLoadingGlobalStats(false);
    }
  };

  const exportGlobalStatistics = async (format: "excel" | "csv" | "pdf") => {
    if (!globalStatistics) return;

    setExportingGlobal(format);
    try {
      const hommesPercentage = globalStatistics.total_participants > 0
        ? ((globalStatistics.participants_homme / globalStatistics.total_participants) * 100).toFixed(1)
        : "0";
      
      const femmesPercentage = globalStatistics.total_participants > 0
        ? ((globalStatistics.participants_femme / globalStatistics.total_participants) * 100).toFixed(1)
        : "0";

      const participantsPerCrew = globalStatistics.total_crews > 0
        ? (globalStatistics.total_participants / globalStatistics.total_crews).toFixed(1)
        : "0";

      const crewsPerClub = globalStatistics.total_clubs > 0
        ? (globalStatistics.total_crews / globalStatistics.total_clubs).toFixed(1)
        : "0";

      const exportData = [
        { "Statistique": "Nombre d'événements", "Valeur": globalStatistics.total_events },
        { "Statistique": "Participants totaux", "Valeur": globalStatistics.total_participants },
        { "Statistique": "Participants hommes", "Valeur": globalStatistics.participants_homme, "Pourcentage": `${hommesPercentage}%` },
        { "Statistique": "Participants femmes", "Valeur": globalStatistics.participants_femme, "Pourcentage": `${femmesPercentage}%` },
        { "Statistique": "Total équipages", "Valeur": globalStatistics.total_crews },
        { "Statistique": "Total clubs", "Valeur": globalStatistics.total_clubs },
        { "Statistique": "Participants par équipage", "Valeur": participantsPerCrew },
        { "Statistique": "Équipages par club", "Valeur": crewsPerClub },
      ];

      // Données détaillées par événement
      const eventsData = globalStatistics.events.map((evt) => ({
        "Événement": evt.event_name,
        "Participants totaux": evt.total_participants,
        "Participants hommes": evt.participants_homme,
        "Participants femmes": evt.participants_femme,
        "Équipages": evt.total_crews,
        "Clubs": evt.total_clubs,
      }));

      if (format === "excel") {
        const wb = XLSX.utils.book_new();
        
        // Feuille 1 : Statistiques globales
        const ws1 = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws1, "Statistiques globales");
        
        // Feuille 2 : Détails par événement
        const ws2 = XLSX.utils.json_to_sheet(eventsData);
        XLSX.utils.book_append_sheet(wb, ws2, "Par événement");
        
        const fileName = `statistiques_globales_${dayjs().format("YYYY-MM-DD")}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        toast({
          title: "Export Excel réussi",
          description: "Fichier Excel téléchargé",
        });
      } else if (format === "csv") {
        // CSV avec statistiques globales et détails
        const csvData = [
          ...exportData.map((row) => ({
            Type: "Global",
            Statistique: row.Statistique,
            Valeur: row.Valeur,
            Pourcentage: row.Pourcentage || "",
          })),
          ...eventsData.flatMap((evt) => [
            { Type: "Événement", Statistique: "Événement", Valeur: evt["Événement"], Pourcentage: "" },
            { Type: "Événement", Statistique: "Participants totaux", Valeur: evt["Participants totaux"], Pourcentage: "" },
            { Type: "Événement", Statistique: "Participants hommes", Valeur: evt["Participants hommes"], Pourcentage: "" },
            { Type: "Événement", Statistique: "Participants femmes", Valeur: evt["Participants femmes"], Pourcentage: "" },
            { Type: "Événement", Statistique: "Équipages", Valeur: evt["Équipages"], Pourcentage: "" },
            { Type: "Événement", Statistique: "Clubs", Valeur: evt["Clubs"], Pourcentage: "" },
          ]),
        ];
        
        const ws = XLSX.utils.json_to_sheet(csvData);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `statistiques_globales_${dayjs().format("YYYY-MM-DD")}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Export CSV réussi",
          description: "Fichier CSV téléchargé",
        });
      } else if (format === "pdf") {
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        // En-tête
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Statistiques Globales", 105, 20, { align: "center" });
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Généré le ${dayjs().format("DD/MM/YYYY")}`, 105, 27, { align: "center" });

        // Tableau des statistiques globales
        const tableData = exportData.map((row) => [
          row.Statistique,
          row.Valeur?.toString() || "",
          row.Pourcentage || "",
        ]);

        autoTable(doc, {
          startY: 35,
          head: [["Statistique", "Valeur", "Pourcentage"]],
          body: tableData,
          styles: {
            fontSize: 10,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 40, halign: "center" },
            2: { cellWidth: 40, halign: "center" },
          },
          margin: { top: 35, left: 20, right: 20 },
        });

        // Tableau détaillé par événement
        let yPosition = (doc as any).lastAutoTable.finalY + 15;
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Détails par événement", 20, yPosition);
        yPosition += 8;

        const eventsTableData = eventsData.map((evt) => [
          evt["Événement"],
          evt["Participants totaux"].toString(),
          evt["Participants hommes"].toString(),
          evt["Participants femmes"].toString(),
          evt["Équipages"].toString(),
          evt["Clubs"].toString(),
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Événement", "Participants", "Hommes", "Femmes", "Équipages", "Clubs"]],
          body: eventsTableData,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 25, halign: "center" },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 25, halign: "center" },
            4: { cellWidth: 25, halign: "center" },
            5: { cellWidth: 25, halign: "center" },
          },
          margin: { top: yPosition, left: 20, right: 20 },
        });

        const fileName = `statistiques_globales_${dayjs().format("YYYY-MM-DD")}.pdf`;
        doc.save(fileName);

        toast({
          title: "Export PDF réussi",
          description: "Fichier PDF téléchargé",
        });
      }
    } catch (err: any) {
      console.error("Erreur export statistiques globales:", err);
      toast({
        title: "Erreur",
        description: "Impossible de générer l'export",
        variant: "destructive",
      });
    } finally {
      setExportingGlobal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des événements...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Statistiques des événements</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun événement disponible.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Statistiques des événements</h1>
        <p className="text-muted-foreground">
          Consultez les statistiques détaillées de vos événements
        </p>
      </div>

      {/* Onglets */}
      <div className="mb-6">
        <div className="flex gap-2 border-b bg-muted/30">
          <button
            onClick={() => setActiveTab("event")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "event"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Par événement
          </button>
          <button
            onClick={() => setActiveTab("global")}
            className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "global"
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Users className="w-4 h-4" />
            Statistiques globales
          </button>
        </div>
      </div>

      {activeTab === "event" && (
        <>
          {/* Sélecteur d'événement */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Sélectionner un événement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Sélectionner un événement" />
            </SelectTrigger>
            <SelectContent>
              {events.map((evt) => (
                <SelectItem key={evt.id} value={evt.id}>
                  {evt.name} - {evt.location} ({dayjs(evt.start_date).format("DD/MM/YYYY")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loadingStats ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Chargement des statistiques...</p>
          </div>
        </div>
      ) : !statistics ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Sélectionnez un événement pour voir ses statistiques.</p>
          </CardContent>
        </Card>
      ) : statsCalculations ? (
        <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Statistiques de l'événement</h2>
                {event && (
                  <p className="text-muted-foreground">
                    {event.name} - {event.location}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => exportStatistics("excel")}
                  disabled={exporting === "excel"}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {exporting === "excel" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    "Excel"
                  )}
                </Button>
                <Button
                  onClick={() => exportStatistics("csv")}
                  disabled={exporting === "csv"}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {exporting === "csv" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    "CSV"
                  )}
                </Button>
                <Button
                  onClick={() => exportStatistics("pdf")}
                  disabled={exporting === "pdf"}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {exporting === "pdf" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    "PDF"
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Participants totaux */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Participants totaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              {statistics.total_participants}
            </div>
            <p className="text-sm text-muted-foreground">
              Participants uniques dans l'événement
            </p>
          </CardContent>
        </Card>

        {/* Participants hommes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Participants hommes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {statistics.participants_homme}
            </div>
            <p className="text-sm text-muted-foreground">
              {statsCalculations.hommesPercentage}% du total
            </p>
          </CardContent>
        </Card>

        {/* Participants femmes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-pink-600" />
              Participants femmes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-pink-600 mb-2">
              {statistics.participants_femme}
            </div>
            <p className="text-sm text-muted-foreground">
              {statsCalculations.femmesPercentage}% du total
            </p>
          </CardContent>
        </Card>

        {/* Équipages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-green-600" />
              Équipages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600 mb-2">
              {statistics.total_crews}
            </div>
            <p className="text-sm text-muted-foreground">
              {statsCalculations.participantsPerCrew} participants/équipage
            </p>
          </CardContent>
        </Card>

        {/* Clubs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              Clubs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-600 mb-2">
              {statistics.total_clubs}
            </div>
            <p className="text-sm text-muted-foreground">
              {statsCalculations.crewsPerClub} équipages/club
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphique de répartition par genre */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition par genre</CardTitle>
          <CardDescription>Pourcentage de participants hommes et femmes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Hommes</span>
              <span className="text-muted-foreground">
                {statistics.participants_homme} ({statsCalculations.hommesPercentage}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-8 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-end pr-2 text-white text-sm font-medium transition-all duration-500"
                style={{ width: `${statsCalculations.hommesPercentage}%` }}
              >
                {parseFloat(statsCalculations.hommesPercentage) > 10 && `${statsCalculations.hommesPercentage}%`}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Femmes</span>
              <span className="text-muted-foreground">
                {statistics.participants_femme} ({statsCalculations.femmesPercentage}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-8 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-end pr-2 text-white text-sm font-medium transition-all duration-500"
                style={{ width: `${statsCalculations.femmesPercentage}%` }}
              >
                {parseFloat(statsCalculations.femmesPercentage) > 10 && `${statsCalculations.femmesPercentage}%`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      ) : null}
      </>)}

      {activeTab === "global" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Statistiques Globales</h2>
              <p className="text-muted-foreground">
                Statistiques agrégées sur tous les événements
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => exportGlobalStatistics("excel")}
                disabled={exportingGlobal === "excel"}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exportingGlobal === "excel" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  "Excel"
                )}
              </Button>
              <Button
                onClick={() => exportGlobalStatistics("csv")}
                disabled={exportingGlobal === "csv"}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {exportingGlobal === "csv" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  "CSV"
                )}
              </Button>
              <Button
                onClick={() => exportGlobalStatistics("pdf")}
                disabled={exportingGlobal === "pdf"}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {exportingGlobal === "pdf" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  "PDF"
                )}
              </Button>
            </div>
          </div>

          {loadingGlobalStats ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Chargement des statistiques globales...</p>
              </div>
            </div>
          ) : !globalStatistics ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Aucune statistique globale disponible.</p>
              </CardContent>
            </Card>
          ) : (() => {
            const hommesPercentage = globalStatistics.total_participants > 0
              ? ((globalStatistics.participants_homme / globalStatistics.total_participants) * 100).toFixed(1)
              : "0";
            
            const femmesPercentage = globalStatistics.total_participants > 0
              ? ((globalStatistics.participants_femme / globalStatistics.total_participants) * 100).toFixed(1)
              : "0";

            const participantsPerCrew = globalStatistics.total_crews > 0
              ? (globalStatistics.total_participants / globalStatistics.total_crews).toFixed(1)
              : "0";

            const crewsPerClub = globalStatistics.total_clubs > 0
              ? (globalStatistics.total_crews / globalStatistics.total_clubs).toFixed(1)
              : "0";

            return (
              <>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {/* Nombre d'événements */}
                  <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                        Nombre d'événements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-purple-600 mb-2">
                        {globalStatistics.total_events}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Événements analysés
                      </p>
                    </CardContent>
                  </Card>

                  {/* Participants totaux */}
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Participants totaux
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-primary mb-2">
                        {globalStatistics.total_participants}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Participants uniques sur tous les événements
                      </p>
                    </CardContent>
                  </Card>

                  {/* Participants hommes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        Participants hommes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-blue-600 mb-2">
                        {globalStatistics.participants_homme}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {hommesPercentage}% du total
                      </p>
                    </CardContent>
                  </Card>

                  {/* Participants femmes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-pink-600" />
                        Participants femmes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-pink-600 mb-2">
                        {globalStatistics.participants_femme}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {femmesPercentage}% du total
                      </p>
                    </CardContent>
                  </Card>

                  {/* Équipages */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UsersRound className="w-5 h-5 text-green-600" />
                        Équipages
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-green-600 mb-2">
                        {globalStatistics.total_crews}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {participantsPerCrew} participants/équipage
                      </p>
                    </CardContent>
                  </Card>

                  {/* Clubs */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-orange-600" />
                        Clubs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-orange-600 mb-2">
                        {globalStatistics.total_clubs}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {crewsPerClub} équipages/club
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Graphique de répartition par genre */}
                <Card>
                  <CardHeader>
                    <CardTitle>Répartition par genre (Global)</CardTitle>
                    <CardDescription>Pourcentage de participants hommes et femmes sur tous les événements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Hommes</span>
                        <span className="text-muted-foreground">
                          {globalStatistics.participants_homme} ({hommesPercentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-8 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-end pr-2 text-white text-sm font-medium transition-all duration-500"
                          style={{ width: `${hommesPercentage}%` }}
                        >
                          {parseFloat(hommesPercentage) > 10 && `${hommesPercentage}%`}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Femmes</span>
                        <span className="text-muted-foreground">
                          {globalStatistics.participants_femme} ({femmesPercentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-8 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-end pr-2 text-white text-sm font-medium transition-all duration-500"
                          style={{ width: `${femmesPercentage}%` }}
                        >
                          {parseFloat(femmesPercentage) > 10 && `${femmesPercentage}%`}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Détails par événement */}
                <Card>
                  <CardHeader>
                    <CardTitle>Détails par événement</CardTitle>
                    <CardDescription>Statistiques détaillées pour chaque événement</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="min-w-[250px] font-semibold">Événement</TableHead>
                            <TableHead className="w-32 text-center font-semibold">Participants</TableHead>
                            <TableHead className="w-32 text-center font-semibold">Hommes</TableHead>
                            <TableHead className="w-32 text-center font-semibold">Femmes</TableHead>
                            <TableHead className="w-32 text-center font-semibold">Équipages</TableHead>
                            <TableHead className="w-32 text-center font-semibold">Clubs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {globalStatistics.events.map((evt) => {
                            const evtHommesPct = evt.total_participants > 0
                              ? ((evt.participants_homme / evt.total_participants) * 100).toFixed(1)
                              : "0";
                            const evtFemmesPct = evt.total_participants > 0
                              ? ((evt.participants_femme / evt.total_participants) * 100).toFixed(1)
                              : "0";
                            
                            return (
                              <TableRow key={evt.event_id}>
                                <TableCell className="font-medium">
                                  {evt.event_name}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold">{evt.total_participants}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div>
                                    <span className="font-semibold">{evt.participants_homme}</span>
                                    <div className="text-xs text-muted-foreground">{evtHommesPct}%</div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div>
                                    <span className="font-semibold">{evt.participants_femme}</span>
                                    <div className="text-xs text-muted-foreground">{evtFemmesPct}%</div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold">{evt.total_crews}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold">{evt.total_clubs}</span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

