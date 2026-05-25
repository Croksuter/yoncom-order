import { z } from "zod";

export const getValidation = z.object({}).strict();
export type Get = z.infer<typeof getValidation>;
