import type {
  CreateEventActivityStaffInput,
  EventActivityStaff,
} from "@matapon/shared/schemas/eventActivityStaff";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getEventActivityStaff(): Promise<EventActivityStaff[]> {
  const response = await fetch(`${API_URL}/api/event-activity-staff`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not load scheduled staff",
    );
  }

  return data.event_activity_staff as EventActivityStaff[];
}

export async function assignEventActivityStaff(
  input: CreateEventActivityStaffInput,
): Promise<EventActivityStaff> {
  const response = await fetch(`${API_URL}/api/event-activity-staff`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not assign staff",
    );
  }

  return data.event_activity_staff as EventActivityStaff;
}

export async function removeEventActivityStaff(
  id: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/event-activity-staff/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not remove staff",
    );
  }
}
