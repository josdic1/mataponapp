import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { MataponiLoader } from "../components/feedback/MataponiLoader";
import DevLoginMenu from "../components/dev/DevLoginMenu";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return <MataponiLoader />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login({ username, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <DevLoginMenu />
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">M</div>
          <div>
            <div className="brand-name">Mataponi</div>
            <div className="brand-sub">Camp App</div>
          </div>
        </div>

        <div className="login-heading">
          <h1>Sign in</h1>
          <p>Enter your Mataponi account.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
