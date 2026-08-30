import { z } from "zod";

export const createUserMemberSchema = z.object({
  user_id: z.number().int().positive(),
  full_name: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(1).optional(),
  dietary_restrictions: z.string().trim().min(1).optional(),
  member_role: z.enum(["primary", "adult", "child"]),
});

export type CreateUserMemberInput =
  z.infer<typeof createUserMemberSchema>;
