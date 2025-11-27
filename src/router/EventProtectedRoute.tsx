import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEventRole } from "@/hooks/useEventRole";
import type { EventRole } from "@/hooks/useEventRole";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type EventProtectedRouteProps = {
  children: ReactNode;
  allowedRoles: EventRole[];
  fallbackPath?: string;
};

/**
 * Définition des permissions par rôle
 */
const ROLE_PERMISSIONS: Record<EventRole, string[]> = {
  organiser: [
    // Accès complet à tout
    "overview",
    "participants",
    "crews",
    "races",
    "timing",
    "distances",
    "permissions",
    "notifications",
    "racePhases",
    "generate-races",
    "timingPoint",
    "arbitres",
    "indoor",
    "export",
  ],
  editor: [
    // Accès à participants, équipages, distance, courses et phases
    "overview",
    "participants",
    "crews",
    "distances",
    "races",
    "racePhases",
    "generate-races",
    "export",
  ],
  referee: [
    // Accès à la page arbitre
    "overview",
    "arbitres",
  ],
  timing: [
    // Accès aux pages indoor, Points et chrono
    "overview",
    "indoor",
    "timingPoint",
    "timing",
  ],
  viewer: [
    // Aucun accès pour l'instant (seulement overview)
    "overview",
  ],
};

/**
 * Vérifie si un rôle a accès à une route donnée
 */
function hasAccess(role: EventRole | null, routePath: string): boolean {
  if (!role) return false;

  // L'organisateur a accès à tout
  if (role === "organiser") return true;

  // Normaliser le chemin (enlever les paramètres)
  const normalizedPath = routePath.split("/").pop() || routePath;
  
  // Vérifier les permissions du rôle
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  return permissions.includes(normalizedPath);
}

/**
 * Composant de protection des routes d'événement basé sur les rôles
 */
export default function EventProtectedRoute({
  children,
  allowedRoles,
  fallbackPath,
}: EventProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const eventRole = useEventRole();

  // En attente du chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Non authentifié
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Pas d'événement dans l'URL
  if (!eventId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Vérifier si l'utilisateur est admin/superadmin (accès complet)
  const isGlobalAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Pas de rôle pour cet événement (sauf si admin global)
  if (!eventRole && !isGlobalAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Accès refusé</h2>
          <p className="text-muted-foreground">
            Vous n'avez pas accès à cet événement.
          </p>
          <Navigate to="/dashboard" replace />
        </div>
      </div>
    );
  }

  // Vérifier si le rôle est autorisé (ou si admin global)
  const effectiveRole = isGlobalAdmin ? "organiser" : eventRole;
  if (effectiveRole && !allowedRoles.includes(effectiveRole)) {
    const defaultFallback = fallbackPath || `/event/${eventId}`;
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Accès refusé</h2>
          <p className="text-muted-foreground">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <Navigate to={defaultFallback} replace />
        </div>
      </div>
    );
  }

  // ✅ Accès autorisé
  return <>{children}</>;
}

/**
 * Hook pour vérifier les permissions dans un composant
 */
export function useEventPermission(requiredRoute: string): boolean {
  const eventRole = useEventRole();
  return hasAccess(eventRole, requiredRoute);
}

/**
 * Export des permissions pour utilisation dans d'autres composants
 */
export { ROLE_PERMISSIONS, hasAccess };

