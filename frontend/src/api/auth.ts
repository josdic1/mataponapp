import type { LoginInput } from "@matapon/shared/schemas/auth";
import type { SessionUser } from "@matapon/shared/schemas/users";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Could not load session");
  }

  const data = (await response.json()) as { user: SessionUser };

  return data.user;
}

export async function loginUser(input: LoginInput): Promise<SessionUser> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Login failed");
  }

  return data.user as SessionUser;
}

export async function logoutUser(): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

import type { ChangePasswordInput } from "@matapon/shared/schemas/auth";

export async function changePasswordUser(
  input: ChangePasswordInput,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Password change failed");
  }
}
