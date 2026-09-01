import { useEffect, useState } from "react";

import type { StaffMember } from "@matapon/shared/schemas/staffMembers";
import type {
  Qualification,
  StaffQualification,
} from "@matapon/shared/schemas/qualifications";

import { getStaffMembers } from "../api/staff";
import { getQualifications } from "../api/qualifications";
import {
  addStaffQualification,
  getStaffQualifications,
  removeStaffQualification,
} from "../api/staffQualifications";
import { MataponiLoader } from "../components/feedback/MataponiLoader";

export default function AdminStaffPage() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [qualifications, setQualifications] =
    useState<Qualification[]>([]);
  const [staffQualifications, setStaffQualifications] =
    useState<StaffQualification[]>([]);
  const [changingKey, setChangingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      getStaffMembers(),
      getQualifications(),
      getStaffQualifications(),
    ])
      .then(([
        staffRows,
        qualificationRows,
        staffQualificationRows,
      ]) => {
        if (!active) return;

        setStaffMembers(staffRows);
        setQualifications(qualificationRows);
        setStaffQualifications(staffQualificationRows);
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not load staff",
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

  async function toggleQualification(
    staffMember: StaffMember,
    qualification: Qualification,
  ) {
    const key = `${staffMember.id}:${qualification.id}`;
    setChangingKey(key);
    setError("");

    const existing = staffQualifications.find(
      (row) =>
        String(row.staff_member_id) ===
          String(staffMember.id) &&
        String(row.qualification_id) ===
          String(qualification.id),
    );

    try {
      if (existing) {
        await removeStaffQualification(existing.id);

        setStaffQualifications((current) =>
          current.filter((row) => row.id !== existing.id),
        );
      } else {
        const created = await addStaffQualification({
          staff_member_id: Number(staffMember.id),
          qualification_id: Number(qualification.id),
        });

        setStaffQualifications((current) => [
          ...current,
          created,
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not change qualification",
      );
    } finally {
      setChangingKey(null);
    }
  }

  if (loading) {
    return <MataponiLoader />;
  }

  return (
    <section className="admin-events">
      <div className="admin-page-heading">
        <div>
          <div className="member-home-kicker">Admin</div>
          <h1>Staff</h1>
        </div>

        <div className="admin-record-count">
          {staffMembers.length}{" "}
          {staffMembers.length === 1 ? "staff member" : "staff members"}
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="admin-activity-list">
        {staffMembers.map((staffMember) => (
          <article
            className="admin-activity-card"
            key={staffMember.id}
          >
            <div className="admin-event-type">
              {staffMember.role}
            </div>

            <div className="admin-event-name">
              {staffMember.full_name}
            </div>

            <div className="admin-operation-block">
              <div className="admin-operation-label">
                Qualifications
              </div>

              {qualifications.length === 0 ? (
                <div className="admin-operation-empty">
                  No qualifications defined.
                </div>
              ) : (
                <div className="admin-staff-options">
                  {qualifications.map((qualification) => {
                    const assigned = staffQualifications.some(
                      (row) =>
                        String(row.staff_member_id) ===
                          String(staffMember.id) &&
                        String(row.qualification_id) ===
                          String(qualification.id),
                    );

                    const key =
                      `${staffMember.id}:${qualification.id}`;

                    return (
                      <button
                        className={
                          assigned
                            ? "admin-staff-option assigned"
                            : "admin-staff-option"
                        }
                        type="button"
                        key={qualification.id}
                        disabled={changingKey === key}
                        onClick={() =>
                          void toggleQualification(
                            staffMember,
                            qualification,
                          )
                        }
                      >
                        <span>{qualification.name}</span>
                        <span>
                          {changingKey === key
                            ? "…"
                            : assigned
                              ? "Qualified"
                              : "+ Add"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
