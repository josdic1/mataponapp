import type { ReactNode } from "react";
import type { UserType } from "@matapon/shared/schemas/users";
import { useCan } from "../../hooks/useCan";

type RoleProps = {
  allow: UserType | UserType[];
  children: ReactNode;
};

export function Role({ allow, children }: RoleProps) {
  return useCan(allow) ? <>{children}</> : null;
}
