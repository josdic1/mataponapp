import type {
  CreateUserMemberInput,
  TransferPrimaryMemberInput,
  UpdateUserMemberInput,
  UserMember,
} from "@matapon/shared/schemas/users";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getMyHousehold(): Promise<UserMember[]> {
  const response = await fetch(`${API_URL}/api/user-members`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load household");
  }

  return data.user_members as UserMember[];
}

export async function createHouseholdMember(
  input: CreateUserMemberInput,
): Promise<UserMember> {
  const response = await fetch(`${API_URL}/api/user-members`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not add family member");
  }

  return data.user_member as UserMember;
}


export async function updateHouseholdMember(
  id: string,
  input: UpdateUserMemberInput,
): Promise<UserMember> {
  const response = await fetch(`${API_URL}/api/user-members/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not update family member");
  }

  return data.user_member as UserMember;
}

export async function deleteHouseholdMember(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/user-members/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not delete family member");
  }
}

export async function transferPrimaryMember(
  id: string,
  input: TransferPrimaryMemberInput,
): Promise<UserMember[]> {
  const response = await fetch(
    `${API_URL}/api/user-members/${id}/transfer-primary`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not transfer primary");
  }

  return data.user_members as UserMember[];
}
