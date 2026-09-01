import type {
  CreateEventActivitySignupInput,
  EventActivitySignup,
} from "@matapon/shared/schemas/eventActivitySignups";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getActivitySignups(): Promise<EventActivitySignup[]> {
  const response = await fetch(`${API_URL}/api/event-activity-signups`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load activity signups");
  }

  return data.event_activity_signups as EventActivitySignup[];
}

export async function addActivitySignup(
  input: CreateEventActivitySignupInput,
): Promise<EventActivitySignup> {
  const response = await fetch(`${API_URL}/api/event-activity-signups`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not sign up for activity");
  }

  return data.event_activity_signup as EventActivitySignup;
}

export async function removeActivitySignup(id: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/event-activity-signups/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not remove activity signup");
  }
}

export async function checkInActivitySignup(
  id: string,
): Promise<EventActivitySignup> {
  const response = await fetch(
    `${API_URL}/api/event-activity-signups/${id}/check-in`,
    {
      method: "PATCH",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not check participant in");
  }

  return data.event_activity_signup as EventActivitySignup;
}

export async function undoActivitySignupCheckIn(
  id: string,
): Promise<EventActivitySignup> {
  const response = await fetch(
    `${API_URL}/api/event-activity-signups/${id}/undo-check-in`,
    {
      method: "PATCH",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not undo check-in");
  }

  return data.event_activity_signup as EventActivitySignup;
}
