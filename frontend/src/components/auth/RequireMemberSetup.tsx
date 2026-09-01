import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { MataponiLoader } from "../feedback/MataponiLoader";
import { useAuth } from "../../hooks/useAuth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function RequireMemberSetup({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasMember, setHasMember] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.user_type !== "member") {
      setLoading(false);
      return;
    }

    let active = true;

    fetch(`${API_URL}/api/user-members`, {
      credentials: "include",
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Could not load member profile");
        }

        if (active) {
          setHasMember(
            Array.isArray(data.user_members) &&
              data.user_members.length > 0,
          );
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load member profile",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  if (loading) {
    return <MataponiLoader />;
  }

  if (error) {
    return <div className="login-error">{error}</div>;
  }

  if (!hasMember) {
    return <Navigate to="/member/setup" replace />;
  }

  return <>{children}</>;
}
