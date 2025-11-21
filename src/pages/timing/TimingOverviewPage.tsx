import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Timer,
  MapPin,
  Hash,
  ArrowRight,
  Loader2,
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
          (a: any, b: any) => a.order_index - b.order_index
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
        <Skeleton className="h-32 w-full" />
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
      <Card>
        <CardContent className="py-12 text-center">
          <Timer className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-lg font-semibold text-muted-foreground mb-2">
            Aucun point de chronométrage
          </p>
          <p className="text-sm text-muted-foreground">
            Créez des points de chronométrage pour commencer
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header compact */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white p-4 shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMjJIMjR2MTJIMTJ2MTJIMjR2MTJIMzZWMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <Timer className="w-6 h-6" />
              Points de chronométrage
            </h1>
            <p className="text-emerald-100 text-sm">
              Sélectionnez un point pour commencer le chronométrage
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
            <div className="text-xs text-emerald-100 mb-1">Total points</div>
            <div className="text-2xl font-bold">{timingPoints.length}</div>
          </div>
        </div>
      </div>

      {/* Grille des points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {timingPoints.map((point) => {
          const isStart = point.order_index === 1;
          const isFinish = point.order_index === timingPoints.length;

          return (
            <Card
              key={point.id}
              className="relative overflow-hidden transition-all duration-200 hover:shadow-lg border-2 hover:border-emerald-400 cursor-pointer group"
              onClick={() => navigate(`/event/${eventId}/timing/${point.id}`)}
            >
              {/* Badge spécial */}
              <div className="absolute top-3 right-3 z-10">
                {isStart && (
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-500 text-white border border-green-400">
                    🏁 DÉPART
                  </span>
                )}
                {isFinish && (
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white border border-red-400">
                    🏁 ARRIVÉE
                  </span>
                )}
                {!isStart && !isFinish && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                    #{point.order_index}
                  </span>
                )}
              </div>

              <CardContent className="p-5 pt-12">
                {/* Label principal */}
                <h3 className="text-xl font-bold mb-4 text-center group-hover:text-emerald-600 transition-colors">
                  {point.label}
                </h3>

                {/* Informations */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Distance
                      </span>
                    </div>
                    <span className="font-bold">{point.distance_m}m</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Ordre
                      </span>
                    </div>
                    <span className="font-bold">#{point.order_index}</span>
                  </div>
                </div>

                {/* Bouton d'action */}
                <Button
                  className="w-full group-hover:bg-emerald-600 group-hover:text-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/event/${eventId}/timing/${point.id}`);
                  }}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Chronométrer
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
