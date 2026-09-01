import { useEffect, useState } from "react";
import type { StaffMember } from "@matapon/shared/schemas/staffMembers";
import type { EventActivityStaff } from "@matapon/shared/schemas/eventActivityStaff";
import type { EventActivitySignup } from "@matapon/shared/schemas/eventActivitySignups";

import {
  getMyStaffAssignments,
  getMyStaffProfile,
} from "../api/staff";

import {
  checkInActivitySignup,
  getActivitySignups,
  undoActivitySignupCheckIn,
} from "../api/eventActivitySignups";

import { MataponiLoader } from "../components/feedback/MataponiLoader";

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [assignments, setAssignments] = useState<EventActivityStaff[]>([]);
  const [signups, setSignups] = useState<EventActivitySignup[]>([]);

  const [openAssignmentId, setOpenAssignmentId] =
    useState<string | null>(null);

  const [busySignupId, setBusySignupId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      getMyStaffProfile(),
      getMyStaffAssignments(),
      getActivitySignups(),
    ])
      .then(([profile, assignmentRows, signupRows]) => {
        if (!active) return;

        setStaff(profile);
        setAssignments(assignmentRows);
        setSignups(signupRows);
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not load staff home",
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

  async function toggleCheckIn(signup: EventActivitySignup) {
    setError("");
    setBusySignupId(signup.id);

    try {
      const updated = signup.checked_in_at
        ? await undoActivitySignupCheckIn(signup.id)
        : await checkInActivitySignup(signup.id);

      setSignups((current) =>
        current.map((row) =>
          row.id === updated.id ? updated : row,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update check-in",
      );
    } finally {
      setBusySignupId(null);
    }
  }

  if (loading) {
    return <MataponiLoader />;
  }

  return (
    <section className="staff-home">
      <div className="member-home-heading">
        <div className="member-home-kicker">Staff</div>
        <h1>{staff?.full_name ?? "My assignments"}</h1>
      </div>

      {error && <div className="login-error">{error}</div>}

      {!error && assignments.length === 0 && (
        <p className="member-empty">No assigned activities yet.</p>
      )}

      <div className="staff-assignment-list">
        {assignments.map((assignment) => {
          const isOpen = openAssignmentId === assignment.id;

          const participants = signups.filter(
            (signup) =>
              String(signup.event_activity_id) ===
              String(assignment.event_activity_id),
          );

          return (
            <article className="staff-assignment" key={assignment.id}>
              <button
                className="staff-assignment-summary"
                type="button"
                onClick={() =>
                  setOpenAssignmentId(isOpen ? null : assignment.id)
                }
              >
                <div>
                  <div className="staff-assignment-event">
                    {assignment.event_name}
                  </div>

                  <div className="staff-assignment-name">
                    {assignment.activity_name}
                  </div>

                  {participants.length > 0 && (
                    <div className="staff-assignment-count">
                      {participants.length} signed up
                    </div>
                  )}
                </div>

                <span className="member-event-chevron">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="staff-participants">
                  <div className="staff-participants-title">
                    Participants
                  </div>

                  {participants.length === 0 && (
                    <div className="member-empty">
                      No one signed up yet.
                    </div>
                  )}

                  {participants.map((signup) => {
                    const checkedIn = Boolean(signup.checked_in_at);
                    const busy = busySignupId === signup.id;

                    return (
                      <button
                        className={
                          checkedIn
                            ? "staff-participant checked-in"
                            : "staff-participant"
                        }
                        type="button"
                        key={signup.id}
                        disabled={busy}
                        onClick={() => void toggleCheckIn(signup)}
                      >
                        <span>{signup.member_name}</span>

                        <span className="staff-checkin-state">
                          {busy
                            ? "…"
                            : checkedIn
                              ? "Checked in"
                              : "Check in"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
