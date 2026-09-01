import type {
  CreateMemberAttendeeInput,
  MemberAttendee,
} from "@matapon/shared/schemas/memberAttendees";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getMyEventAttendance(): Promise<MemberAttendee[]> {
  const response = await fetch(`${API_URL}/api/member-attendees`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load event attendance");
  }

  return data.member_attendees as MemberAttendee[];
}

export async function addEventAttendee(
  input: CreateMemberAttendeeInput,
): Promise<MemberAttendee> {
  const response = await fetch(`${API_URL}/api/member-attendees`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not add attendee");
  }

  return data.member_attendee as MemberAttendee;
}

export async function removeEventAttendee(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/member-attendees/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not remove attendee");
  }
}
