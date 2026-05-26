import { z } from "zod";

export const updateValidation = z.object({
  clientNoticeSettings: z.object({
    description: z.string().trim().max(500),
  }).strict(),
}).strict();

export type Update = z.infer<typeof updateValidation>;
