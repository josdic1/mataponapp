import { z } from "zod";

export const createMealTypeSchema = z.object({
  name: z.string().trim().min(1),
});

export const updateMealTypeSchema =
  createMealTypeSchema
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      "At least one field is required",
    );

export const mealTypeIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createEventMealSchema = z.object({
  event_id: z.number().int().positive(),
  meal_type_id: z.number().int().positive(),
  starts_at: z.string().trim().min(1),
  ends_at: z.string().trim().min(1),
});

export const updateEventMealSchema =
  createEventMealSchema
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      "At least one field is required",
    );

export const eventMealIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type MealType = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type EventMeal = {
  id: string;
  event_id: string;
  event_name: string;
  meal_type_id: string;
  meal_type_name: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};

export type CreateEventMealInput =
  z.infer<typeof createEventMealSchema>;

export type UpdateEventMealInput =
  z.infer<typeof updateEventMealSchema>;
