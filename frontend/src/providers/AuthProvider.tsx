import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { LoginInput } from "@matapon/shared/schemas/auth";
import type { SessionUser } from "@matapon/shared/schemas/users";
import { getCurrentUser, loginUser, logoutUser } from "../api/auth";
import { AuthContext } from "../contexts/AuthContext";

export default function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function login(input: LoginInput) {
    const authenticatedUser = await loginUser(input);
    setUser(authenticatedUser);
    return authenticatedUser;
  }

  async function logout() {
    await logoutUser();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
