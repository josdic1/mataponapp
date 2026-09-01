import type { StaffMember } from "@matapon/shared/schemas/staffMembers";
import type { EventActivityStaff } from "@matapon/shared/schemas/eventActivityStaff";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getMyStaffProfile(): Promise<StaffMember | null> {
  const response = await fetch(`${API_URL}/api/staff-members`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load staff profile");
  }

  return (data.staff_members as StaffMember[])[0] ?? null;
}

export async function getMyStaffAssignments(): Promise<EventActivityStaff[]> {
  const response = await fetch(`${API_URL}/api/event-activity-staff`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load assignments");
  }

  return data.event_activity_staff as EventActivityStaff[];
}

export async function getStaffMembers(): Promise<StaffMember[]> {
  const response = await fetch(`${API_URL}/api/staff-members`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load staff members");
  }

  return data.staff_members as StaffMember[];
}
