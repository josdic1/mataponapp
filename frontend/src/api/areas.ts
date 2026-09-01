import type { Area } from "@matapon/shared/schemas/areas";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function getAreas(): Promise<Area[]> {
  const response = await fetch(`${API_URL}/api/areas`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load areas");
  }

  return data.areas as Area[];
}
