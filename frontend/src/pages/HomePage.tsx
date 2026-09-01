import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return <Navigate to={`/${user.user_type}`} replace />;
}
