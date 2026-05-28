import { z } from "zod";

export const getValidation = z.object({
  from: z.coerce.number().int().min(0),
  to: z.coerce.number().int().min(0),
  bucket: z.enum(["hour", "day"]).default("day"),
}).strict().refine((value) => value.to > value.from);

export type Get = z.infer<typeof getValidation>;
