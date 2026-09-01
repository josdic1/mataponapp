import type { SessionUser, UserType } from "@matapon/shared/schemas/users";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type DevUser = {
  id: string;
  username: string;
  user_type: UserType;
  must_change_password: boolean;
};

export async function getDevUsers(): Promise<DevUser[]> {
  const response = await fetch(`${API_URL}/api/dev/users`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load development users");
  }

  return data.users as DevUser[];
}

export async function devLogin(id: string): Promise<SessionUser> {
  const response = await fetch(`${API_URL}/api/dev/login/${id}`, {
    method: "POST",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Development login failed");
  }

  return data.user as SessionUser;
}
