import { z } from "zod";

export const createMemberAttendeeSchema = z.object({
  member_id: z.number().int().positive(),
  event_id: z.number().int().positive(),
});

export type CreateMemberAttendeeInput =
  z.infer<typeof createMemberAttendeeSchema>;

export const memberAttendeeIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type MemberAttendee = {
  id: string;
  member_id: string;
  member_name: string;
  user_id: string;
  household_name: string;
  event_id: string;
  event_name: string;
  created_at: string;
  updated_at: string;
};
