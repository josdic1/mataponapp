import { z } from "zod";

export const createStaffAreaSchema = z.object({
  name: z.string().trim().min(1),
});

export const updateStaffAreaSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    { message: "At least one field is required" }
  );

export const staffAreaIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateStaffAreaInput =
  z.infer<typeof createStaffAreaSchema>;

export type UpdateStaffAreaInput =
  z.infer<typeof updateStaffAreaSchema>;
