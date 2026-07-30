import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPage } from "@/components/layout/AdminPage";
import {
  Timer,
  MapPin,
  Hash,
  ArrowRight,
  Clock,
} from "lucide-react";

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
        const sorted = res.data.data.sort(
          (a: TimingPoint, b: TimingPoint) => a.order_index - b.order_index
        );
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
  }, [eventId, toast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (timingPoints.length === 0) {
    return (
      <AdminPage
        title="Chronométrage"
        description="Aucun point de chronométrage configuré pour cet événement."
        icon={Timer}
      >
        <Card>
          <CardContent className="py-12 text-center">
            <Timer className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">
              Créez des points de chronométrage pour commencer
            </p>
          </CardContent>
        </Card>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Postes de chronométrage"
      description="Sélectionnez un point pour ouvrir l'écran de prise de temps."
      icon={Timer}
      actions={
        <Badge variant="outline">{timingPoints.length} point{timingPoints.length > 1 ? "s" : ""}</Badge>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {timingPoints.map((point) => {
          const isStart = point.order_index === 1;
          const isFinish = point.order_index === timingPoints.length;

          return (
            <Card
              key={point.id}
              className="transition-all hover:shadow-md hover:border-primary/40 cursor-pointer group"
              onClick={() => navigate(`/event/${eventId}/timing/${point.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Badge
                    variant={isStart ? "default" : isFinish ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {isStart ? "Départ" : isFinish ? "Arrivée" : `#${point.order_index}`}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <h3 className="text-lg font-semibold mb-4 group-hover:text-primary transition-colors">
                  {point.label}
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Distance
                    </span>
                    <span className="font-medium">{point.distance_m} m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      Ordre
                    </span>
                    <span className="font-medium">{point.order_index}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Type
                    </span>
                    <span className="font-medium">
                      {isStart ? "Départ" : isFinish ? "Arrivée" : "Intermédiaire"}
                    </span>
                  </div>
                </div>

                <Button className="w-full mt-4" variant="outline" size="sm">
                  Ouvrir le poste
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminPage>
  );
}
