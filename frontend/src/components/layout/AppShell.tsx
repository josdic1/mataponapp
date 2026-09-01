import { Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">M</div>

          <div className="brand-copy">
            <div className="brand-name">Mataponi</div>
            <div className="brand-sub">Camp App</div>
          </div>
        </div>

        <div className="topbar-spacer" />

        {user && (
          <div className="account">
            <span className="account-role">{user.user_type}</span>
            <span>{user.username}</span>

            <button
              className="btn"
              type="button"
              onClick={() => void logout()}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
