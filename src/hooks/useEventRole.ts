import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export type EventRole = "viewer" | "editor" | "referee" | "timing" | "organiser";

/**
 * Hook pour récupérer le rôle de l'utilisateur pour l'événement actuel
 * Les administrateurs globaux (admin/superadmin) ont automatiquement le rôle "organiser"
 */
export function useEventRole(): EventRole | null {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();

  if (!eventId) {
    return null;
  }

  // Si l'utilisateur est admin ou superadmin, il a accès complet (rôle organisateur)
  if (user?.role === "admin" || user?.role === "superadmin") {
    return "organiser";
  }

  // Sinon, chercher le rôle spécifique dans l'événement
  if (!user?.events) {
    return null;
  }

  const event = user.events.find((e: any) => e.id === eventId);
  
  return event?.role || null;
}

