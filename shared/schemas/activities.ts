import { z } from "zod";

export const activitySettingSchema = z.enum([
  "inside",
  "outside",
  "other",
]);

export const createActivitySchema = z.object({
  name: z.string().trim().min(1),
  area_id: z.number().int().positive(),
  setting: activitySettingSchema,
  other_value: z.string().trim().min(1).optional(),
  other_reason: z.string().trim().min(1).optional(),
});

export const updateActivitySchema = createActivitySchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required"
  );

export const activityIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type ActivitySetting =
  z.infer<typeof activitySettingSchema>;

export type CreateActivityInput =
  z.infer<typeof createActivitySchema>;

export type UpdateActivityInput =
  z.infer<typeof updateActivitySchema>;

export type Activity = {
  id: string;
  name: string;
  area_id: string;
  area_name: string;
  setting: ActivitySetting;
  created_at: string;
  updated_at: string;
};
