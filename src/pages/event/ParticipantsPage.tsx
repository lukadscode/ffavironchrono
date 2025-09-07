import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";

type Crew = {
  club_name: string;
  Category: {
    code: string;
  };
};

type CrewParticipant = {
  Crew: Crew;
};

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  club_name: string;
  CrewParticipants: CrewParticipant[];
};

export default function ParticipantsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParticipants() {
      try {
        const res = await api.get(`/participants/event/${eventId}`);
        setParticipants(res.data.data ?? []);
      } catch (err) {
        console.error("Erreur chargement participants:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchParticipants();
  }, [eventId]);

  const sortedParticipants = [...participants].sort((a, b) => {
    const codeA = a.CrewParticipants[0]?.Crew?.Category?.code ?? "";
    const codeB = b.CrewParticipants[0]?.Crew?.Category?.code ?? "";
    return codeA.localeCompare(codeB);
  });

  if (loading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {sortedParticipants.length === 0 ? (
          <p className="text-muted-foreground">Aucun participant pour le moment.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead>Bateau</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Club</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedParticipants.map((p) => {
                const crew = p.CrewParticipants[0]?.Crew;
                const category = crew?.Category?.code ?? "—";
                const crewName = crew?.club_name ?? "—";
                return (
                  <TableRow
                    key={p.id}
                    onClick={() =>
                      navigate(`/event/${eventId}/participants/${p.id}`)
                    }
                    className="cursor-pointer hover:bg-muted transition-colors"
                  >
                    <TableCell>{category}</TableCell>
                    <TableCell>{crewName}</TableCell>
                    <TableCell>{p.last_name}</TableCell>
                    <TableCell>{p.first_name}</TableCell>
                    <TableCell>{p.club_name}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
