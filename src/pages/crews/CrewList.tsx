// src/pages/dashboard/crews/CrewList.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import api from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CrewList() {
  const { eventId } = useParams();
  const [crews, setCrews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCrews() {
      try {
        const res = await api.get(`/crews/event/${eventId}`);
        console.log("✅ Réponse API crews:", res.data);
        const sorted = res.data.data.sort((a: any, b: any) =>
          a.Category.code.localeCompare(b.Category.code)
        );
        setCrews(sorted);
      } catch (err: any) {
        console.error("❌ Erreur chargement crews:", err);
        console.error("❌ Détails:", err.response?.data);
        console.error("❌ Status:", err.response?.status);
      } finally {
        setLoading(false);
      }
    }
    fetchCrews();
  }, [eventId]);

  if (loading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">

      {crews.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun bateau trouvé pour cet événement.</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead>Club</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crews.map((crew) => (
                <TableRow key={crew.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link
                      to={`${crew.id}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {crew.Category.code}
                    </Link>
                  </TableCell>
                  <TableCell>{crew.club_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </CardContent>
    </Card>
  );
}

