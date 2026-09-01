import { z } from "zod";

export const createEventActivitySchema = z.object({
  event_id: z.number().int().positive(),
  activity_id: z.number().int().positive(),
  starts_at: z.string().trim().min(1),
  ends_at: z.string().trim().min(1),
});

export const updateEventActivitySchema =
  createEventActivitySchema
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      "At least one field is required"
    );

export const eventActivityIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateEventActivityInput =
  z.infer<typeof createEventActivitySchema>;

export type UpdateEventActivityInput =
  z.infer<typeof updateEventActivitySchema>;

export type EventActivity = {
  id: string;
  event_id: string;
  event_name: string;
  activity_id: string;
  activity_name: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};
