import type {
  EventRegistration,
} from "@matapon/shared/schemas/eventRegistrations";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getMyEventRegistrations(): Promise<
  EventRegistration[]
> {
  const response = await fetch(
    `${API_URL}/api/event-registrations`,
    {
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not load event registrations"
    );
  }

  return data.event_registrations as EventRegistration[];
}
