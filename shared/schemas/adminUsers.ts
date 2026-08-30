import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().trim().min(1),
  temporary_password: z.string().min(1),
  user_type: z.enum(["member", "staff", "admin"]),
});

export type CreateUserInput =
  z.infer<typeof createUserSchema>;
