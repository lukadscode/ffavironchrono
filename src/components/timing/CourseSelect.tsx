import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";
import { useEffect, useState } from "react";
import axios from "@/lib/axios";

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; color: string }> = {
    not_started: { label: "Non démarrée", color: "bg-gray-100 text-gray-700" },
    in_progress: { label: "En cours", color: "bg-blue-100 text-blue-700" },
    unofficial: { label: "Non officiel", color: "bg-yellow-100 text-yellow-700" },
    official: { label: "Officiel", color: "bg-green-100 text-green-700" },
  };

  const config = statusConfig[status] || statusConfig.not_started;
  return (
    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

export function CourseSelect({ eventId, onChange, selectedRaceId }: { eventId: string, onChange: (raceId: string) => void, selectedRaceId?: string }) {
  const [races, setRaces] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`/races/event/${eventId}`).then(res => {
      const sorted = res.data.sort((a: any, b: any) => a.race_number - b.race_number);
      setRaces(sorted);
    });
  }, [eventId]);

  const selectedRace = races.find(r => r.id === selectedRaceId);

  return (
    <div className="flex items-center gap-3">
      <Select onValueChange={onChange} value={selectedRaceId}>
        <SelectTrigger className="w-[300px]">
          <SelectValue placeholder="Choisir une course" />
        </SelectTrigger>
        <SelectContent>
          {races.map(race => (
            <SelectItem key={race.id} value={race.id}>
              <div className="flex items-center justify-between w-full">
                <span>{race.name} (#{race.race_number})</span>
                {getStatusBadge(race.status)}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedRace && getStatusBadge(selectedRace.status)}
    </div>
  );
}
