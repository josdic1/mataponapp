import type { ReactNode } from "react";
import type { UserType } from "@matapon/shared/schemas/users";
import { Navigate } from "react-router-dom";
import { MataponiLoader } from "../feedback/MataponiLoader";
import { useAuth } from "../../hooks/useAuth";

type RequireRoleProps = {
  allow: UserType | UserType[];
  children: ReactNode;
};

export function RequireRole({ allow, children }: RequireRoleProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <MataponiLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = Array.isArray(allow) ? allow : [allow];

  if (!allowedRoles.includes(user.user_type)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
