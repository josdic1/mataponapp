import { z } from "zod";

export const createEventActivitySignupSchema = z.object({
  event_activity_id: z.number().int().positive(),
  member_attendee_id: z.number().int().positive(),
});

export const eventActivitySignupIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateEventActivitySignupInput =
  z.infer<typeof createEventActivitySignupSchema>;
