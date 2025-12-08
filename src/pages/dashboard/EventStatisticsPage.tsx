import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "csv" | "pdf" | false>(false);
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
    try {
      const res = await api.get(`/events/${eventId}`);
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
    </div>
  );
}

