import type {
  Activity,
  CreateActivityInput,
  UpdateActivityInput,
} from "@matapon/shared/schemas/activities";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type ActivityDetail = Activity & {
  setting_other?: {
    value: string | null;
    reason: string | null;
  };
};

async function errorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await response.json();
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getActivities(): Promise<Activity[]> {
  const response = await fetch(`${API_URL}/api/activities`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      await errorMessage(response, "Could not load activities"),
    );
  }

  const data = await response.json();

  return data.activities as Activity[];
}

export async function getActivity(
  id: string,
): Promise<ActivityDetail> {
  const response = await fetch(`${API_URL}/api/activities/${id}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      await errorMessage(response, "Could not load activity"),
    );
  }

  const data = await response.json();

  return data.activity as ActivityDetail;
}

export async function createActivity(
  input: CreateActivityInput,
): Promise<Activity> {
  const response = await fetch(`${API_URL}/api/activities`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await errorMessage(response, "Could not create activity"),
    );
  }

  const data = await response.json();

  return data.activity as Activity;
}

export async function updateActivity(
  id: string,
  input: UpdateActivityInput,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/activities/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await errorMessage(response, "Could not update activity"),
    );
  }
}

export async function deleteActivity(
  id: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/activities/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      await errorMessage(response, "Could not delete activity"),
    );
  }
}
