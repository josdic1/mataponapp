import { z } from "zod";

export const createEventActivityStaffSchema = z.object({
  event_activity_id: z.number().int().positive(),
  staff_member_id: z.number().int().positive(),
});

export type CreateEventActivityStaffInput =
  z.infer<typeof createEventActivityStaffSchema>;

export const eventActivityStaffIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
