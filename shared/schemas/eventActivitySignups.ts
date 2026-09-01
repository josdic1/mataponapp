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

export type EventActivitySignup = {
  id: string;
  event_activity_id: string;
  event_id: string;
  event_name: string;
  activity_id: string;
  activity_name: string;
  member_attendee_id: string;
  member_id: string;
  member_name: string;
  user_id: string;
  household_name: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
};
