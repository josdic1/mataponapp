import { z } from "zod";

export const createEventActivitySchema = z.object({
  event_id: z.number().int().positive(),
  activity_id: z.number().int().positive(),
  starts_at: z.string().trim().min(1),
  ends_at: z.string().trim().min(1),
});

export type CreateEventActivityInput =
  z.infer<typeof createEventActivitySchema>;
