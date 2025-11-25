import { useAuth } from "@/context/AuthContext";
import { CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function DashboardHome() {
  const { user } = useAuth();
  const events = user?.events || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-xl sm:text-2xl font-semibold">Bienvenue {user?.name} 👋</h2>
      <p className="text-sm sm:text-base text-muted-foreground">
        Voici les événements auxquels vous avez accès :
      </p>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun événement pour l'instant.</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event: any) => (
            <Card key={event.id} className="flex flex-col justify-between">
              <div>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg line-clamp-2">{event.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-4 h-4" />
                    <span>
                      {new Date(event.start_date).toLocaleDateString()} →{" "}
                      {new Date(event.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                  <div className="text-xs mt-2 text-right text-primary">
                    Rôle : {event.role}
                  </div>
                </CardContent>
              </div>
              <CardContent>
                <Button asChild className="w-full mt-2" variant="outline">
                  <Link to={`/event/${event.id}`}>
                    Accéder à l’administration
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
