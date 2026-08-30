import { z } from "zod";

export const createEventTypeSchema = z.object({
  name: z.string().trim().min(1),
});

export const updateEventTypeSchema = z.object({
  name: z.string().trim().min(1),
});

export const eventTypeIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateEventTypeInput =
  z.infer<typeof createEventTypeSchema>;

export type UpdateEventTypeInput =
  z.infer<typeof updateEventTypeSchema>;
