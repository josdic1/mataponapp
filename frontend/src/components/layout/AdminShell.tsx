import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function AdminShell() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <div className="brand-mark">M</div>

          <div className="brand-copy">
            <div className="brand-name">Mataponi</div>
            <div className="brand-sub">Admin</div>
          </div>
        </div>

        <div className="admin-account">
          <span className="account-role">Admin</span>
          <span className="admin-username">{user?.username}</span>

          <button
            className="btn"
            type="button"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="admin-nav" aria-label="Admin sections">
        <NavLink
          to="/admin/activities"
          className={({ isActive }) =>
            `admin-nav-link${isActive ? " active" : ""}`
          }
        >
          Activities
        </NavLink>

        <NavLink
          to="/admin/requirements"
          className={({ isActive }) =>
            `admin-nav-link${isActive ? " active" : ""}`
          }
        >
          Requirements
        </NavLink>

        <NavLink
          to="/admin/staff"
          className={({ isActive }) =>
            `admin-nav-link${isActive ? " active" : ""}`
          }
        >
          Staff
        </NavLink>

        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `admin-nav-link${isActive ? " active" : ""}`
          }
        >
          Events
        </NavLink>
      </nav>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
