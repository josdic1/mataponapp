import { z } from "zod";

export const createEventSchema = z.object({
  name: z.string().trim().min(1),
  event_type_id: z.number().int().positive(),
  starts_at: z.string().trim().min(1),
  ends_at: z.string().trim().min(1),
  other_value: z.string().trim().min(1).optional(),
  other_reason: z.string().trim().min(1).optional(),
});

export const updateEventSchema = createEventSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required"
  );

export const eventIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateEventInput =
  z.infer<typeof createEventSchema>;

export type UpdateEventInput =
  z.infer<typeof updateEventSchema>;

export type Event = {
  id: string;
  name: string;
  event_type_id: string;
  event_type_name: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};
