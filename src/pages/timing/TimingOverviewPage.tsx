// src/pages/TimingOverviewPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type TimingPoint = {
  id: string;
  label: string;
  order_index: number;
  distance_m: number;
};

export default function TimingOverviewPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [timingPoints, setTimingPoints] = useState<TimingPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    api
      .get(`/timing-points/event/${eventId}`)
      .then((res) => {
        const sorted = res.data.data.sort((a: any, b: any) => a.order_index - b.order_index);
        setTimingPoints(sorted);
      })
      .catch(() => {
        toast({
          title: "Erreur",
          description: "Impossible de charger les points de chrono.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {loading ? (
        <p>Chargement…</p>
      ) : (
        timingPoints.map((point) => (
          <Card key={point.id}>
            <CardHeader>
              <CardTitle>{point.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="text-sm text-muted-foreground">
                Ordre : {point.order_index}
              </div>
              <div className="text-sm text-muted-foreground">
                Distance : {point.distance_m} m
              </div>
              <Button
                variant="default"
                onClick={() => navigate(`/event/${eventId}/timing/${point.id}`)}
              >
                Chronométrer
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
