import { z } from "zod";

export const uploadValidation = z.object({
  file: z.instanceof(File).refine((file) => file.type.startsWith("image/"), {
    message: "이미지 파일만 업로드할 수 있습니다.",
  }),
}).strict();
export type Upload = z.infer<typeof uploadValidation>;
