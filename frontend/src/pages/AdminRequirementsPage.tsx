import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import type {
  Qualification,
} from "@matapon/shared/schemas/qualifications";

import {
  createQualification,
  deleteQualification,
  getQualifications,
  updateQualification,
} from "../api/qualifications";
import { MataponiLoader } from "../components/feedback/MataponiLoader";

export default function AdminRequirementsPage() {
  const [qualifications, setQualifications] =
    useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] =
    useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] =
    useState<string | null>(null);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getQualifications()
      .then((rows) => {
        if (active) {
          setQualifications(rows);
        }
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not load requirements",
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name = newName.trim();

    if (!name) return;

    setCreating(true);
    setError("");

    try {
      const created =
        await createQualification(name);

      setQualifications((current) =>
        [...current, created].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );

      setNewName("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create requirement",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(id: string) {
    const name = editName.trim();

    if (!name) return;

    setSavingId(id);
    setError("");

    try {
      const updated =
        await updateQualification(id, name);

      setQualifications((current) =>
        current
          .map((row) =>
            row.id === id ? updated : row,
          )
          .sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
      );

      setEditingId(null);
      setEditName("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not rename requirement",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError("");

    try {
      await deleteQualification(id);

      setQualifications((current) =>
        current.filter((row) => row.id !== id),
      );

      setDeleteConfirmId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete requirement",
      );

      setDeleteConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <MataponiLoader />;
  }

  return (
    <section className="admin-events">
      <div className="admin-page-heading">
        <div>
          <div className="member-home-kicker">
            Admin
          </div>
          <h1>Requirements</h1>
        </div>

        <div className="admin-record-count">
          {qualifications.length}{" "}
          {qualifications.length === 1
            ? "requirement"
            : "requirements"}
        </div>
      </div>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      <form
        className="admin-create-form"
        onSubmit={handleCreate}
      >
        <div className="admin-create-title">
          Add requirement
        </div>

        <div className="admin-form-grid">
          <label>
            <span>Name</span>

            <input
              value={newName}
              onChange={(event) =>
                setNewName(event.target.value)
              }
              placeholder="Lifeguard"
              required
            />
          </label>
        </div>

        <div className="admin-create-actions">
          <button
            className="admin-primary-button"
            type="submit"
            disabled={creating}
          >
            {creating
              ? "Adding…"
              : "+ Add Requirement"}
          </button>
        </div>
      </form>

      <div className="admin-activity-list">
        {qualifications.map((qualification) => (
          <article
            className="admin-activity-card"
            key={qualification.id}
          >
            <div className="admin-event-card-top">
              <div>
                {editingId === qualification.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(event) =>
                      setEditName(event.target.value)
                    }
                  />
                ) : (
                  <div className="admin-event-name">
                    {qualification.name}
                  </div>
                )}
              </div>

              <div className="admin-event-actions">
                {editingId === qualification.id ? (
                  <>
                    <button
                      className="admin-edit-button"
                      type="button"
                      disabled={
                        savingId === qualification.id
                      }
                      onClick={() =>
                        void handleSave(
                          qualification.id,
                        )
                      }
                    >
                      {savingId === qualification.id
                        ? "Saving…"
                        : "Save"}
                    </button>

                    <button
                      className="member-cancel-button"
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditName("");
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="admin-edit-button"
                      type="button"
                      onClick={() => {
                        setDeleteConfirmId(null);
                        setEditingId(
                          qualification.id,
                        );
                        setEditName(
                          qualification.name,
                        );
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="admin-delete-button"
                      type="button"
                      onClick={() =>
                        setDeleteConfirmId(
                          qualification.id,
                        )
                      }
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {deleteConfirmId ===
              qualification.id && (
              <div className="admin-delete-confirm">
                <span>
                  Delete this requirement?
                </span>

                <div className="admin-delete-confirm-actions">
                  <button
                    className="admin-delete-cancel"
                    type="button"
                    onClick={() =>
                      setDeleteConfirmId(null)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    className="admin-delete-confirm-button"
                    type="button"
                    disabled={
                      deletingId === qualification.id
                    }
                    onClick={() =>
                      void handleDelete(
                        qualification.id,
                      )
                    }
                  >
                    {deletingId === qualification.id
                      ? "Deleting…"
                      : "Delete Requirement"}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
