import { z } from "zod";

export const resetTestDataSchema = z.object({
  confirm: z.literal("RESET"),
});

export type ResetTestDataInput =
  z.infer<typeof resetTestDataSchema>;
