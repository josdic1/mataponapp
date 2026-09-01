import { createContext } from "react";
import type { LoginInput } from "@matapon/shared/schemas/auth";
import type { SessionUser } from "@matapon/shared/schemas/users";

export type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
