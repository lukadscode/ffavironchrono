import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();

  const tokens = localStorage.getItem("authTokens");

  // ⏳ En attente du user après auto-login
  if (!user && tokens) {
    return null; // 🔄 Ou <Spinner /> si tu en as un
  }

  // 🔐 Non authentifié
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // ✅ Authentifié : rend les enfants
  return <>{children}</>;
}
