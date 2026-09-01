import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export default function MemberSetupPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.user_type !== "member") {
    return <Navigate to={`/${user.user_type}`} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/user-members`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: Number(user.id),
          full_name: fullName,
          email: email || undefined,
          phone: phone || undefined,
          member_role: "primary",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not create your member profile");
      }

      navigate("/member", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create your member profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="member-setup">
      <section className="member-setup-card">
        <div className="member-setup-kicker">Mataponi</div>

        <h1>Set up your member profile</h1>

        <p className="member-setup-intro">
          Tell us who the primary member is for this household.
        </p>

        {error && <div className="login-error">{error}</div>}

        <form className="member-setup-form" onSubmit={handleSubmit}>
          <label className="member-setup-field">
            <span>Full name</span>
            <input
              autoFocus
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>

          <label className="member-setup-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="member-setup-field">
            <span>Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>

          <div className="member-add-actions">
            <button
              type="button"
              className="member-cancel-button"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="member-save-button"
              disabled={saving}
            >
              {saving ? "Creating…" : "Continue"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
