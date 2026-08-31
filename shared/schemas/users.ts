import { z } from "zod";

export const userTypeSchema = z.enum([
  "member",
  "staff",
  "admin",
]);

export const memberRoleSchema = z.enum([
  "primary",
  "adult",
  "child",
]);

export const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  user_type: userTypeSchema,
});

export const createUserMemberSchema = z.object({
  user_id: z.number().int().positive(),
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dietary_restrictions: z.string().optional(),
  member_role: memberRoleSchema,
});

export type UserType = z.infer<typeof userTypeSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateUserMemberInput = z.infer<typeof createUserMemberSchema>;

export const updateUserSchema = z
  .object({
    username: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    { message: "At least one field is required" }
  );

export const userIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateUserMemberSchema = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().nullable().optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    dietary_restrictions: z.string().trim().min(1).nullable().optional(),
    member_role: memberRoleSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    { message: "At least one field is required" }
  );

export const userMemberIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type UpdateUserMemberInput =
  z.infer<typeof updateUserMemberSchema>;
