import type {
  CreateEventActivityInput,
  EventActivity,
} from "@matapon/shared/schemas/eventActivities";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getEventActivities(): Promise<EventActivity[]> {
  const response = await fetch(`${API_URL}/api/event-activities`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load activities");
  }

  return data.event_activities as EventActivity[];
}

export async function createEventActivity(
  input: CreateEventActivityInput,
): Promise<EventActivity> {
  const response = await fetch(`${API_URL}/api/event-activities`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not schedule activity");
  }

  return data.event_activity as EventActivity;
}
