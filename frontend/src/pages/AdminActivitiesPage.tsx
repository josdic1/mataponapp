import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import type {
  Activity,
  ActivitySetting,
  CreateActivityInput,
} from "@matapon/shared/schemas/activities";
import type { Area } from "@matapon/shared/schemas/areas";
import type {
  ActivityQualification,
  Qualification,
} from "@matapon/shared/schemas/qualifications";

import {
  createActivity,
  deleteActivity,
  getActivities,
  getActivity,
  updateActivity,
} from "../api/activities";
import { getAreas } from "../api/areas";
import { getQualifications } from "../api/qualifications";
import {
  addActivityQualification,
  getActivityQualifications,
  removeActivityQualification,
} from "../api/activityQualifications";

import { MataponiLoader } from "../components/feedback/MataponiLoader";

function settingLabel(setting: ActivitySetting) {
  if (setting === "inside") return "Inside";
  if (setting === "outside") return "Outside";
  return "Other";
}

export default function AdminActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [qualifications, setQualifications] =
    useState<Qualification[]>([]);
  const [activityQualifications, setActivityQualifications] =
    useState<ActivityQualification[]>([]);
  const [requiredQualificationIds, setRequiredQualificationIds] =
    useState<string[]>([]);
  const [qualificationPickerOpen, setQualificationPickerOpen] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingEditId, setLoadingEditId] =
    useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] =
    useState<string | null>(null);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState("");
  const [setting, setSetting] =
    useState<ActivitySetting>("outside");
  const [otherValue, setOtherValue] = useState("");
  const [otherReason, setOtherReason] = useState("");

  async function refreshActivities() {
    const rows = await getActivities();
    setActivities(rows);
  }

  async function refreshActivityQualifications() {
    const rows = await getActivityQualifications();
    setActivityQualifications(rows);
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      getActivities(),
      getAreas(),
      getQualifications(),
      getActivityQualifications(),
    ])
      .then(([
        activityRows,
        areaRows,
        qualificationRows,
        activityQualificationRows,
      ]) => {
        if (active) {
          setActivities(activityRows);
          setAreas(areaRows);
          setQualifications(qualificationRows);
          setActivityQualifications(activityQualificationRows);

          if (areaRows[0]) {
            setAreaId(areaRows[0].id);
          }
        }
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not load activities",
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

  function resetForm() {
    setName("");
    setAreaId(areas[0]?.id ?? "");
    setSetting("outside");
    setOtherValue("");
    setOtherReason("");
    setRequiredQualificationIds([]);
    setQualificationPickerOpen(false);
    setCreating(false);
    setEditingId(null);
  }

  async function beginEdit(activity: Activity) {
    setError("");
    setDeleteConfirmId(null);
    setCreating(false);
    setEditingId(null);
    setRequiredQualificationIds([]);
    setQualificationPickerOpen(false);
    setLoadingEditId(activity.id);

    try {
      const [
        detail,
        currentActivityQualifications,
      ] = await Promise.all([
        getActivity(activity.id),
        getActivityQualifications(),
      ]);

      setActivityQualifications(
        currentActivityQualifications,
      );
      setEditingId(activity.id);
      setName(detail.name);
      setAreaId(detail.area_id);
      setSetting(detail.setting);
      setOtherValue(detail.setting_other?.value ?? "");
      setOtherReason(detail.setting_other?.reason ?? "");
      setRequiredQualificationIds(
        currentActivityQualifications
          .filter(
            (row) =>
              String(row.activity_id) ===
              String(activity.id),
          )
          .map((row) => row.qualification_id),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load activity",
      );
    } finally {
      setLoadingEditId(null);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    const input: CreateActivityInput = {
      name: name.trim(),
      area_id: Number(areaId),
      setting,
      ...(setting === "other"
        ? {
            other_value: otherValue.trim(),
            other_reason: otherReason.trim(),
          }
        : {}),
    };

    setSaving(true);

    try {
      let savedActivityId = editingId;

      if (editingId) {
        await updateActivity(editingId, input);
      } else {
        const created = await createActivity(input);
        savedActivityId = created.id;
      }

      if (!savedActivityId) {
        throw new Error("Activity was saved without an id");
      }

      const existing =
        activityQualifications.filter(
          (row) =>
            String(row.activity_id) ===
            String(savedActivityId),
        );

      const removeRows = existing.filter(
        (row) =>
          !requiredQualificationIds.includes(
            row.qualification_id,
          ),
      );

      const addIds = requiredQualificationIds.filter(
        (qualificationId) =>
          !existing.some(
            (row) =>
              String(row.qualification_id) ===
              String(qualificationId),
          ),
      );

      await Promise.all([
        ...removeRows.map((row) =>
          removeActivityQualification(row.id),
        ),
        ...addIds.map((qualificationId) =>
          addActivityQualification({
            activity_id: Number(savedActivityId),
            qualification_id: Number(qualificationId),
          }),
        ),
      ]);

      await Promise.all([
        refreshActivities(),
        refreshActivityQualifications(),
      ]);

      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? "Could not update activity"
            : "Could not create activity",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    setDeletingId(id);

    try {
      await deleteActivity(id);
      await refreshActivities();

      if (editingId === id) {
        resetForm();
      }

      setDeleteConfirmId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete activity",
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
          <div className="member-home-kicker">Admin</div>
          <h1>Activities</h1>
        </div>

        <div className="admin-heading-actions">
          <div className="admin-record-count">
            {activities.length}{" "}
            {activities.length === 1
              ? "activity"
              : "activities"}
          </div>

          {!creating && !editingId && (
            <button
              className="admin-primary-button"
              type="button"
              onClick={() => {
                resetForm();
                setCreating(true);
                setError("");
              }}
            >
              + Create Activity
            </button>
          )}
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      {(creating || editingId) && (
        <form
          className="admin-create-form"
          onSubmit={handleSubmit}
        >
          <div className="admin-create-title">
            {editingId ? "Edit activity" : "Create activity"}
          </div>

          <div className="admin-form-grid">
            <label>
              <span>Name</span>

              <input
                autoFocus
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Waterskiing"
                required
              />
            </label>

            <label>
              <span>Area</span>

              <select
                value={areaId}
                onChange={(event) =>
                  setAreaId(event.target.value)
                }
                required
              >
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Setting</span>

              <select
                value={setting}
                onChange={(event) =>
                  setSetting(
                    event.target.value as ActivitySetting,
                  )
                }
                required
              >
                <option value="outside">Outside</option>
                <option value="inside">Inside</option>
                <option value="other">Other</option>
              </select>
            </label>

            <div>
              <span>Required qualifications</span>

              {requiredQualificationIds.length === 0 ? (
                <div className="admin-operation-empty">
                  No special qualification
                </div>
              ) : (
                <div className="admin-staff-options">
                  {qualifications
                    .filter((qualification) =>
                      requiredQualificationIds.includes(
                        qualification.id,
                      ),
                    )
                    .map((qualification) => (
                      <button
                        className="admin-staff-option assigned"
                        type="button"
                        key={qualification.id}
                        onClick={() =>
                          setRequiredQualificationIds(
                            (current) =>
                              current.filter(
                                (id) =>
                                  id !== qualification.id,
                              ),
                          )
                        }
                      >
                        <span>{qualification.name}</span>
                        <span>Remove</span>
                      </button>
                    ))}
                </div>
              )}

              {qualifications.some(
                (qualification) =>
                  !requiredQualificationIds.includes(
                    qualification.id,
                  ),
              ) && (
                <>
                  <button
                    className="admin-edit-button"
                    type="button"
                    onClick={() =>
                      setQualificationPickerOpen(
                        (current) => !current,
                      )
                    }
                  >
                    {qualificationPickerOpen
                      ? "Cancel"
                      : "+ Add requirement"}
                  </button>

                  {qualificationPickerOpen && (
                    <div className="admin-staff-options">
                      {qualifications
                        .filter(
                          (qualification) =>
                            !requiredQualificationIds.includes(
                              qualification.id,
                            ),
                        )
                        .map((qualification) => (
                          <button
                            className="admin-staff-option"
                            type="button"
                            key={qualification.id}
                            onClick={() => {
                              setRequiredQualificationIds(
                                (current) => [
                                  ...current,
                                  qualification.id,
                                ],
                              );
                              setQualificationPickerOpen(false);
                            }}
                          >
                            <span>
                              {qualification.name}
                            </span>
                            <span>+ Add</span>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {setting === "other" && (
              <>
                <label>
                  <span>Actual setting</span>

                  <input
                    value={otherValue}
                    onChange={(event) =>
                      setOtherValue(event.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  <span>Why Inside/Outside does not fit</span>

                  <input
                    value={otherReason}
                    onChange={(event) =>
                      setOtherReason(event.target.value)
                    }
                    required
                  />
                </label>
              </>
            )}
          </div>

          <div className="admin-create-actions">
            <button
              className="member-cancel-button"
              type="button"
              onClick={() => {
                resetForm();
                setError("");
              }}
            >
              Cancel
            </button>

            <button
              className="admin-primary-button"
              type="submit"
              disabled={saving}
            >
              {saving
                ? editingId
                  ? "Saving…"
                  : "Creating…"
                : editingId
                  ? "Save Changes"
                  : "Create Activity"}
            </button>
          </div>
        </form>
      )}

      {!error && activities.length === 0 && !creating && (
        <div className="admin-dependency-empty">
          <strong>No activities yet.</strong>
          <span>
            Create the activity catalog before scheduling
            activities inside events.
          </span>

          <button
            className="admin-primary-button"
            type="button"
            onClick={() => setCreating(true)}
          >
            + Create First Activity
          </button>
        </div>
      )}

      <div className="admin-activity-list">
        {activities.map((activity) => (
          <article
            className="admin-activity-card"
            key={activity.id}
          >
            <div className="admin-event-card-top">
              <div>
                <div className="admin-event-type">
                  {activity.area_name} · {settingLabel(activity.setting)}
                </div>

                <div className="admin-event-name">
                  {activity.name}
                </div>

                {activityQualifications.some(
                  (row) =>
                    String(row.activity_id) ===
                    String(activity.id),
                ) && (
                  <div className="admin-event-type">
                    Requires:{" "}
                    {activityQualifications
                      .filter(
                        (row) =>
                          String(row.activity_id) ===
                          String(activity.id),
                      )
                      .map(
                        (row) =>
                          row.qualification_name,
                      )
                      .join(", ")}
                  </div>
                )}
              </div>

              <div className="admin-event-actions">
                <button
                  className="admin-edit-button"
                  type="button"
                  disabled={loadingEditId === activity.id}
                  onClick={() => void beginEdit(activity)}
                >
                  {loadingEditId === activity.id
                    ? "Loading…"
                    : "Edit"}
                </button>

                <button
                  className="admin-delete-button"
                  type="button"
                  onClick={() => {
                    setError("");
                    setDeleteConfirmId(activity.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {deleteConfirmId === activity.id && (
              <div className="admin-delete-confirm">
                <span>Delete this activity?</span>

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
                    disabled={deletingId === activity.id}
                    onClick={() =>
                      void handleDelete(activity.id)
                    }
                  >
                    {deletingId === activity.id
                      ? "Deleting…"
                      : "Delete Activity"}
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
