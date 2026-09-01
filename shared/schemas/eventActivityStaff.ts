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

export type EventActivityStaff = {
  id: string;
  event_activity_id: string;
  event_name: string;
  activity_id: string;
  activity_name: string;
  staff_member_id: string;
  staff_member_name: string;
  created_at: string;
  updated_at: string;
};
