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

export const updateStaffMemberSchema = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().nullable().optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    role: staffRoleSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    { message: "At least one field is required" }
  );

export const staffMemberIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type StaffRole =
  z.infer<typeof staffRoleSchema>;

export type CreateStaffMemberInput =
  z.infer<typeof createStaffMemberSchema>;

export type UpdateStaffMemberInput =
  z.infer<typeof updateStaffMemberSchema>;
