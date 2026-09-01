import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { changePasswordUser } from "../api/auth";
import { MataponiLoader } from "../components/feedback/MataponiLoader";
import { useAuth } from "../hooks/useAuth";

export default function ChangePasswordPage() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return <MataponiLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.must_change_password) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      await changePasswordUser({
        current_password: currentPassword,
        new_password: newPassword,
      });

      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Password change failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">M</div>
          <div>
            <div className="brand-name">Mataponi</div>
            <div className="brand-sub">Camp App</div>
          </div>
        </div>

        <div className="login-heading">
          <h1>Change password</h1>
          <p>Create a new password before continuing.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>

          <label>
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button
            className="login-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Changing…" : "Change password"}
          </button>
        </form>
      </section>
    </main>
  );
}
