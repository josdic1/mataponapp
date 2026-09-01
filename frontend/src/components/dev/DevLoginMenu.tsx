import { useEffect, useState } from "react";
import type { UserType } from "@matapon/shared/schemas/users";
import { devLogin, getDevUsers, type DevUser } from "../../api/dev";
import { useAuth } from "../../hooks/useAuth";

const categories: Array<{
  type: UserType;
  label: string;
}> = [
  { type: "member", label: "Members" },
  { type: "staff", label: "Staff" },
  { type: "admin", label: "Admins" },
];

export default function DevLoginMenu() {
  const { refresh } = useAuth();

  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);

    getDevUsers()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  async function switchUser(user: DevUser) {
    setSwitching(user.id);

    try {
      await devLogin(user.id);
      await refresh();
      setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSwitching(null);
    }
  }

  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="dev-login-menu">
      <button
        type="button"
        className="dev-login-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        DEV LOGIN
        <span>{open ? "×" : "↓"}</span>
      </button>

      {open && (
        <div className="dev-login-panel">
          {loading ? (
            <div className="dev-login-loading">Loading users…</div>
          ) : (
            categories.map((category) => {
              const categoryUsers = users.filter(
                (user) => user.user_type === category.type,
              );

              if (categoryUsers.length === 0) {
                return null;
              }

              return (
                <div className="dev-login-category" key={category.type}>
                  <div className="dev-login-category-label">
                    {category.label}
                  </div>

                  <div className="dev-login-user-list">
                    {categoryUsers.map((user) => (
                      <button
                        type="button"
                        className="dev-login-user"
                        key={user.id}
                        disabled={switching !== null}
                        onClick={() => void switchUser(user)}
                      >
                        <span>{user.username}</span>
                        {switching === user.id && (
                          <span className="dev-login-switching">
                            …
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
