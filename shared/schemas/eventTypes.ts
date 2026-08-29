import { z } from "zod";

export const createEventTypeSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateEventTypeInput =
  z.infer<typeof createEventTypeSchema>;
