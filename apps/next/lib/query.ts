import ky, { type SearchParamsOption } from "ky";
import kyErrorHandler from "~/lib/ky-error-handler";
import { useLoadingStore } from "~/stores/loading.store";

const API_BASE_PATH = "api";
const csrfCookieName = "yoncom_csrf";

function getApiPrefixUrl() {
  if (typeof window !== "undefined") {
    return new URL(`/${API_BASE_PATH}/`, window.location.origin).toString();
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
}

export const api = ky.create({
  prefixUrl: getApiPrefixUrl(),
  credentials: "include",
  retry: 0,
});

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;
}

export function mutationHeaders(headers: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const csrfToken = getCookie(csrfCookieName);

  if (csrfToken && !nextHeaders.has("x-csrf-token")) {
    nextHeaders.set("x-csrf-token", csrfToken);
  }

  if (!nextHeaders.has("idempotency-key")) {
    nextHeaders.set("idempotency-key", crypto.randomUUID());
  }

  return nextHeaders;
}

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

  const isQuery = method === "get" || method === "head";
  const { startQuery, endQuery, startMutation, endMutation } = useLoadingStore.getState();
  const requestHeaders = isQuery ? headers : mutationHeaders(headers);

  if (isQuery) {
    startQuery();
  } else {
    startMutation();
  }

  try {
    const res =
      method === "get" || method === "head"
        ? await api[method](route, {
            searchParams: query as SearchParamsOption,
            headers: requestHeaders,
          }).json<Result>()
        : await api[method](route, { json: query, headers: requestHeaders }).json<Result>();

    onSuccess?.(res);
    setter?.({ isLoaded: true, error: false });
    return res;
  } catch (error) {
    void kyErrorHandler(error);
    onError?.(error);
    setter?.({ isLoaded: false, error: true });
    return null;
  } finally {
    if (isQuery) {
      endQuery();
    } else {
      endMutation();
    }
  }
}
