import { z } from "zod";

export const heartBeatValidation = z.object({}).strict();
export type HeartBeat = z.infer<typeof heartBeatValidation>;
