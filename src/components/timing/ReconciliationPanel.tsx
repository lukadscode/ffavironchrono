import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GitCompareArrows, RefreshCw } from "lucide-react";
import {
  getDuplicateGroups,
  reconcileTimings,
  type DuplicateGroup,
} from "@/api/timings";
import { formatTimestamp } from "@/utils/formatTime";
import { getDeviceId, getDeviceLabel } from "@/utils/deviceId";

type Props = {
  timingPointId: string;
  onReconciled: () => void;
};

export default function ReconciliationPanel({ timingPointId, onReconciled }: Props) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const currentDeviceId = getDeviceId();

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDuplicateGroups(timingPointId);
      setGroups(data.groups || []);
    } catch {
      toast({ title: "Erreur chargement doublons", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [timingPointId, toast]);

  useEffect(() => {
    fetchDuplicates();
    const interval = setInterval(fetchDuplicates, 15_000);
    return () => clearInterval(interval);
  }, [fetchDuplicates]);

  const handleKeep = async (group: DuplicateGroup, keepId: string) => {
    const hideIds = group.filter((t) => t.id !== keepId).map((t) => t.id);
    if (hideIds.length === 0) return;

    setResolving(keepId);
    try {
      await reconcileTimings(keepId, hideIds);
      toast({ title: "Doublons réconciliés" });
      await fetchDuplicates();
      onReconciled();
    } catch {
      toast({ title: "Erreur réconciliation", variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  if (groups.length === 0 && !loading) return null;

  return (
    <Card className="border-amber-300/60 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="h-5 w-5 text-amber-700" />
            Double chrono — réconciliation
          </CardTitle>
          <div className="flex items-center gap-2">
            {groups.length > 0 && (
              <Badge variant="secondary">
                {groups.length} conflit{groups.length > 1 ? "s" : ""}
              </Badge>
            )}
            <Button size="sm" variant="ghost" onClick={fetchDuplicates} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.length === 0 && loading && (
          <p className="text-sm text-muted-foreground">Analyse des impulsions…</p>
        )}
        {groups.map((group, idx) => (
          <div key={idx} className="rounded-lg border bg-background p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Groupe {idx + 1} — {group.length} impulsions proches
            </p>
            <div className="space-y-2">
              {group.map((timing) => (
                <div
                  key={timing.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold">
                      {formatTimestamp(timing.timestamp)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {timing.device_id || "Appareil inconnu"}
                      {timing.device_id === currentDeviceId ? " (ce poste)" : ""}
                      {timing.manual_entry ? " · manuel" : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolving !== null}
                    onClick={() => handleKeep(group, timing.id)}
                  >
                    Conserver
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Poste actuel : {getDeviceLabel()}. Choisissez l'impulsion à conserver ; les autres seront masquées.
        </p>
      </CardContent>
    </Card>
  );
}
