import type {
  StaffQualification,
} from "@matapon/shared/schemas/qualifications";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getStaffQualifications(): Promise<StaffQualification[]> {
  const response = await fetch(
    `${API_URL}/api/staff-qualifications`,
    {
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not load staff qualifications",
    );
  }

  return data.staff_qualifications as StaffQualification[];
}

export async function addStaffQualification(input: {
  staff_member_id: number;
  qualification_id: number;
}): Promise<StaffQualification> {
  const response = await fetch(
    `${API_URL}/api/staff-qualifications`,
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
      data.error ?? "Could not add staff qualification",
    );
  }

  return data.staff_qualification as StaffQualification;
}

export async function removeStaffQualification(
  id: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/staff-qualifications/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Could not remove staff qualification",
    );
  }
}
