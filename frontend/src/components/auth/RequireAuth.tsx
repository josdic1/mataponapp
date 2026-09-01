import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { MataponiLoader } from "../feedback/MataponiLoader";
import { useAuth } from "../../hooks/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <MataponiLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
