import type {
  CreateEventMealInput,
  EventMeal,
  MealType,
  UpdateEventMealInput,
} from "@matapon/shared/schemas/meals";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function responseData(
  response: Response,
  fallback: string,
) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? fallback);
  }

  return data;
}

export async function getMealTypes(): Promise<MealType[]> {
  const response = await fetch(
    `${API_URL}/api/meals/types`,
    {
      credentials: "include",
    },
  );

  const data = await responseData(
    response,
    "Could not load meal types",
  );

  return data.meal_types as MealType[];
}

export async function getEventMeals(): Promise<EventMeal[]> {
  const response = await fetch(
    `${API_URL}/api/meals`,
    {
      credentials: "include",
    },
  );

  const data = await responseData(
    response,
    "Could not load event meals",
  );

  return data.event_meals as EventMeal[];
}

export async function createEventMeal(
  input: CreateEventMealInput,
): Promise<EventMeal> {
  const response = await fetch(
    `${API_URL}/api/meals`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = await responseData(
    response,
    "Could not create event meal",
  );

  return data.event_meal as EventMeal;
}

export async function updateEventMeal(
  id: string,
  input: UpdateEventMealInput,
): Promise<EventMeal> {
  const response = await fetch(
    `${API_URL}/api/meals/${id}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = await responseData(
    response,
    "Could not update event meal",
  );

  return data.event_meal as EventMeal;
}

export async function deleteEventMeal(
  id: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/meals/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  await responseData(
    response,
    "Could not delete event meal",
  );
}
