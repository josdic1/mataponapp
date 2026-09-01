import type { EventType } from "@matapon/shared/schemas/eventTypes";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getEventTypes(): Promise<EventType[]> {
  const response = await fetch(`${API_URL}/api/event-types`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load event types");
  }

  return data.event_types as EventType[];
}
