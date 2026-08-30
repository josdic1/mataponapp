import { z } from "zod";

export const staffRoleSchema = z.enum([
  "staff",
  "manager",
]);

export const createStaffMemberSchema = z.object({
  user_id: z.number().int().positive(),
  full_name: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(1).optional(),
  role: staffRoleSchema,
});

export type StaffRole =
  z.infer<typeof staffRoleSchema>;

export type CreateStaffMemberInput =
  z.infer<typeof createStaffMemberSchema>;
