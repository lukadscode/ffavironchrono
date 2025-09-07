import { Button } from "@/components/ui/button";
import dayjs from "dayjs";

type Props = {
  hiddenTimings: {
    id: string;
    timestamp: string;
    status: string;
  }[];
  setTimings: React.Dispatch<React.SetStateAction<any[]>>;
  toast: (params: { title: string; description?: string; variant?: "destructive" }) => void;
};

export default function DebugTimings({ hiddenTimings, setTimings, toast }: Props) {
  const restoreTiming = async (id: string) => {
    try {
      await fetch(`/api/timings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      setTimings((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "pending" } : t))
      );

      toast({ title: "Timing restauré", description: "Statut mis à jour" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de restaurer", variant: "destructive" });
    }
  };

  return (
    <div className="mt-6 border rounded-xl shadow-sm overflow-x-auto">
      <h2 className="px-4 py-2 bg-muted text-muted-foreground font-semibold">Timings masqués (debug)</h2>
      <table className="min-w-full text-sm text-left table-fixed">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="p-3 w-40 font-semibold">Heure</th>
            <th className="p-3 font-semibold">Statut</th>
            <th className="p-3 w-32 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hiddenTimings.map((timing) => (
            <tr key={timing.id} className="border-t hover:bg-accent transition">
              <td className="p-2 font-mono whitespace-nowrap">
                {dayjs(timing.timestamp).format("HH:mm:ss.SSS")}
              </td>
              <td className="p-2">{timing.status}</td>
              <td className="p-2 text-center">
                <Button size="sm" variant="outline" onClick={() => restoreTiming(timing.id)}>
                  🔁 Restaurer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
