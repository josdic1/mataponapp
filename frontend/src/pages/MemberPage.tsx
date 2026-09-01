import { useEffect, useState, type FormEvent } from "react";
import type {
  MemberRole,
  UserMember,
} from "@matapon/shared/schemas/users";
import {
  createHouseholdMember,
  deleteHouseholdMember,
  getMyHousehold,
  transferPrimaryMember,
  updateHouseholdMember,
} from "../api/userMembers";
import { MataponiLoader } from "../components/feedback/MataponiLoader";
import { useAuth } from "../hooks/useAuth";

type EditingMember = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dietaryRestrictions: string;
  memberRole: MemberRole;
};

export default function MemberPage() {
  const { user } = useAuth();

  const [members, setMembers] = useState<UserMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [fullName, setFullName] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("child");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [editing, setEditing] = useState<EditingMember | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getMyHousehold()
      .then((household) => {
        if (active) {
          setMembers(household);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not load household",
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
  }, []);

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");
    setSaving(true);

    try {
      if (!user) return;

      const newMember = await createHouseholdMember({
        user_id: Number(user.id),
        full_name: fullName.trim(),
        member_role: memberRole,
      });

      setMembers((current) => [...current, newMember]);
      setFullName("");
      setMemberRole("child");
      setAdding(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not add family member",
      );
    } finally {
      setSaving(false);
    }
  }

  function beginEditing(member: UserMember) {
    setFormError("");
    setEditing({
      id: member.id,
      fullName: member.full_name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      dietaryRestrictions: member.dietary_restrictions ?? "",
      memberRole: member.member_role,
    });
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing) return;

    setFormError("");
    setSaving(true);

    try {
      const updated = await updateHouseholdMember(editing.id, {
        full_name: editing.fullName.trim(),
        email: editing.email.trim() || null,
        phone: editing.phone.trim() || null,
        dietary_restrictions:
          editing.dietaryRestrictions.trim() || null,
        ...(editing.memberRole !== "primary"
          ? { member_role: editing.memberRole }
          : {}),
      });

      setMembers((current) =>
        current.map((member) =>
          member.id === updated.id ? updated : member,
        ),
      );

      setEditing(null);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not update family member",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: UserMember) {
    const confirmed = window.confirm(
      `Delete ${member.full_name} from this household?`,
    );

    if (!confirmed) return;

    setDeletingId(member.id);
    setError("");

    try {
      await deleteHouseholdMember(member.id);

      setMembers((current) =>
        current.filter((row) => row.id !== member.id),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete family member",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTransfer(
    source: UserMember,
    target: UserMember,
  ) {
    const confirmed = window.confirm(
      `Transfer Primary from ${source.full_name} to ${target.full_name}?`,
    );

    if (!confirmed) return;

    setTransferringId(source.id);
    setError("");

    try {
      const updatedMembers = await transferPrimaryMember(source.id, {
        target_member_id: Number(target.id),
      });

      setMembers(updatedMembers);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not transfer primary",
      );
    } finally {
      setTransferringId(null);
    }
  }

  if (loading) {
    return <MataponiLoader />;
  }

  const primary = members.find(
    (member) => member.member_role === "primary",
  );

  const adults = members.filter(
    (member) => member.member_role === "adult",
  );

  return (
    <section className="member-home">
      <div className="member-home-heading-row">
        <div className="member-home-heading">
          <div className="member-home-kicker">Your family</div>
          <h1>Household</h1>
        </div>

        {!adding && !editing && (
          <button
            className="member-add-button"
            type="button"
            onClick={() => {
              setAdding(true);
              setFormError("");
            }}
          >
            + Add
          </button>
        )}
      </div>

      {error && <div className="login-error">{error}</div>}

      {adding && (
        <form className="member-add-form" onSubmit={handleAddMember}>
          <div className="member-add-title">Add family member</div>

          <label>
            <span>Name</span>
            <input
              autoFocus
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Full name"
              required
            />
          </label>

          <label>
            <span>Role</span>
            <select
              value={memberRole}
              onChange={(event) =>
                setMemberRole(event.target.value as MemberRole)
              }
            >
              <option value="adult">Adult</option>
              <option value="child">Child</option>
            </select>
          </label>

          {formError && <div className="login-error">{formError}</div>}

          <div className="member-add-actions">
            <button
              className="member-cancel-button"
              type="button"
              onClick={() => {
                setAdding(false);
                setFormError("");
                setFullName("");
              }}
            >
              Cancel
            </button>

            <button
              className="member-save-button"
              type="submit"
              disabled={saving}
            >
              {saving ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
      )}

      {editing && (
        <form className="member-add-form" onSubmit={handleEdit}>
          <div className="member-add-title">Edit family member</div>

          <label>
            <span>Name</span>
            <input
              autoFocus
              value={editing.fullName}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  fullName: event.target.value,
                })
              }
              required
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={editing.email}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  email: event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>Phone</span>
            <input
              value={editing.phone}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  phone: event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>Dietary restrictions</span>
            <input
              value={editing.dietaryRestrictions}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  dietaryRestrictions: event.target.value,
                })
              }
            />
          </label>

          {editing.memberRole !== "primary" && (
            <label>
              <span>Role</span>
              <select
                value={editing.memberRole}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    memberRole: event.target.value as MemberRole,
                  })
                }
              >
                <option value="adult">Adult</option>
                <option value="child">Child</option>
              </select>
            </label>
          )}

          {editing.memberRole === "primary" && (
            <div className="member-primary-note">
              Primary can only change through Transfer Primary.
            </div>
          )}

          {formError && <div className="login-error">{formError}</div>}

          <div className="member-add-actions">
            <button
              className="member-cancel-button"
              type="button"
              onClick={() => {
                setEditing(null);
                setFormError("");
              }}
            >
              Cancel
            </button>

            <button
              className="member-save-button"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {!error && members.length === 0 && !adding && (
        <p className="member-empty">No household members yet.</p>
      )}

      <div className="member-household-list">
        {members.map((member) => (
          <article className="member-person" key={member.id}>
            <div>
              <div className="member-person-name">
                {member.full_name}
              </div>
              <div className="member-person-role">
                {member.member_role}
              </div>
            </div>

            {!editing && (
              <div className="member-person-actions">
                <button
                  type="button"
                  onClick={() => beginEditing(member)}
                >
                  Edit
                </button>

                {member.member_role !== "primary" && (
                  <button
                    type="button"
                    disabled={deletingId === member.id}
                    onClick={() => void handleDelete(member)}
                  >
                    {deletingId === member.id ? "Deleting…" : "Delete"}
                  </button>
                )}

                {member.member_role === "primary" &&
                  adults.length > 0 && (
                    <label>
                      <span>Transfer primary</span>
                      <select
                        value=""
                        disabled={transferringId === member.id}
                        onChange={(event) => {
                          const target = adults.find(
                            (adult) => adult.id === event.target.value,
                          );

                          if (target) {
                            void handleTransfer(member, target);
                          }
                        }}
                      >
                        <option value="" disabled>
                          {transferringId === member.id
                            ? "Transferring…"
                            : "Select adult"}
                        </option>
                        {adults.map((adult) => (
                          <option key={adult.id} value={adult.id}>
                            {adult.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
              </div>
            )}
          </article>
        ))}
      </div>

      {primary && adults.length > 0 && (
        <div className="member-primary-note">
          Only the current Primary can transfer Primary to another Adult.
        </div>
      )}
    </section>
  );
}
