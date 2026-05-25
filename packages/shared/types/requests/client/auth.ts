import { z } from "zod";

export const signUpValidation = z.object({
  email: z.string().email().min(5),
  password: z.string().min(8).max(255),
  name: z.string().trim().min(1).max(80),
}).strict();
export type SignUp = z.infer<typeof signUpValidation>;

export const signInValidation = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(255),
}).strict();
export type SignIn = z.infer<typeof signInValidation>;

export const signOutValidation = z.object({}).strict();
export type SignOut = z.infer<typeof signOutValidation>;
