import { z } from "zod";

export const createQualificationSchema = z.object({
  name: z.string().trim().min(1),
});

export const updateQualificationSchema = createQualificationSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export const qualificationIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createActivityQualificationSchema = z.object({
  activity_id: z.number().int().positive(),
  qualification_id: z.number().int().positive(),
});

export const createStaffQualificationSchema = z.object({
  staff_member_id: z.number().int().positive(),
  qualification_id: z.number().int().positive(),
});

export const relationshipIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type Qualification = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ActivityQualification = {
  id: string;
  activity_id: string;
  activity_name: string;
  qualification_id: string;
  qualification_name: string;
  created_at: string;
  updated_at: string;
};

export type StaffQualification = {
  id: string;
  staff_member_id: string;
  staff_member_name: string;
  qualification_id: string;
  qualification_name: string;
  created_at: string;
  updated_at: string;
};
