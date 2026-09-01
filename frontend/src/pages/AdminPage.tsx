import {
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Activity } from "@matapon/shared/schemas/activities";
import type { EventActivity } from "@matapon/shared/schemas/eventActivities";
import type { EventActivityStaff } from "@matapon/shared/schemas/eventActivityStaff";
import type { EventActivitySignup } from "@matapon/shared/schemas/eventActivitySignups";
import type { StaffMember } from "@matapon/shared/schemas/staffMembers";
import type { Event } from "@matapon/shared/schemas/events";
import type { EventType } from "@matapon/shared/schemas/eventTypes";
import type {
  EventMeal,
  MealType,
} from "@matapon/shared/schemas/meals";
import type {
  ActivityQualification,
  StaffQualification,
} from "@matapon/shared/schemas/qualifications";
import {
  createEvent,
  deleteEvent,
  getEvents,
  updateEvent,
} from "../api/events";
import { getActivities } from "../api/activities";
import {
  createEventActivity,
  getEventActivities,
} from "../api/eventActivities";
import {
  assignEventActivityStaff,
  getEventActivityStaff,
  removeEventActivityStaff,
} from "../api/eventActivityStaff";
import { getStaffMembers } from "../api/staff";
import { getActivityQualifications } from "../api/activityQualifications";
import { getStaffQualifications } from "../api/staffQualifications";
import {
  checkInActivitySignup,
  getActivitySignups,
  undoActivitySignupCheckIn,
} from "../api/eventActivitySignups";
import {
  createEventMeal,
  getEventMeals,
  getMealTypes,
} from "../api/meals";
import { getEventTypes } from "../api/eventTypes";
import { MataponiLoader } from "../components/feedback/MataponiLoader";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatEventRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${formatDate(startsAt)} · ${formatTime(startsAt)}–${formatTime(endsAt)}`;
  }

  return `${formatDate(startsAt)} · ${formatTime(startsAt)} → ${formatDate(endsAt)} · ${formatTime(endsAt)}`;
}

function parseTimeInput(raw: string): string | null {
  let value = raw.trim().toLowerCase().replace(/\s+/g, "");

  if (!value) return null;

  let period: "am" | "pm" | null = null;

  if (value.endsWith("am")) {
    period = "am";
    value = value.slice(0, -2);
  } else if (value.endsWith("pm")) {
    period = "pm";
    value = value.slice(0, -2);
  } else if (value.endsWith("a")) {
    period = "am";
    value = value.slice(0, -1);
  } else if (value.endsWith("p")) {
    period = "pm";
    value = value.slice(0, -1);
  }

  let hour: number;
  let minute: number;

  if (/^\d{1,2}$/.test(value)) {
    hour = Number(value);
    minute = 0;
  } else if (/^\d{3,4}$/.test(value)) {
    hour = Number(value.slice(0, -2));
    minute = Number(value.slice(-2));
  } else {
    const match = value.match(/^(\d{1,2}):(\d{1,2})$/);

    if (!match) return null;

    hour = Number(match[1]);
    minute = Number(match[2]);
  }

  if (minute < 0 || minute > 59) return null;

  if (period) {
    if (hour < 1 || hour > 12) return null;

    if (period === "am") {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return (
    `${String(hour).padStart(2, "0")}:` +
    `${String(minute).padStart(2, "0")}`
  );
}

function formatTimeInput(value: string): string {
  const parsed = parseTimeInput(value);

  if (!parsed) return value;

  const [hourText, minute] = parsed.split(":");
  const hour24 = Number(hourText);
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute} ${period}`;
}

function addMinutes(value: string, amount: number): string {
  const parsed = parseTimeInput(value);

  if (!parsed) return value;

  const [hourText, minuteText] = parsed.split(":");

  let total =
    Number(hourText) * 60 +
    Number(minuteText) +
    amount;

  total = ((total % 1440) + 1440) % 1440;

  const hour = Math.floor(total / 60);
  const minute = total % 60;

  return (
    `${String(hour).padStart(2, "0")}:` +
    `${String(minute).padStart(2, "0")}`
  );
}

type ScheduleDay = {
  key: string;
  label: string;
  activities: EventActivity[];
};

function eventSchedule(
  rows: EventActivity[],
  eventId: string,
): ScheduleDay[] {
  const scheduled = rows
    .filter(
      (row) => String(row.event_id) === String(eventId),
    )
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() -
        new Date(b.starts_at).getTime(),
    );

  const days = new Map<string, EventActivity[]>();

  for (const activity of scheduled) {
    const date = new Date(activity.starts_at);

    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    const existing = days.get(key) ?? [];
    existing.push(activity);
    days.set(key, existing);
  }

  return Array.from(days.entries()).map(
    ([key, activities]) => ({
      key,
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(activities[0].starts_at)),
      activities,
    }),
  );
}

const CALENDAR_START_HOUR = 7;
const CALENDAR_END_HOUR = 23;
const CALENDAR_HOUR_HEIGHT = 64;

const CALENDAR_HOURS = Array.from(
  {
    length:
      CALENDAR_END_HOUR - CALENDAR_START_HOUR,
  },
  (_, index) => CALENDAR_START_HOUR + index,
);

function localDateKey(value: string | Date) {
  const date =
    typeof value === "string"
      ? new Date(value)
      : value;

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localDateTimeValue(date: Date) {
  return (
    `${localDateKey(date)}T` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}`
  );
}

function calendarDays(
  startsAt: string,
  endsAt: string,
) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );

  const last = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );

  const rows: Array<{
    key: string;
    label: string;
  }> = [];

  while (cursor <= last) {
    rows.push({
      key: localDateKey(cursor),
      label: new Intl.DateTimeFormat(
        "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
        },
      ).format(cursor),
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

function minutesIntoDay(value: string) {
  const date = new Date(value);

  return (
    date.getHours() * 60 +
    date.getMinutes()
  );
}

function formatCalendarHour(hour: number) {
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 || 12;

  return `${hour12} ${period}`;
}

type CalendarPlacement = {
  activity: EventActivity;
  lane: number;
  laneCount: number;
};

function layoutCalendarActivities(
  rows: EventActivity[],
): CalendarPlacement[] {
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(a.starts_at).getTime() -
      new Date(b.starts_at).getTime(),
  );

  const groups: EventActivity[][] = [];
  let group: EventActivity[] = [];
  let groupEnd = -Infinity;

  for (const row of sorted) {
    const start =
      new Date(row.starts_at).getTime();

    const end =
      new Date(row.ends_at).getTime();

    if (
      group.length === 0 ||
      start < groupEnd
    ) {
      group.push(row);
      groupEnd = Math.max(groupEnd, end);
    } else {
      groups.push(group);
      group = [row];
      groupEnd = end;
    }
  }

  if (group.length > 0) {
    groups.push(group);
  }

  return groups.flatMap((rowsInGroup) => {
    const laneEnds: number[] = [];
    const placed: Array<{
      activity: EventActivity;
      lane: number;
    }> = [];

    for (const activity of rowsInGroup) {
      const start =
        new Date(activity.starts_at).getTime();

      const end =
        new Date(activity.ends_at).getTime();

      let lane = laneEnds.findIndex(
        (laneEnd) => laneEnd <= start,
      );

      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }

      placed.push({
        activity,
        lane,
      });
    }

    const laneCount = Math.max(
      laneEnds.length,
      1,
    );

    return placed.map((row) => ({
      ...row,
      laneCount,
    }));
  });
}

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [eventActivities, setEventActivities] =
    useState<EventActivity[]>([]);
  const [activityStaff, setActivityStaff] =
    useState<EventActivityStaff[]>([]);
  const [staffMembers, setStaffMembers] =
    useState<StaffMember[]>([]);
  const [activityQualifications, setActivityQualifications] =
    useState<ActivityQualification[]>([]);
  const [staffQualifications, setStaffQualifications] =
    useState<StaffQualification[]>([]);
  const [activitySignups, setActivitySignups] =
    useState<EventActivitySignup[]>([]);
  const [eventMeals, setEventMeals] =
    useState<EventMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [changingCheckInId, setChangingCheckInId] =
    useState<string | null>(null);
  const [changingStaffKey, setChangingStaffKey] =
    useState<string | null>(null);
  const [dragOverActivityId, setDragOverActivityId] =
    useState<string | null>(null);
  const [dragOverCalendarSlot, setDragOverCalendarSlot] =
    useState<string | null>(null);
  const [mealTypes, setMealTypes] =
    useState<MealType[]>([]);
  const [selectedCalendarActivityId, setSelectedCalendarActivityId] =
    useState<string | null>(null);
  const [scheduleEventId, setScheduleEventId] =
    useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const [scheduledActivityId, setScheduledActivityId] = useState("");
  const [activityStartDate, setActivityStartDate] = useState("");
  const [activityStartTime, setActivityStartTime] = useState("");
  const [activityEndDate, setActivityEndDate] = useState("");
  const [activityEndTime, setActivityEndTime] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  const requestedEventId = searchParams.get("event");

  const selectedEventId =
    requestedEventId &&
    events.some((event) => event.id === requestedEventId)
      ? requestedEventId
      : events[0]?.id ?? null;

  const [name, setName] = useState("");
  const [eventTypeId, setEventTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [otherValue, setOtherValue] = useState("");
  const [otherReason, setOtherReason] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      getEvents(),
      getEventTypes(),
      getActivities(),
      getEventActivities(),
      getEventActivityStaff(),
      getStaffMembers(),
      getActivityQualifications(),
      getStaffQualifications(),
      getActivitySignups(),
      getEventMeals(),
      getMealTypes(),
    ])
      .then(([
        eventRows,
        typeRows,
        activityRows,
        scheduledRows,
        staffRows,
        staffMemberRows,
        activityQualificationRows,
        staffQualificationRows,
        signupRows,
        mealRows,
        mealTypeRows,
      ]) => {
        if (!active) return;

        setEvents(eventRows);
        setEventTypes(typeRows);
        setActivities(activityRows);
        setEventActivities(scheduledRows);
        setActivityStaff(staffRows);
        setStaffMembers(staffMemberRows);
        setActivityQualifications(activityQualificationRows);
        setStaffQualifications(staffQualificationRows);
        setActivitySignups(signupRows);
        setEventMeals(mealRows);
        setMealTypes(mealTypeRows);

        if (typeRows[0]) {
          setEventTypeId(typeRows[0].id);
        }

        if (activityRows[0]) {
          setScheduledActivityId(activityRows[0].id);
        }
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not load admin events",
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

  const selectedEventType = eventTypes.find(
    (type) => String(type.id) === String(eventTypeId),
  );

  const isOther =
    selectedEventType?.name.trim().toLowerCase() === "other";

  function localDate(value: string) {
    const date = new Date(value);

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function localTime(value: string) {
    const date = new Date(value);

    const time =
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0");

    return formatTimeInput(time);
  }

  function beginEdit(event: Event) {
    setError("");
    setCreating(false);
    setEditingId(event.id);

    setName(event.name);
    setEventTypeId(event.event_type_id);
    setStartDate(localDate(event.starts_at));
    setStartTime(localTime(event.starts_at));
    setEndDate(localDate(event.ends_at));
    setEndTime(localTime(event.ends_at));

    setOtherValue("");
    setOtherReason("");
  }

  function selectEvent(id: string) {
    const next = new URLSearchParams(searchParams);

    next.set("event", id);
    setSearchParams(next);

    setDeleteConfirmId(null);
    resetScheduleForm();
  }

  function resetScheduleForm() {
    setScheduleEventId(null);
    setScheduledActivityId(activities[0]?.id ?? "");
    setActivityStartDate("");
    setActivityStartTime("");
    setActivityEndDate("");
    setActivityEndTime("");
  }

  function beginSchedule(event: Event) {
    const initialStartTime = localTime(event.starts_at);

    setError("");
    setScheduleEventId(event.id);
    setScheduledActivityId(activities[0]?.id ?? "");
    setActivityStartDate(localDate(event.starts_at));
    setActivityStartTime(initialStartTime);
    setActivityEndDate(localDate(event.starts_at));
    setActivityEndTime(
      formatTimeInput(addMinutes(initialStartTime, 60)),
    );
  }

  function resetForm() {
    setName("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setOtherValue("");
    setOtherReason("");

    if (eventTypes[0]) {
      setEventTypeId(eventTypes[0].id);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!eventTypeId) {
      setError("Choose an event type");
      return;
    }

    const parsedStartTime = parseTimeInput(startTime);
    const parsedEndTime = parseTimeInput(endTime);

    if (!parsedStartTime || !parsedEndTime) {
      setError("Enter a valid start and end time");
      return;
    }

    const startsAt = `${startDate}T${parsedStartTime}`;
    const endsAt = `${endDate}T${parsedEndTime}`;

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("End time must be after start time");
      return;
    }

    setSaving(true);

    try {
      const created = await createEvent({
        name: name.trim(),
        event_type_id: Number(eventTypeId),
        starts_at: startsAt,
        ends_at: endsAt,
        ...(isOther
          ? {
              other_value: otherValue.trim(),
              other_reason: otherReason.trim(),
            }
          : {}),
      });

      setEvents((current) => [created, ...current]);
      selectEvent(created.id);
      resetForm();
      setCreating(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create event",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId || !eventTypeId) {
      return;
    }

    setError("");

    const parsedStartTime = parseTimeInput(startTime);
    const parsedEndTime = parseTimeInput(endTime);

    if (!parsedStartTime || !parsedEndTime) {
      setError("Enter a valid start and end time");
      return;
    }

    const startsAt = `${startDate}T${parsedStartTime}`;
    const endsAt = `${endDate}T${parsedEndTime}`;

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("End time must be after start time");
      return;
    }

    setSaving(true);

    try {
      const updated = await updateEvent(editingId, {
        name: name.trim(),
        event_type_id: Number(eventTypeId),
        starts_at: startsAt,
        ends_at: endsAt,
        ...(isOther
          ? {
              other_value: otherValue.trim(),
              other_reason: otherReason.trim(),
            }
          : {}),
      });

      setEvents((current) =>
        current.map((row) =>
          row.id === updated.id ? updated : row,
        ),
      );

      setEditingId(null);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update event",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStaff(
    eventActivity: EventActivity,
    staffMember: StaffMember,
  ) {
    const key =
      `${eventActivity.id}:${staffMember.id}`;

    setError("");
    setChangingStaffKey(key);

    const existing = activityStaff.find(
      (row) =>
        String(row.event_activity_id) ===
          String(eventActivity.id) &&
        String(row.staff_member_id) ===
          String(staffMember.id),
    );

    try {
      if (existing) {
        await removeEventActivityStaff(existing.id);

        setActivityStaff((current) =>
          current.filter(
            (row) => row.id !== existing.id,
          ),
        );
      } else {
        const created =
          await assignEventActivityStaff({
            event_activity_id: Number(
              eventActivity.id,
            ),
            staff_member_id: Number(
              staffMember.id,
            ),
          });

        setActivityStaff((current) => [
          ...current,
          created,
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not change staff assignment",
      );
    } finally {
      setChangingStaffKey(null);
    }
  }

  async function handleDropStaff(
    event: DragEvent<HTMLDivElement>,
    eventActivity: EventActivity,
  ) {
    event.preventDefault();
    setDragOverActivityId(null);

    const staffMemberId =
      event.dataTransfer.getData("text/plain");

    const staffMember = staffMembers.find(
      (member) =>
        String(member.id) === String(staffMemberId),
    );

    if (!staffMember) return;

    const alreadyAssigned = activityStaff.some(
      (row) =>
        String(row.event_activity_id) ===
          String(eventActivity.id) &&
        String(row.staff_member_id) ===
          String(staffMember.id),
    );

    if (alreadyAssigned) return;

    await handleToggleStaff(
      eventActivity,
      staffMember,
    );
  }

  async function handleDropMealOnCalendar(
    dragEvent: DragEvent<HTMLDivElement>,
    campEvent: Event,
    dayKey: string,
    hour: number,
  ) {
    dragEvent.preventDefault();
    dragEvent.stopPropagation();

    const mealTypeId =
      dragEvent.dataTransfer.getData(
        "application/x-matapon-meal",
      );

    if (!mealTypeId) return;

    const start = new Date(
      `${dayKey}T${String(hour).padStart(2, "0")}:00`,
    );

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    if (
      start < new Date(campEvent.starts_at) ||
      end > new Date(campEvent.ends_at)
    ) {
      setError("That hour is outside this event.");
      setDragOverCalendarSlot(null);
      return;
    }

    setError("");
    setScheduling(true);
    setDragOverCalendarSlot(null);

    try {
      const created = await createEventMeal({
        event_id: Number(campEvent.id),
        meal_type_id: Number(mealTypeId),
        starts_at: localDateTimeValue(start),
        ends_at: localDateTimeValue(end),
      });

      setEventMeals((current) =>
        [...current, created].sort(
          (a, b) =>
            new Date(a.starts_at).getTime() -
            new Date(b.starts_at).getTime(),
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not schedule meal",
      );
    } finally {
      setScheduling(false);
    }
  }

  async function handleDropActivityOnCalendar(
    dragEvent: DragEvent<HTMLDivElement>,
    campEvent: Event,
    dayKey: string,
    hour: number,
  ) {
    dragEvent.preventDefault();
    dragEvent.stopPropagation();

    const slotKey = `${dayKey}:${hour}`;
    setDragOverCalendarSlot(null);

    const activityId =
      dragEvent.dataTransfer.getData(
        "application/x-matapon-activity",
      );

    if (!activityId) return;

    const start = new Date(
      `${dayKey}T${String(hour).padStart(2, "0")}:00`,
    );

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    const eventStart =
      new Date(campEvent.starts_at);

    const eventEnd =
      new Date(campEvent.ends_at);

    if (
      start < eventStart ||
      end > eventEnd
    ) {
      setError(
        "That hour is outside this event.",
      );
      return;
    }

    setError("");
    setScheduling(true);
    setDragOverCalendarSlot(slotKey);

    try {
      const created =
        await createEventActivity({
          event_id: Number(campEvent.id),
          activity_id: Number(activityId),
          starts_at:
            localDateTimeValue(start),
          ends_at:
            localDateTimeValue(end),
        });

      setEventActivities((current) =>
        [...current, created].sort(
          (a, b) =>
            new Date(a.starts_at).getTime() -
            new Date(b.starts_at).getTime(),
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not schedule activity",
      );
    } finally {
      setScheduling(false);
      setDragOverCalendarSlot(null);
    }
  }

  async function handleToggleCheckIn(
    signup: EventActivitySignup,
  ) {
    setError("");
    setChangingCheckInId(signup.id);

    try {
      const updated = signup.checked_in_at
        ? await undoActivitySignupCheckIn(signup.id)
        : await checkInActivitySignup(signup.id);

      setActivitySignups((current) =>
        current.map((row) =>
          row.id === updated.id ? updated : row,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not change check-in",
      );
    } finally {
      setChangingCheckInId(null);
    }
  }

  async function handleScheduleActivity(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!scheduleEventId || !scheduledActivityId) {
      return;
    }

    const parsedStartTime = parseTimeInput(activityStartTime);
    const parsedEndTime = parseTimeInput(activityEndTime);

    if (!parsedStartTime || !parsedEndTime) {
      setError("Enter a valid activity start and end time");
      return;
    }

    const startsAt =
      `${activityStartDate}T${parsedStartTime}`;

    const endsAt =
      `${activityEndDate}T${parsedEndTime}`;

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("Activity end time must be after start time");
      return;
    }

    setError("");
    setScheduling(true);

    try {
      const created = await createEventActivity({
        event_id: Number(scheduleEventId),
        activity_id: Number(scheduledActivityId),
        starts_at: startsAt,
        ends_at: endsAt,
      });

      setEventActivities((current) =>
        [...current, created].sort(
          (a, b) =>
            new Date(a.starts_at).getTime() -
            new Date(b.starts_at).getTime(),
        ),
      );

      resetScheduleForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not schedule activity",
      );
    } finally {
      setScheduling(false);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    setDeletingId(id);

    try {
      await deleteEvent(id);

      const remainingEvents =
        events.filter((event) => event.id !== id);

      setEvents(remainingEvents);

      if (selectedEventId === id) {
        const next = new URLSearchParams(searchParams);

        if (remainingEvents[0]) {
          next.set("event", remainingEvents[0].id);
        } else {
          next.delete("event");
        }

        setSearchParams(next);
      }

      if (editingId === id) {
        setEditingId(null);
        resetForm();
      }

      setDeleteConfirmId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete event",
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
          <h1>Events</h1>
        </div>

        <div className="admin-heading-actions">
          <div className="admin-record-count">
            {events.length} {events.length === 1 ? "event" : "events"}
          </div>

          {!creating && (
            <button
              className="admin-primary-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              + Create Event
            </button>
          )}
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      {(creating || editingId) && (
        <form
          className="admin-create-form"
          onSubmit={editingId ? handleUpdate : handleCreate}
        >
          <div className="admin-create-title">
            {editingId ? "Edit event" : "Create event"}
          </div>

          <div className="admin-form-grid">
            <label>
              <span>Event type</span>
              <select
                value={eventTypeId}
                onChange={(event) =>
                  setEventTypeId(event.target.value)
                }
                required
              >
                {eventTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Name</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            <label>
              <span>Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);

                  if (!endDate) {
                    setEndDate(event.target.value);
                  }
                }}
                required
              />
            </label>

            <label>
              <span>Start time</span>
              <input
                type="text"
                value={startTime}
                placeholder="5:00 PM"
                autoComplete="off"
                onChange={(event) => setStartTime(event.target.value)}
                onBlur={() => {
                  const parsed = parseTimeInput(startTime);

                  if (!parsed) return;

                  setStartTime(formatTimeInput(parsed));

                  if (!endTime) {
                    setEndTime(
                      formatTimeInput(addMinutes(parsed, 60)),
                    );
                  }
                }}
                required
              />
            </label>

            <label>
              <span>End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </label>

            <label>
              <span>End time</span>
              <input
                type="text"
                value={endTime}
                placeholder="6:00 PM"
                autoComplete="off"
                onChange={(event) => setEndTime(event.target.value)}
                onBlur={() => {
                  const parsed = parseTimeInput(endTime);

                  if (parsed) {
                    setEndTime(formatTimeInput(parsed));
                  }
                }}
                required
              />
            </label>

            {isOther && (
              <>
                <label>
                  <span>Other event type</span>
                  <input
                    value={otherValue}
                    onChange={(event) =>
                      setOtherValue(event.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  <span>Why existing types do not fit</span>
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
                setCreating(false);
                setEditingId(null);
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
                  : "Create Event"}
            </button>
          </div>
        </form>
      )}

      {!error && events.length === 0 && !creating && (
        <p className="member-empty">No events yet.</p>
      )}

      <div className="admin-events-workspace">
        <div className="admin-event-selector">
          {events.map((event) => (
            <button
              className={
                selectedEventId === event.id
                  ? "admin-event-select-tile active"
                  : "admin-event-select-tile"
              }
              type="button"
              key={event.id}
              onClick={() => selectEvent(event.id)}
            >
              <div className="admin-event-type">
                {event.event_type_name}
              </div>

              <div className="admin-event-name">
                {event.name}
              </div>

              <div className="admin-event-time">
                {formatEventRange(
                  event.starts_at,
                  event.ends_at,
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="admin-event-detail-pane">
          {events
            .filter((event) => event.id === selectedEventId)
            .map((event) => (
          <article
            className="admin-event-card admin-event-card-detail"
            key={event.id}
          >
            <div className="admin-event-card-top">
              <div>
                <div className="admin-event-type">
                  {event.event_type_name}
                </div>

                <div className="admin-event-name">
                  {event.name}
                </div>
              </div>

              <div className="admin-event-actions">
                <button
                  className="admin-edit-button"
                  type="button"
                  onClick={() => {
                    setDeleteConfirmId(null);
                    resetScheduleForm();
                    beginEdit(event);
                  }}
                >
                  Edit
                </button>

                <button
                  className="admin-delete-button"
                  type="button"
                  onClick={() => {
                    setError("");
                    setDeleteConfirmId(event.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="admin-event-time">
              {formatEventRange(event.starts_at, event.ends_at)}
            </div>

            {selectedEventId === event.id && (
              <div className="admin-event-activity-panel">
                {(() => {
                  const schedule = eventSchedule(
                    eventActivities,
                    event.id,
                  );

                  const scheduledCount = schedule.reduce(
                    (total, day) =>
                      total + day.activities.length,
                    0,
                  );

                  return (
                    <>
                      <div className="admin-ops-calendar-shell">
                        <div className="admin-ops-calendar-toolbar">
                          <div>
                            <strong>Calendar</strong>
                            <span>
                              {scheduledCount} scheduled
                            </span>
                          </div>

                          <div className="admin-ops-calendar-legend">
                            <span>Drag to schedule</span>
                            <span>Drag staff onto blocks</span>
                          </div>
                        </div>

                        <div className="admin-ops-trays">
                          <div className="admin-ops-tray">
                            <div className="admin-ops-tray-label">
                              Activities
                            </div>

                            <div className="admin-ops-tray-items">
                              {activities.map((activity) => (
                                <div
                                  className="admin-ops-drag-chip"
                                  draggable
                                  key={activity.id}
                                  onDragStart={(dragEvent) => {
                                    dragEvent.dataTransfer.effectAllowed =
                                      "copy";

                                    dragEvent.dataTransfer.setData(
                                      "application/x-matapon-activity",
                                      String(activity.id),
                                    );
                                  }}
                                >
                                  {activity.name}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="admin-ops-tray">
                            <div className="admin-ops-tray-label">
                              Meals
                            </div>

                            <div className="admin-ops-tray-items">
                              {mealTypes.map((meal) => (
                                <div
                                  className="admin-ops-drag-chip"
                                  draggable
                                  key={meal.id}
                                  onDragStart={(dragEvent) => {
                                    dragEvent.dataTransfer.effectAllowed =
                                      "copy";

                                    dragEvent.dataTransfer.setData(
                                      "application/x-matapon-meal",
                                      String(meal.id),
                                    );
                                  }}
                                >
                                  {meal.name}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="admin-ops-tray">
                            <div className="admin-ops-tray-label">
                              Staff
                            </div>

                            <div className="admin-ops-tray-items">
                              {staffMembers.map((member) => (
                                <div
                                  className="admin-ops-drag-chip staff"
                                  draggable
                                  key={member.id}
                                  onDragStart={(dragEvent) => {
                                    dragEvent.dataTransfer.effectAllowed =
                                      "copy";

                                    dragEvent.dataTransfer.setData(
                                      "text/plain",
                                      String(member.id),
                                    );
                                  }}
                                  onDragEnd={() =>
                                    setDragOverActivityId(null)
                                  }
                                >
                                  {member.full_name}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {selectedCalendarActivityId &&
                          (() => {
                            const selected =
                              eventActivities.find(
                                (row) =>
                                  String(row.id) ===
                                    String(
                                      selectedCalendarActivityId,
                                    ) &&
                                  String(row.event_id) ===
                                    String(event.id),
                              );

                            if (!selected) return null;

                            const selectedStaff =
                              activityStaff.filter(
                                (row) =>
                                  String(
                                    row.event_activity_id,
                                  ) ===
                                  String(selected.id),
                              );

                            const selectedSignups =
                              activitySignups.filter(
                                (row) =>
                                  String(
                                    row.event_activity_id,
                                  ) ===
                                  String(selected.id),
                              );

                            const selectedRequirements =
                              activityQualifications.filter(
                                (row) =>
                                  String(row.activity_id) ===
                                  String(selected.activity_id),
                              );

                            const missingRequirements =
                              selectedRequirements.filter(
                                (requirement) =>
                                  !selectedStaff.some(
                                    (assignment) =>
                                      staffQualifications.some(
                                        (staffQualification) =>
                                          String(
                                            staffQualification.staff_member_id,
                                          ) ===
                                            String(
                                              assignment.staff_member_id,
                                            ) &&
                                          String(
                                            staffQualification.qualification_id,
                                          ) ===
                                            String(
                                              requirement.qualification_id,
                                            ),
                                      ),
                                  ),
                              );

                            return (
                              <div className="admin-ops-inspector">
                                <div className="admin-ops-inspector-main">
                                  <div>
                                    <div className="admin-ops-inspector-name">
                                      {selected.activity_name}
                                    </div>

                                    <div className="admin-ops-inspector-time">
                                      {formatDate(selected.starts_at)}
                                      {" · "}
                                      {formatTime(selected.starts_at)}
                                      {"–"}
                                      {formatTime(selected.ends_at)}
                                    </div>
                                  </div>

                                  <button
                                    className="admin-ops-inspector-close"
                                    type="button"
                                    onClick={() =>
                                      setSelectedCalendarActivityId(
                                        null,
                                      )
                                    }
                                  >
                                    ×
                                  </button>
                                </div>

                                <div className="admin-ops-inspector-grid">
                                  <div>
                                    <div className="admin-ops-inspector-label">
                                      Staff
                                    </div>

                                    <div className="admin-ops-inspector-options">
                                      {staffMembers.map((member) => {
                                        const assigned =
                                          selectedStaff.some(
                                            (row) =>
                                              String(
                                                row.staff_member_id,
                                              ) ===
                                              String(member.id),
                                          );

                                        const key =
                                          `${selected.id}:${member.id}`;

                                        return (
                                          <button
                                            className={
                                              assigned
                                                ? "admin-ops-inspector-chip assigned"
                                                : "admin-ops-inspector-chip"
                                            }
                                            type="button"
                                            key={member.id}
                                            disabled={
                                              changingStaffKey === key
                                            }
                                            onClick={() =>
                                              void handleToggleStaff(
                                                selected,
                                                member,
                                              )
                                            }
                                          >
                                            {member.full_name}
                                            <span>
                                              {assigned
                                                ? "Assigned"
                                                : "+ Add"}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="admin-ops-inspector-label">
                                      Status
                                    </div>

                                    {selectedStaff.length === 0 && (
                                      <div className="admin-ops-need">
                                        ● Needs staff
                                      </div>
                                    )}

                                    {missingRequirements.length > 0 && (
                                      <div className="admin-ops-need">
                                        ● Needs{" "}
                                        {missingRequirements
                                          .map(
                                            (row) =>
                                              row.qualification_name,
                                          )
                                          .join(", ")}
                                      </div>
                                    )}

                                    {selectedRequirements.length > 0 &&
                                      missingRequirements.length === 0 && (
                                        <div className="admin-ops-covered">
                                          ✓ Requirements covered
                                        </div>
                                      )}

                                    <div className="admin-ops-inspector-count">
                                      {selectedSignups.length} signed up
                                      {" · "}
                                      {
                                        selectedSignups.filter(
                                          (row) =>
                                            row.checked_in_at !== null,
                                        ).length
                                      }{" "}
                                      checked in
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                        {(() => {
                          const days = calendarDays(
                            event.starts_at,
                            event.ends_at,
                          );

                          const eventStart =
                            new Date(event.starts_at);

                          const eventEnd =
                            new Date(event.ends_at);

                          return (
                            <div
                              className="admin-ops-calendar-grid"
                              style={{
                                gridTemplateColumns:
                                  `52px repeat(${days.length}, minmax(150px, 1fr))`,
                              }}
                            >
                              <div className="admin-ops-calendar-corner" />

                              {days.map((day) => (
                                <div
                                  className="admin-ops-calendar-day-head"
                                  key={day.key}
                                >
                                  {day.label}
                                </div>
                              ))}

                              <div className="admin-ops-time-column">
                                {CALENDAR_HOURS.map((hour) => (
                                  <div
                                    className="admin-ops-time-label"
                                    key={hour}
                                  >
                                    {formatCalendarHour(hour)}
                                  </div>
                                ))}
                              </div>

                              {days.map((day) => {
                                const dayActivities =
                                  eventActivities.filter(
                                    (row) =>
                                      String(row.event_id) ===
                                        String(event.id) &&
                                      localDateKey(
                                        row.starts_at,
                                      ) === day.key,
                                  );

                                const dayMeals =
                                  eventMeals.filter(
                                    (row) =>
                                      String(row.event_id) ===
                                        String(event.id) &&
                                      localDateKey(
                                        row.starts_at,
                                      ) === day.key,
                                  );

                                const placements =
                                  layoutCalendarActivities(
                                    dayActivities,
                                  );

                                return (
                                  <div
                                    className="admin-ops-day-column"
                                    key={day.key}
                                  >
                                    {CALENDAR_HOURS.map((hour) => {
                                      const slotKey =
                                        `${day.key}:${hour}`;

                                      const slotStart =
                                        new Date(
                                          `${day.key}T${String(
                                            hour,
                                          ).padStart(2, "0")}:00`,
                                        );

                                      const slotEnd =
                                        new Date(slotStart);

                                      slotEnd.setHours(
                                        slotEnd.getHours() + 1,
                                      );

                                      const enabled =
                                        slotStart >= eventStart &&
                                        slotEnd <= eventEnd;

                                      return (
                                        <div
                                          className={[
                                            "admin-ops-hour-slot",
                                            enabled
                                              ? ""
                                              : "disabled",
                                            dragOverCalendarSlot ===
                                            slotKey
                                              ? "drag-over"
                                              : "",
                                          ]
                                            .filter(Boolean)
                                            .join(" ")}
                                          key={slotKey}
                                          onDragOver={(dragEvent) => {
                                            if (!enabled) return;

                                            const activityId =
                                              dragEvent.dataTransfer.types.includes(
                                                "application/x-matapon-activity",
                                              );

                                            const mealId =
                                              dragEvent.dataTransfer.types.includes(
                                                "application/x-matapon-meal",
                                              );

                                            if (
                                              !activityId &&
                                              !mealId
                                            ) {
                                              return;
                                            }

                                            dragEvent.preventDefault();

                                            dragEvent.dataTransfer.dropEffect =
                                              "copy";

                                            setDragOverCalendarSlot(
                                              slotKey,
                                            );
                                          }}
                                          onDragLeave={() => {
                                            if (
                                              dragOverCalendarSlot ===
                                              slotKey
                                            ) {
                                              setDragOverCalendarSlot(
                                                null,
                                              );
                                            }
                                          }}
                                          onDrop={(dragEvent) => {
                                            if (!enabled) return;

                                            const activityId =
                                              dragEvent.dataTransfer.getData(
                                                "application/x-matapon-activity",
                                              );

                                            const mealId =
                                              dragEvent.dataTransfer.getData(
                                                "application/x-matapon-meal",
                                              );

                                            if (mealId) {
                                              void handleDropMealOnCalendar(
                                                dragEvent,
                                                event,
                                                day.key,
                                                hour,
                                              );
                                              return;
                                            }

                                            if (activityId) {
                                              void handleDropActivityOnCalendar(
                                                dragEvent,
                                                event,
                                                day.key,
                                                hour,
                                              );
                                            }
                                          }}
                                        >
                                          {enabled && (
                                            <span className="admin-ops-slot-plus">
                                              +
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {dayMeals.map((meal) => {
                                      const startMinutes =
                                        Math.max(
                                          minutesIntoDay(
                                            meal.starts_at,
                                          ),
                                          CALENDAR_START_HOUR * 60,
                                        );

                                      const endMinutes =
                                        Math.min(
                                          minutesIntoDay(
                                            meal.ends_at,
                                          ),
                                          CALENDAR_END_HOUR * 60,
                                        );

                                      if (
                                        endMinutes <=
                                        startMinutes
                                      ) {
                                        return null;
                                      }

                                      const top =
                                        ((startMinutes -
                                          CALENDAR_START_HOUR * 60) /
                                          60) *
                                        CALENDAR_HOUR_HEIGHT;

                                      const height =
                                        ((endMinutes -
                                          startMinutes) /
                                          60) *
                                        CALENDAR_HOUR_HEIGHT;

                                      return (
                                        <button
                                          className="admin-ops-meal-block"
                                          type="button"
                                          key={meal.id}
                                          style={{
                                            top,
                                            height: Math.max(
                                              height,
                                              34,
                                            ),
                                          }}
                                          onClick={() =>
                                            setError(
                                              `${meal.meal_type_name} selected`,
                                            )
                                          }
                                        >
                                          <span>
                                            {meal.meal_type_name}
                                          </span>
                                          <small>
                                            {formatTime(
                                              meal.starts_at,
                                            )}
                                            {"–"}
                                            {formatTime(
                                              meal.ends_at,
                                            )}
                                          </small>
                                        </button>
                                      );
                                    })}

                                    {placements.map(
                                      ({
                                        activity,
                                        lane,
                                        laneCount,
                                      }) => {
                                        const startMinutes =
                                          Math.max(
                                            minutesIntoDay(
                                              activity.starts_at,
                                            ),
                                            CALENDAR_START_HOUR *
                                              60,
                                          );

                                        const endMinutes =
                                          Math.min(
                                            minutesIntoDay(
                                              activity.ends_at,
                                            ),
                                            CALENDAR_END_HOUR *
                                              60,
                                          );

                                        if (
                                          endMinutes <=
                                          startMinutes
                                        ) {
                                          return null;
                                        }

                                        const staff =
                                          activityStaff.filter(
                                            (row) =>
                                              String(
                                                row.event_activity_id,
                                              ) ===
                                              String(
                                                activity.id,
                                              ),
                                          );

                                        const signups =
                                          activitySignups.filter(
                                            (row) =>
                                              String(
                                                row.event_activity_id,
                                              ) ===
                                              String(
                                                activity.id,
                                              ),
                                          );

                                        const checkedInCount =
                                          signups.filter(
                                            (row) =>
                                              row.checked_in_at !==
                                              null,
                                          ).length;

                                        const required =
                                          activityQualifications.filter(
                                            (row) =>
                                              String(
                                                row.activity_id,
                                              ) ===
                                              String(
                                                activity.activity_id,
                                              ),
                                          );

                                        const missing =
                                          required.filter(
                                            (requirement) =>
                                              !staff.some(
                                                (assignment) =>
                                                  staffQualifications.some(
                                                    (
                                                      staffQualification,
                                                    ) =>
                                                      String(
                                                        staffQualification.staff_member_id,
                                                      ) ===
                                                        String(
                                                          assignment.staff_member_id,
                                                        ) &&
                                                      String(
                                                        staffQualification.qualification_id,
                                                      ) ===
                                                        String(
                                                          requirement.qualification_id,
                                                        ),
                                                  ),
                                              ),
                                          );

                                        const top =
                                          ((startMinutes -
                                            CALENDAR_START_HOUR *
                                              60) /
                                            60) *
                                          CALENDAR_HOUR_HEIGHT;

                                        const height =
                                          ((endMinutes -
                                            startMinutes) /
                                            60) *
                                          CALENDAR_HOUR_HEIGHT;

                                        const needsAttention =
                                          staff.length === 0 ||
                                          missing.length > 0;

                                        return (
                                          <div
                                            className={[
                                              "admin-ops-activity-block",
                                              needsAttention
                                                ? "needs"
                                                : "",
                                              selectedCalendarActivityId ===
                                              String(activity.id)
                                                ? "selected"
                                                : "",
                                              dragOverActivityId ===
                                              String(
                                                activity.id,
                                              )
                                                ? "drag-over"
                                                : "",
                                            ]
                                              .filter(Boolean)
                                              .join(" ")}
                                            id={`scheduled-activity-${activity.id}`}
                                            key={activity.id}
                                            style={{
                                              top,
                                              height:
                                                Math.max(
                                                  height,
                                                  34,
                                                ),
                                              left:
                                                `calc(${(lane / laneCount) * 100}% + 3px)`,
                                              width:
                                                `calc(${100 / laneCount}% - 6px)`,
                                            }}
                                            onClick={() =>
                                              setSelectedCalendarActivityId(
                                                String(activity.id),
                                              )
                                            }
                                            onDragOver={(dragEvent) => {
                                              const staffId =
                                                dragEvent.dataTransfer.types.includes(
                                                  "text/plain",
                                                );

                                              if (!staffId) return;

                                              dragEvent.preventDefault();

                                              dragEvent.dataTransfer.dropEffect =
                                                "copy";

                                              setDragOverActivityId(
                                                String(
                                                  activity.id,
                                                ),
                                              );
                                            }}
                                            onDragLeave={() =>
                                              setDragOverActivityId(
                                                null,
                                              )
                                            }
                                            onDrop={(dragEvent) =>
                                              void handleDropStaff(
                                                dragEvent,
                                                activity,
                                              )
                                            }
                                          >
                                            <div className="admin-ops-block-head">
                                              <strong>
                                                {
                                                  activity.activity_name
                                                }
                                              </strong>

                                              <span>
                                                {formatTime(
                                                  activity.starts_at,
                                                )}
                                                {"–"}
                                                {formatTime(
                                                  activity.ends_at,
                                                )}
                                              </span>
                                            </div>

                                            <div className="admin-ops-block-staff">
                                              {staff.length === 0 ? (
                                                <span className="admin-ops-need">
                                                  ● Needs staff
                                                </span>
                                              ) : (
                                                staff.map(
                                                  (assignment) => {
                                                    const member =
                                                      staffMembers.find(
                                                        (row) =>
                                                          String(
                                                            row.id,
                                                          ) ===
                                                          String(
                                                            assignment.staff_member_id,
                                                          ),
                                                      );

                                                    if (!member) {
                                                      return (
                                                        <span
                                                          key={
                                                            assignment.id
                                                          }
                                                        >
                                                          {
                                                            assignment.staff_member_name
                                                          }
                                                        </span>
                                                      );
                                                    }

                                                    const key =
                                                      `${activity.id}:${member.id}`;

                                                    return (
                                                      <button
                                                        className="admin-ops-assigned-staff"
                                                        type="button"
                                                        key={
                                                          assignment.id
                                                        }
                                                        disabled={
                                                          changingStaffKey ===
                                                          key
                                                        }
                                                        title="Remove staff"
                                                        onClick={(clickEvent) => {
                                                          clickEvent.stopPropagation();

                                                          void handleToggleStaff(
                                                            activity,
                                                            member,
                                                          );
                                                        }}
                                                      >
                                                        {
                                                          member.full_name
                                                        }
                                                        <span>
                                                          ×
                                                        </span>
                                                      </button>
                                                    );
                                                  },
                                                )
                                              )}
                                            </div>

                                            {missing.length > 0 && (
                                              <div className="admin-ops-need">
                                                ● Needs{" "}
                                                {missing
                                                  .map(
                                                    (row) =>
                                                      row.qualification_name,
                                                  )
                                                  .join(", ")}
                                              </div>
                                            )}

                                            {required.length > 0 &&
                                              missing.length === 0 && (
                                                <div className="admin-ops-covered">
                                                  ✓ Covered
                                                </div>
                                              )}

                                            {signups.length > 0 && (
                                              <div className="admin-ops-block-count">
                                                {signups.length} signed
                                                {" · "}
                                                {checkedInCount} in
                                              </div>
                                            )}
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="admin-schedule-toolbar">
                        <div className="admin-schedule-heading">
                          <strong>Schedule</strong>
                          <span>
                            {scheduledCount}{" "}
                            {scheduledCount === 1
                              ? "activity"
                              : "activities"}
                          </span>
                        </div>

                        {activities.length > 0 &&
                          scheduleEventId !== event.id && (
                            <button
                              className="admin-secondary-button"
                              type="button"
                              onClick={() =>
                                beginSchedule(event)
                              }
                            >
                              + Add Activity
                            </button>
                          )}
                      </div>

                      {activities.length === 0 && (
                        <div className="admin-dependency-empty">
                          <strong>
                            You need an activity first.
                          </strong>

                          <Link
                            className="admin-primary-link"
                            to="/admin/activities"
                          >
                            + Create Activity
                          </Link>
                        </div>
                      )}

                      {scheduledCount === 0 &&
                        activities.length > 0 && (
                          <div className="admin-schedule-empty">
                            Nothing scheduled yet.
                          </div>
                        )}

                      <div className="admin-timeline">
                        {schedule.map((day) => (
                          <section
                            className="admin-timeline-day-group"
                            key={day.key}
                          >
                            <div className="admin-timeline-day">
                              {day.label}
                            </div>

                            <div className="admin-staff-pool">
                              <div className="admin-staff-pool-label">
                                Drag staff onto an activity
                              </div>

                              <div className="admin-staff-pool-list">
                                {staffMembers.map((member) => (
                                  <div
                                    className="admin-staff-drag-chip"
                                    draggable
                                    key={member.id}
                                    onDragStart={(event) => {
                                      event.dataTransfer.effectAllowed =
                                        "copy";
                                      event.dataTransfer.setData(
                                        "text/plain",
                                        String(member.id),
                                      );
                                    }}
                                    onDragEnd={() =>
                                      setDragOverActivityId(null)
                                    }
                                  >
                                    {member.full_name}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="admin-timeline-items">
                              {day.activities.map(
                                (activity) => {
                                  const staff =
                                    activityStaff.filter(
                                      (row) =>
                                        String(
                                          row.event_activity_id,
                                        ) ===
                                        String(activity.id),
                                    );

                                  const signups =
                                    activitySignups.filter(
                                      (row) =>
                                        String(
                                          row.event_activity_id,
                                        ) ===
                                        String(activity.id),
                                    );

                                  const checkedInCount =
                                    signups.filter(
                                      (row) =>
                                        row.checked_in_at !== null,
                                    ).length;

                                  const staffLabel =
                                    staff.length > 0
                                      ? staff
                                          .map(
                                            (row) =>
                                              row.staff_member_name,
                                          )
                                          .join(", ")
                                      : "No staff";

                                  const eligibleStaff =
                                    staffMembers;

                                  const requiredQualifications =
                                    activityQualifications.filter(
                                      (row) =>
                                        String(row.activity_id) ===
                                        String(activity.activity_id),
                                    );

                                  const missingQualifications =
                                    requiredQualifications.filter(
                                      (required) =>
                                        !staff.some(
                                          (assignment) =>
                                            staffQualifications.some(
                                              (staffQualification) =>
                                                String(
                                                  staffQualification.staff_member_id,
                                                ) ===
                                                  String(
                                                    assignment.staff_member_id,
                                                  ) &&
                                                String(
                                                  staffQualification.qualification_id,
                                                ) ===
                                                  String(
                                                    required.qualification_id,
                                                  ),
                                            ),
                                        ),
                                    );

                                  return (
                                    <div
                                      className={
                                        dragOverActivityId ===
                                        String(activity.id)
                                          ? "admin-timeline-entry drag-over"
                                          : "admin-timeline-entry"
                                      }
                                      id={`scheduled-activity-${activity.id}`}
                                      key={activity.id}
                                      onDragOver={(event) => {
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect =
                                          "copy";
                                        setDragOverActivityId(
                                          String(activity.id),
                                        );
                                      }}
                                      onDragLeave={() =>
                                        setDragOverActivityId(null)
                                      }
                                      onDrop={(event) =>
                                        void handleDropStaff(
                                          event,
                                          activity,
                                        )
                                      }
                                    >
                                      <div
                                        className="admin-timeline-row"
                                      >
                                        <div className="admin-timeline-time">
                                          {formatTime(
                                            activity.starts_at,
                                          )}
                                        </div>

                                        <div className="admin-timeline-detail">
                                          <div className="admin-timeline-name">
                                            {
                                              activity.activity_name
                                            }
                                          </div>

                                          <div className="admin-timeline-meta">
                                            to{" "}
                                            {formatTime(
                                              activity.ends_at,
                                            )}
                                            {" · "}
                                            {staffLabel}
                                            {" · "}
                                            {signups.length} signed
                                            {" · "}
                                            {checkedInCount} in
                                          </div>
                                        </div>

                                      </div>

                                      <div className="admin-activity-operations">
                                          <div className="admin-operation-block">
                                            <div className="admin-operation-label">
                                              Staff
                                            </div>

                                            {requiredQualifications.length > 0 && (
                                              <div className="admin-operation-empty">
                                                {missingQualifications.length > 0
                                                  ? `Needs ${missingQualifications
                                                      .map(
                                                        (row) =>
                                                          row.qualification_name,
                                                      )
                                                      .join(", ")} qualification`
                                                  : "Qualification covered"}
                                              </div>
                                            )}

                                            {eligibleStaff.length === 0 ? (
                                              <div className="admin-operation-empty">
                                                No staff members available.
                                              </div>
                                            ) : (
                                              <div className="admin-staff-options">
                                                {eligibleStaff.map(
                                                  (member) => {
                                                    const assigned =
                                                      staff.some(
                                                        (row) =>
                                                          String(
                                                            row.staff_member_id,
                                                          ) ===
                                                          String(
                                                            member.id,
                                                          ),
                                                      );

                                                    const key =
                                                      `${activity.id}:${member.id}`;

                                                    return (
                                                      <button
                                                        className={
                                                          assigned
                                                            ? "admin-staff-option assigned"
                                                            : "admin-staff-option"
                                                        }
                                                        type="button"
                                                        key={member.id}
                                                        disabled={
                                                          changingStaffKey ===
                                                          key
                                                        }
                                                        onClick={() =>
                                                          void handleToggleStaff(
                                                            activity,
                                                            member,
                                                          )
                                                        }
                                                      >
                                                        <span>
                                                          {member.full_name}
                                                        </span>

                                                        <span>
                                                          {changingStaffKey ===
                                                          key
                                                            ? "…"
                                                            : assigned
                                                              ? "Assigned"
                                                              : "+ Assign"}
                                                        </span>
                                                      </button>
                                                    );
                                                  },
                                                )}
                                              </div>
                                            )}
                                          </div>

                                          <div className="admin-operation-block">
                                            <div className="admin-operation-label">
                                              Participants
                                            </div>

                                            {signups.length === 0 ? (
                                              <div className="admin-operation-empty">
                                                No one signed up.
                                              </div>
                                            ) : (
                                              <div className="admin-participant-list">
                                                {signups.map(
                                                  (signup) => (
                                                    <div
                                                      className="admin-participant-row"
                                                      key={
                                                        signup.id
                                                      }
                                                    >
                                                      <div>
                                                        <div className="admin-participant-name">
                                                          {
                                                            signup.member_name
                                                          }
                                                        </div>

                                                        <div className="admin-participant-household">
                                                          {
                                                            signup.household_name
                                                          }
                                                        </div>
                                                      </div>

                                                      <button
                                                        className={
                                                          signup.checked_in_at
                                                            ? "admin-checkin-button checked"
                                                            : "admin-checkin-button"
                                                        }
                                                        type="button"
                                                        disabled={
                                                          changingCheckInId ===
                                                          signup.id
                                                        }
                                                        onClick={() =>
                                                          void handleToggleCheckIn(
                                                            signup,
                                                          )
                                                        }
                                                      >
                                                        {changingCheckInId ===
                                                        signup.id
                                                          ? "Saving…"
                                                          : signup.checked_in_at
                                                            ? "Checked in"
                                                            : "Check in"}
                                                      </button>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {scheduleEventId === event.id && (
                  <form
                    className="admin-schedule-form"
                    onSubmit={handleScheduleActivity}
                  >
                    <div className="admin-schedule-form-title">
                      Schedule activity
                    </div>

                    <div className="admin-form-grid">
                      <label>
                        <span>Activity</span>

                        <select
                          value={scheduledActivityId}
                          onChange={(event) =>
                            setScheduledActivityId(
                              event.target.value,
                            )
                          }
                          required
                        >
                          {activities.map((activity) => (
                            <option
                              key={activity.id}
                              value={activity.id}
                            >
                              {activity.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div />

                      <label>
                        <span>Start date</span>

                        <input
                          type="date"
                          value={activityStartDate}
                          onChange={(event) => {
                            setActivityStartDate(
                              event.target.value,
                            );

                            if (!activityEndDate) {
                              setActivityEndDate(
                                event.target.value,
                              );
                            }
                          }}
                          required
                        />
                      </label>

                      <label>
                        <span>Start time</span>

                        <input
                          type="text"
                          value={activityStartTime}
                          placeholder="10:00 AM"
                          autoComplete="off"
                          onChange={(event) =>
                            setActivityStartTime(
                              event.target.value,
                            )
                          }
                          onBlur={() => {
                            const parsed =
                              parseTimeInput(
                                activityStartTime,
                              );

                            if (!parsed) return;

                            setActivityStartTime(
                              formatTimeInput(parsed),
                            );

                            if (!activityEndTime) {
                              setActivityEndTime(
                                formatTimeInput(
                                  addMinutes(parsed, 60),
                                ),
                              );
                            }
                          }}
                          required
                        />
                      </label>

                      <label>
                        <span>End date</span>

                        <input
                          type="date"
                          value={activityEndDate}
                          onChange={(event) =>
                            setActivityEndDate(
                              event.target.value,
                            )
                          }
                          required
                        />
                      </label>

                      <label>
                        <span>End time</span>

                        <input
                          type="text"
                          value={activityEndTime}
                          placeholder="11:00 AM"
                          autoComplete="off"
                          onChange={(event) =>
                            setActivityEndTime(
                              event.target.value,
                            )
                          }
                          onBlur={() => {
                            const parsed =
                              parseTimeInput(
                                activityEndTime,
                              );

                            if (parsed) {
                              setActivityEndTime(
                                formatTimeInput(parsed),
                              );
                            }
                          }}
                          required
                        />
                      </label>
                    </div>

                    <div className="admin-create-actions">
                      <button
                        className="member-cancel-button"
                        type="button"
                        onClick={resetScheduleForm}
                      >
                        Cancel
                      </button>

                      <button
                        className="admin-primary-button"
                        type="submit"
                        disabled={scheduling}
                      >
                        {scheduling
                          ? "Scheduling…"
                          : "Schedule Activity"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {deleteConfirmId === event.id && (
              <div className="admin-delete-confirm">
                <span>Delete this event?</span>

                <div className="admin-delete-confirm-actions">
                  <button
                    type="button"
                    className="admin-delete-cancel"
                    onClick={() => setDeleteConfirmId(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="admin-delete-confirm-button"
                    disabled={deletingId === event.id}
                    onClick={() => void handleDelete(event.id)}
                  >
                    {deletingId === event.id
                      ? "Deleting…"
                      : "Delete Event"}
                  </button>
                </div>
              </div>
            )}
          </article>
            ))}
        </div>
      </div>
    </section>
  );
}
