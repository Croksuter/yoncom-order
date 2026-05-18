import ky, { type SearchParamsOption } from "ky";
import kyErrorHandler from "~/lib/ky-error-handler";

const API_BASE_PATH = "api";

function getApiPrefixUrl() {
  if (typeof window !== "undefined") {
    return new URL(`/${API_BASE_PATH}/`, window.location.origin).toString();
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
}

export const api = ky.create({
  prefixUrl: getApiPrefixUrl(),
  credentials: "include",
});

export default async function queryStore<Query, Result>({
  route,
  method,
  query,
  setter,
  onSuccess,
  onError,
  headers = {},
}: {
  route: string;
  method: "get" | "post" | "put" | "delete" | "patch" | "head";
  query: Query;
  setter?: (state: { isLoaded: boolean; error: boolean }) => void;
  onSuccess?: (res: Result) => void;
  onError?: (error: unknown) => void;
  headers?: HeadersInit;
}): Promise<Result | null> {
  setter?.({ isLoaded: false, error: false });

  try {
    const res =
      method === "get" || method === "head"
        ? await api[method](route, {
            searchParams: query as SearchParamsOption,
            headers,
          }).json<Result>()
        : await api[method](route, { json: query, headers }).json<Result>();

    onSuccess?.(res);
    setter?.({ isLoaded: true, error: false });
    return res;
  } catch (error) {
    void kyErrorHandler(error);
    onError?.(error);
    setter?.({ isLoaded: false, error: true });
    return null;
  }
}
