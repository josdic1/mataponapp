import type {
  ActivityQualification,
} from "@matapon/shared/schemas/qualifications";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getActivityQualifications(): Promise<ActivityQualification[]> {
  const response = await fetch(
    `${API_URL}/api/activity-qualifications`,
    {
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not load activity qualifications",
    );
  }

  return data.activity_qualifications as ActivityQualification[];
}

export async function addActivityQualification(input: {
  activity_id: number;
  qualification_id: number;
}): Promise<ActivityQualification> {
  const response = await fetch(
    `${API_URL}/api/activity-qualifications`,
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
    throw new Error(
      data.error ?? "Could not add activity qualification",
    );
  }

  return data.activity_qualification as ActivityQualification;
}

export async function removeActivityQualification(
  id: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/activity-qualifications/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not remove activity qualification",
    );
  }
}
