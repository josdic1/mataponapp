import type { ReactNode } from "react";
import type { UserType } from "@matapon/shared/schemas/users";
import { Role } from "./Role";

type CanProps = {
  allow: UserType | UserType[];
  children: ReactNode;
};

export function Can({ allow, children }: CanProps) {
  return <Role allow={allow}>{children}</Role>;
}
