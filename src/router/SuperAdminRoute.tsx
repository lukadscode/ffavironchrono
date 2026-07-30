import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type SuperAdminRouteProps = {
  children: ReactNode;
};

export default function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role !== "superadmin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
