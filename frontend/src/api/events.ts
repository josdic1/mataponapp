import type {
  CreateEventInput,
  Event,
} from "@matapon/shared/schemas/events";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getEvents(): Promise<Event[]> {
  const response = await fetch(`${API_URL}/api/events`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load events");
  }

  return data.events as Event[];
}

export async function createEvent(
  input: CreateEventInput,
): Promise<Event> {
  const response = await fetch(`${API_URL}/api/events`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not create event");
  }

  return data.event as Event;
}


export async function updateEvent(
  id: string,
  input: Partial<CreateEventInput>,
): Promise<Event> {
  const response = await fetch(`${API_URL}/api/events/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not update event");
  }

  return data.event as Event;
}

export async function deleteEvent(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/events/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not delete event");
  }
}
