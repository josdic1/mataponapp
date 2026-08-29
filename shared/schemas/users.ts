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
