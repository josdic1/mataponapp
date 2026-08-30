import { z } from "zod";

export const createStaffMemberAreaSchema = z.object({
  staff_member_id: z.number().int().positive(),
  staff_area_id: z.number().int().positive(),
});

export type CreateStaffMemberAreaInput =
  z.infer<typeof createStaffMemberAreaSchema>;
