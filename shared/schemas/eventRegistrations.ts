import { z } from "zod";

export const createEventRegistrationSchema = z.object({
  user_id: z.number().int().positive(),
  event_id: z.number().int().positive(),
  spots_paid_for: z.number().int().positive(),
});

export const updateEventRegistrationSchema = z.object({
  spots_paid_for: z.number().int().positive(),
});

export const eventRegistrationIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateEventRegistrationInput =
  z.infer<typeof createEventRegistrationSchema>;

export type UpdateEventRegistrationInput =
  z.infer<typeof updateEventRegistrationSchema>;

export type EventRegistration = {
  id: string;
  user_id: string;
  household_name: string;
  event_id: string;
  event_name: string;
  spots_paid_for: number;
  attendee_count: number;
  created_at: string;
  updated_at: string;
};
