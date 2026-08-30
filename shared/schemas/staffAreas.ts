import { z } from "zod";

export const createStaffAreaSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateStaffAreaInput =
  z.infer<typeof createStaffAreaSchema>;
