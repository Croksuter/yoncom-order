import { HTTPError } from "ky";
import * as ClientErrorResponse from "shared/types/responses/client/error";
import { toast } from "~/hooks/use-toast";

export default async function kyErrorHandler(error: unknown) {
  if (error instanceof HTTPError) {
    const res = await error.response.json<ClientErrorResponse.Error>().catch(() => null);

    if (res?.error === "NEXT_MIGRATION_NOT_IMPLEMENTED") {
      console.info(new Date().toLocaleString(), "Migration placeholder:", res.error);
      return;
    }

    console.error(new Date().toLocaleString(), "HTTP Error:", res?.error ?? error.response.status);
    toast({
      variant: "destructive",
      title: "오류가 발생했습니다.",
      description: res?.error ?? "요청 처리 중 오류가 발생했습니다.",
      duration: 3000,
    });
  } else {
    console.error(new Date().toLocaleString(), "Fetch Error:", error);
    toast({
      variant: "destructive",
      title: "오류가 발생했습니다.",
      description: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
      duration: 3000,
    });
  }
}
