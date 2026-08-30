import { z } from "zod";

export const createEventSchema = z.object({
  name: z.string().trim().min(1),
  event_type_id: z.number().int().positive(),
  starts_at: z.string().trim().min(1),
  ends_at: z.string().trim().min(1),
  other_value: z.string().trim().min(1).optional(),
  other_reason: z.string().trim().min(1).optional(),
});

export type CreateEventInput =
  z.infer<typeof createEventSchema>;
