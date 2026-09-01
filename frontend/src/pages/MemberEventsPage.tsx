import { useEffect, useState } from "react";
import type { Event } from "@matapon/shared/schemas/events";
import type { EventActivity } from "@matapon/shared/schemas/eventActivities";
import type { EventActivitySignup } from "@matapon/shared/schemas/eventActivitySignups";
import type { EventRegistration } from "@matapon/shared/schemas/eventRegistrations";
import type { MemberAttendee } from "@matapon/shared/schemas/memberAttendees";
import type { UserMember } from "@matapon/shared/schemas/users";

import { getEvents } from "../api/events";
import { getEventActivities } from "../api/eventActivities";
import { getMyEventRegistrations } from "../api/eventRegistrations";
import {
  addActivitySignup,
  getActivitySignups,
  removeActivitySignup,
} from "../api/eventActivitySignups";
import {
  addEventAttendee,
  getMyEventAttendance,
  removeEventAttendee,
} from "../api/memberAttendees";
import { getMyHousehold } from "../api/userMembers";
import { MataponiLoader } from "../components/feedback/MataponiLoader";

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MemberEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] =
    useState<EventRegistration[]>([]);
  const [members, setMembers] = useState<UserMember[]>([]);
  const [attendance, setAttendance] =
    useState<MemberAttendee[]>([]);
  const [activities, setActivities] =
    useState<EventActivity[]>([]);
  const [signups, setSignups] =
    useState<EventActivitySignup[]>([]);

  const [openEventId, setOpenEventId] =
    useState<string | null>(null);
  const [busyKey, setBusyKey] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      getEvents(),
      getMyEventRegistrations(),
      getMyHousehold(),
      getMyEventAttendance(),
      getEventActivities(),
      getActivitySignups(),
    ])
      .then(
        ([
          eventRows,
          registrationRows,
          householdRows,
          attendanceRows,
          activityRows,
          signupRows,
        ]) => {
          if (!active) return;

          setEvents(eventRows);
          setRegistrations(registrationRows);
          setMembers(householdRows);
          setAttendance(attendanceRows);
          setActivities(activityRows);
          setSignups(signupRows);
        }
      )
      .catch((err) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not load events"
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

  function findAttendance(
    eventId: string,
    memberId: string
  ) {
    return attendance.find(
      (row) =>
        String(row.event_id) === String(eventId) &&
        String(row.member_id) === String(memberId)
    );
  }

  function findSignup(
    eventActivityId: string,
    memberAttendeeId: string
  ) {
    return signups.find(
      (row) =>
        String(row.event_activity_id) ===
          String(eventActivityId) &&
        String(row.member_attendee_id) ===
          String(memberAttendeeId)
    );
  }

  async function toggleAttendance(
    eventId: string,
    member: UserMember
  ) {
    const existing =
      findAttendance(eventId, member.id);
    const key =
      `attendance:${eventId}:${member.id}`;

    setError("");
    setBusyKey(key);

    try {
      if (existing) {
        await removeEventAttendee(existing.id);
        setAttendance((current) =>
          current.filter(
            (row) => row.id !== existing.id
          )
        );
      } else {
        const created = await addEventAttendee({
          member_id: Number(member.id),
          event_id: Number(eventId),
        });

        setAttendance((current) => [
          ...current,
          created,
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update event attendance"
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleActivitySignup(
    eventActivityId: string,
    attendee: MemberAttendee
  ) {
    const key =
      `signup:${eventActivityId}:${attendee.id}`;
    const existing =
      findSignup(eventActivityId, attendee.id);

    setError("");
    setBusyKey(key);

    try {
      if (existing) {
        await removeActivitySignup(existing.id);

        setSignups((current) =>
          current.filter(
            (row) => row.id !== existing.id
          )
        );
      } else {
        const created = await addActivitySignup({
          event_activity_id: Number(
            eventActivityId
          ),
          member_attendee_id: Number(
            attendee.id
          ),
        });

        setSignups((current) => [
          ...current,
          created,
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update activity signup"
      );
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <MataponiLoader />;
  }

  return (
    <section>
      <div className="member-home-heading">
        <div className="member-home-kicker">
          Camp
        </div>
        <h1>Events</h1>
      </div>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {!error && events.length === 0 && (
        <p className="member-empty">
          No registered events yet.
        </p>
      )}

      <div className="member-event-list">
        {events.map((event) => {
          const registration =
            registrations.find(
              (row) =>
                String(row.event_id) ===
                String(event.id)
            );

          if (!registration) {
            return null;
          }

          const isOpen =
            openEventId === event.id;

          const eventAttendance =
            attendance.filter(
              (row) =>
                String(row.event_id) ===
                String(event.id)
            );

          const eventActivities =
            activities.filter(
              (row) =>
                String(row.event_id) ===
                String(event.id)
            );

          const spots =
            Number(
              registration.spots_paid_for
            );
          const selected =
            eventAttendance.length;
          const full =
            selected >= spots;

          return (
            <article
              className="member-event"
              key={event.id}
            >
              <button
                className="member-event-summary"
                type="button"
                onClick={() =>
                  setOpenEventId(
                    isOpen ? null : event.id
                  )
                }
              >
                <div>
                  <div className="member-event-type">
                    {event.event_type_name}
                  </div>

                  <div className="member-event-name">
                    {event.name}
                  </div>

                  <div className="member-event-time">
                    {formatEventDate(
                      event.starts_at
                    )}
                    <span> · </span>
                    {formatTime(
                      event.starts_at
                    )}
                    <span>–</span>
                    {formatTime(
                      event.ends_at
                    )}
                  </div>

                  <div className="member-event-attending-summary">
                    {selected} of {spots} spots selected
                  </div>
                </div>

                <span className="member-event-chevron">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="member-event-details">
                  <div className="member-event-family">
                    <div className="member-event-family-title">
                      Who’s going?
                    </div>

                    {members.map((member) => {
                      const attendee =
                        findAttendance(
                          event.id,
                          member.id
                        );
                      const active =
                        Boolean(attendee);
                      const key =
                        `attendance:${event.id}:${member.id}`;
                      const busy =
                        busyKey === key;
                      const disabled =
                        busy ||
                        (!active && full);

                      return (
                        <button
                          className={
                            active
                              ? "member-attendee active"
                              : "member-attendee"
                          }
                          type="button"
                          key={member.id}
                          disabled={disabled}
                          onClick={() =>
                            void toggleAttendance(
                              event.id,
                              member
                            )
                          }
                        >
                          <span>
                            {member.full_name}
                          </span>

                          <span className="member-attendee-state">
                            {busy
                              ? "…"
                              : active
                                ? "Going"
                                : full
                                  ? "No spot available"
                                  : "Not going"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="member-event-activities">
                    <div className="member-event-section-title">
                      Activities
                    </div>

                    {eventActivities.length ===
                      0 && (
                      <div className="member-event-no-activities">
                        No activities scheduled yet.
                      </div>
                    )}

                    {eventActivities.map(
                      (activity) => (
                        <div
                          className="member-activity"
                          key={activity.id}
                        >
                          <div className="member-activity-heading">
                            <div>
                              <div className="member-activity-name">
                                {
                                  activity.activity_name
                                }
                              </div>

                              <div className="member-activity-time">
                                {formatTime(
                                  activity.starts_at
                                )}
                                <span>–</span>
                                {formatTime(
                                  activity.ends_at
                                )}
                              </div>
                            </div>
                          </div>

                          {eventAttendance.length ===
                          0 ? (
                            <div className="member-activity-empty">
                              Select who is going first.
                            </div>
                          ) : (
                            <div className="member-activity-people">
                              {eventAttendance.map(
                                (attendee) => {
                                  const signup =
                                    findSignup(
                                      activity.id,
                                      attendee.id
                                    );

                                  const key =
                                    `signup:${activity.id}:${attendee.id}`;

                                  const busy =
                                    busyKey === key;

                                  return (
                                    <button
                                      className={
                                        signup
                                          ? "member-activity-person active"
                                          : "member-activity-person"
                                      }
                                      type="button"
                                      key={
                                        attendee.id
                                      }
                                      disabled={
                                        busy
                                      }
                                      onClick={() =>
                                        void toggleActivitySignup(
                                          activity.id,
                                          attendee
                                        )
                                      }
                                    >
                                      <span>
                                        {
                                          attendee.member_name
                                        }
                                      </span>

                                      <span>
                                        {busy
                                          ? "…"
                                          : signup
                                            ? "Signed up"
                                            : "Add"}
                                      </span>
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
