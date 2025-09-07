import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";
import { useEffect, useState } from "react";
import axios from "@/lib/axios";

export function CourseSelect({ eventId, onChange }: { eventId: string, onChange: (raceId: string) => void }) {
  const [races, setRaces] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`/races/event/${eventId}`).then(res => {
      const sorted = res.data.sort((a: any, b: any) => a.race_number - b.race_number);
      setRaces(sorted);
    });
  }, [eventId]);

  return (
    <Select onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Choisir une course" />
      </SelectTrigger>
      <SelectContent>
        {races.map(race => (
          <SelectItem key={race.id} value={race.id}>
            {race.name} (#{race.race_number})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
