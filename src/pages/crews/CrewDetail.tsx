import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Plus } from "lucide-react";


function SortableRow({ participant }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: participant.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 rounded border flex justify-between items-center bg-white shadow-sm mb-2"
    >
      <div>
        <div className="font-semibold">
          {participant.Participant.first_name} {participant.Participant.last_name}
        </div>
        <div className="text-sm text-muted-foreground">
          Licence : {participant.Participant.license_number} | Club : {participant.Participant.club_name}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Place : {participant.seat_position} {participant.is_coxswain && "(Barreur)"}
      </div>
    </div>
  );
}

export default function CrewDetail() {
  const { crewId } = useParams();
  const [crew, setCrew] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]);
  const [newParticipant, setNewParticipant] = useState({
    first_name: "",
    last_name: "",
    license_number: "",
    club_name: "",
  });

  useEffect(() => {
    async function fetchCrew() {
      try {
        const res = await api.get(`/crews/${crewId}`);
        setCrew(res.data.data);
        setParticipants(
          [...res.data.data.CrewParticipants].sort((a, b) => a.seat_position - b.seat_position)
        );
      } catch (err) {
        console.error("Erreur chargement bateau:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCrew();
  }, [crewId]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = participants.findIndex((p) => p.id === active.id);
    const newIndex = participants.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(participants, oldIndex, newIndex).map((p, index) => ({
      ...p,
      seat_position: index + 1,
    }));
    setParticipants(reordered);
  };

  const handleAddParticipant = () => {
    const id = crypto.randomUUID();
    const seat_position = participants.length + 1;
    const newP = {
      id,
      seat_position,
      is_coxswain: false,
      Participant: { ...newParticipant },
      isNew: true,
    };
    setParticipants([...participants, newP]);
    setNewParticipant({ first_name: "", last_name: "", license_number: "", club_name: "" });
  };

  const handleRemove = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    try {
      const existing = participants.filter((p) => !p.isNew).map((p) => ({
        id: p.id,
        seat_position: p.seat_position,
      }));

      const created = participants
        .filter((p) => p.isNew)
        .map((p) => ({
          first_name: p.Participant.first_name,
          last_name: p.Participant.last_name,
          license_number: p.Participant.license_number,
          club_name: p.Participant.club_name,
          seat_position: p.seat_position,
          is_coxswain: p.is_coxswain,
        }));

      await api.put(`/crews/${crewId}/seats`, {
        seats: existing,
        new: created,
      });

      alert("Modifications enregistrées ✅");
    } catch (err) {
      console.error("Erreur enregistrement:", err);
      alert("Erreur lors de l'enregistrement ❌");
    }
  };

  if (loading) return <Loader2 className="animate-spin" />;
  if (!crew) return <p>Bateau introuvable</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{crew.category?.code || 'N/A'} - {crew.club_name}</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Club</Label>
          <Input value={crew.club_name} readOnly />
        </div>
        <div>
          <Label>Code Club</Label>
          <Input value={crew.club_code} readOnly />
        </div>
        <div>
          <Label>Catégorie</Label>
          <Input value={crew.category?.label || 'N/A'} readOnly />
        </div>
      </div>

      <div>
        <Label className="block mb-2">Participants (drag & drop)</Label>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={participants.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {participants.map((p) => (
              <div key={p.id} className="relative">
                <SortableRow participant={p} />
                
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t pt-4 space-y-2">
        <Label className="block">Ajouter un participant</Label>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input
            placeholder="Prénom"
            value={newParticipant.first_name}
            onChange={(e) => setNewParticipant((p) => ({ ...p, first_name: e.target.value }))}
          />
          <Input
            placeholder="Nom"
            value={newParticipant.last_name}
            onChange={(e) => setNewParticipant((p) => ({ ...p, last_name: e.target.value }))}
          />
          <Input
            placeholder="Licence"
            value={newParticipant.license_number}
            onChange={(e) => setNewParticipant((p) => ({ ...p, license_number: e.target.value }))}
          />
          <Input
            placeholder="Club"
            value={newParticipant.club_name}
            onChange={(e) => setNewParticipant((p) => ({ ...p, club_name: e.target.value }))}
          />
        </div>
        <Button
          onClick={handleAddParticipant}
          variant="outline"
          className="mt-2"
          disabled={!newParticipant.first_name || !newParticipant.last_name}
        >
          <Plus className="w-4 h-4 mr-2" /> Ajouter
        </Button>
      </div>

      <Button onClick={handleSave} className="mt-4">
        Enregistrer
      </Button>
    </div>
  );
}