import { z } from "zod";

const tossTransferUrlTemplate = z.string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith("supertoss://") || value.startsWith("https://"), {
    message: "Toss transfer URL must start with supertoss:// or https://",
  });

export const updateValidation = z.object({
  paymentSettings: z.object({
    bankName: z.string().trim().min(1).max(80),
    accountNumber: z.string().trim().min(1).max(80),
    accountHolder: z.string().trim().min(1).max(80),
    tossTransferUrlTemplate,
    depositGuide: z.string().trim().min(1).max(1000),
  }).strict(),
}).strict();

export type Update = z.infer<typeof updateValidation>;
