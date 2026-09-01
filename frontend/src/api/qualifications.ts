import type {
  Qualification,
} from "@matapon/shared/schemas/qualifications";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function responseData(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Qualification request failed",
    );
  }

  return data;
}

export async function getQualifications(): Promise<Qualification[]> {
  const response = await fetch(
    `${API_URL}/api/qualifications`,
    {
      credentials: "include",
    },
  );

  const data = await responseData(response);

  return data.qualifications as Qualification[];
}

export async function createQualification(
  name: string,
): Promise<Qualification> {
  const response = await fetch(
    `${API_URL}/api/qualifications`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );

  const data = await responseData(response);

  return data.qualification as Qualification;
}

export async function updateQualification(
  id: string,
  name: string,
): Promise<Qualification> {
  const response = await fetch(
    `${API_URL}/api/qualifications/${id}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );

  const data = await responseData(response);

  return data.qualification as Qualification;
}

export async function deleteQualification(
  id: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/qualifications/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  await responseData(response);
}
