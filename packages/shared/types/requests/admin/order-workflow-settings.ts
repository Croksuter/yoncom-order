import { z } from "zod";

export const updateValidation = z.object({
  orderWorkflowSettings: z.object({
    autoPickUpOnCookComplete: z.boolean(),
  }).strict(),
}).strict();

export type Update = z.infer<typeof updateValidation>;
