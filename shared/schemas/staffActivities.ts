import { z } from "zod";

export const createStaffActivitySchema = z.object({
  staff_member_id: z.number().int().positive(),
  activity_id: z.number().int().positive(),
});

export type CreateStaffActivityInput =
  z.infer<typeof createStaffActivitySchema>;

export const staffActivityIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
