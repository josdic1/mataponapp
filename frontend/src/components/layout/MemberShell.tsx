import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function MemberShell() {
  const { user, logout } = useAuth();

  return (
    <div className="member-shell">
      <header className="member-topbar">
        <div className="member-brand">
          <div className="brand-mark">M</div>

          <div className="brand-copy">
            <div className="brand-name">Mataponi</div>
            <div className="brand-sub">Camp App</div>
          </div>
        </div>

        <div className="member-account">
          <span>{user?.username}</span>

          <button
            className="member-logout"
            type="button"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="member-nav">
        <NavLink
          to="/member"
          end
          className={({ isActive }) =>
            isActive ? "member-nav-link active" : "member-nav-link"
          }
        >
          Family
        </NavLink>

        <NavLink
          to="/member/events"
          className={({ isActive }) =>
            isActive ? "member-nav-link active" : "member-nav-link"
          }
        >
          Events
        </NavLink>
      </nav>

      <main className="member-main">
        <Outlet />
      </main>
    </div>
  );
}
