import type { UserType } from "@matapon/shared/schemas/users";
import { useAuth } from "./useAuth";

export function useCan(allow: UserType | UserType[]) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return false;
  }

  const allowedRoles = Array.isArray(allow) ? allow : [allow];

  return allowedRoles.includes(user.user_type);
}
