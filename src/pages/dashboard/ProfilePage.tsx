import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getTokenExpiration,
  getTokenTimeRemaining,
  getTokenDuration,
  formatTimeRemaining,
} from "@/utils/jwt";
import dayjs from "dayjs";
import { AdminPage } from "@/components/layout/AdminPage";
import { User } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<{
    expiration: Date | null;
    timeRemaining: number | null;
    duration: number | null;
  }>({
    expiration: null,
    timeRemaining: null,
    duration: null,
  });

  useEffect(() => {
    const updateSessionInfo = () => {
      const stored = localStorage.getItem("authTokens");
      if (stored) {
        try {
          const { access_token } = JSON.parse(stored);
          if (access_token) {
            const expiration = getTokenExpiration(access_token);
            const timeRemaining = getTokenTimeRemaining(access_token);
            const duration = getTokenDuration(access_token);
            
            setSessionInfo({
              expiration,
              timeRemaining,
              duration,
            });
          }
        } catch (error) {
          console.error("Erreur lors de la lecture des tokens:", error);
        }
      }
    };

    updateSessionInfo();
    // Mettre à jour toutes les minutes
    const interval = setInterval(updateSessionInfo, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminPage
      title="Votre profil"
      description="Informations de compte et session active."
      icon={User}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm sm:text-base">
            <strong>Nom :</strong> {user?.name || "N/A"}
          </div>
          <div className="text-sm sm:text-base">
            <strong>Email :</strong> {user?.email || "N/A"}
          </div>
          <div className="text-sm sm:text-base">
            <strong>Licence :</strong> {user?.num_license || "N/A"}
          </div>
          <div className="text-sm sm:text-base">
            <strong>Rôle :</strong>{" "}
            <span className="capitalize">{user?.role || "N/A"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Informations de session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionInfo.duration && (
            <div className="text-sm sm:text-base">
              <strong>Durée de la session :</strong>{" "}
              {formatTimeRemaining(sessionInfo.duration)}
            </div>
          )}
          {sessionInfo.expiration && (
            <div className="text-sm sm:text-base">
              <strong>Expiration :</strong>{" "}
              <span className="break-words">
                {dayjs(sessionInfo.expiration).format("DD/MM/YYYY à HH:mm:ss")}
              </span>
            </div>
          )}
          {sessionInfo.timeRemaining !== null && (
            <div className="text-sm sm:text-base">
              <strong>Temps restant :</strong>{" "}
              <span
                className={
                  sessionInfo.timeRemaining < 5 * 60 * 1000
                    ? "text-red-600 font-semibold"
                    : sessionInfo.timeRemaining < 15 * 60 * 1000
                    ? "text-orange-600 font-semibold"
                    : ""
                }
              >
                {formatTimeRemaining(sessionInfo.timeRemaining)}
              </span>
            </div>
          )}
          {!sessionInfo.expiration && (
            <div className="text-muted-foreground text-sm">
              Impossible de récupérer les informations de session
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
