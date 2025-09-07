import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ParticipantDetailsPage() {
  const { participantId, eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [participant, setParticipant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get(`/participants/${participantId}`);
        setParticipant(res.data.data);
      } catch (err) {
        toast({
          title: "Erreur",
          description: "Impossible de charger le participant.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [participantId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParticipant({ ...participant, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/participants/${participantId}`, participant);
      toast({ title: "Participant mis à jour avec succès." });
    } catch (err) {
      toast({ title: "Erreur de mise à jour", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/participants/${participantId}`);
      toast({ title: "Participant supprimé." });
      navigate(`/event/${eventId}/participants`);
    } catch (err) {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  if (loading) return <p>Chargement...</p>;
  if (!participant) return <p>Participant introuvable</p>;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>
            Fiche participant : {participant.last_name} {participant.first_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input name="last_name" value={participant.last_name} onChange={handleChange} />
          </div>
          <div>
            <Label>Prénom</Label>
            <Input name="first_name" value={participant.first_name} onChange={handleChange} />
          </div>
          <div>
            <Label>Licence</Label>
            <Input name="license_number" value={participant.license_number} onChange={handleChange} />
          </div>
          <div>
            <Label>Sexe</Label>
            <Input name="gender" value={participant.gender} onChange={handleChange} />
          </div>
          <div>
            <Label>Club</Label>
            <Input name="club_name" value={participant.club_name} onChange={handleChange} />
          </div>

          <div className="flex gap-4 mt-6">
            <Button onClick={handleUpdate}>Enregistrer</Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CREW BLOCKS */}
      {participant.CrewParticipants?.length > 0 && (
        <div className="space-y-4">
          {participant.CrewParticipants.map((cp: any) => {
            const crew = cp.Crew;
            const category = crew?.Category;
            return (
              <Card
                key={cp.id}
                onClick={() => navigate(`/event/${eventId}/crews/${crew.id}`)}
                className="cursor-pointer hover:bg-muted transition-colors"
              >
                <CardHeader>
                  <CardTitle>
                    Équipage : {crew?.club_name ?? "Inconnu"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1 text-muted-foreground">
                  <p>Catégorie : {category?.label ?? "—"} ({category?.code ?? "—"})</p>
                  <p>Club code : {crew?.club_code ?? "—"}</p>
                  <p>Poste dans le bateau : {cp.seat_position ?? "—"}</p>
                  <p>{cp.is_coxswain ? "Rôle : Barreur / Cox" : "Rôle : Rameur"}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
