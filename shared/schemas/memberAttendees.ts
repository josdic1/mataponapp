import { z } from "zod";

export const createMemberAttendeeSchema = z.object({
  member_id: z.number().int().positive(),
  event_id: z.number().int().positive(),
});

export type CreateMemberAttendeeInput =
  z.infer<typeof createMemberAttendeeSchema>;
