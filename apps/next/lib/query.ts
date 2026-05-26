import ky, { type SearchParamsOption } from "ky";
import kyErrorHandler from "~/lib/ky-error-handler";
import { useLoadingStore } from "~/stores/loading.store";
import {
  getTraceHeaderName,
  newTraceId,
  summarizePath,
  traceDurationMs,
  traceEvent,
} from "~/lib/verification-trace";

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
  hooks: {
    beforeRequest: [
      (request) => {
        // Automatically inject CSRF and Idempotency Key for all unsafe mutating HTTP requests
        const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
        if (unsafeMethods.has(request.method.toUpperCase())) {
          const csrfToken = getCookie(csrfCookieName);
          if (csrfToken && !request.headers.has("x-csrf-token")) {
            request.headers.set("x-csrf-token", csrfToken);
          }
          if (!request.headers.has("idempotency-key")) {
            request.headers.set("idempotency-key", crypto.randomUUID());
          }
        }

        const traceHeader = getTraceHeaderName();
        if (!request.headers.has(traceHeader)) {
          request.headers.set(traceHeader, newTraceId("http"));
        }
        request.headers.set("x-yoncom-request-started-at", String(Date.now()));
        traceEvent("client", "http.request", {
          traceId: request.headers.get(traceHeader),
          method: request.method,
          path: summarizePath(request.url),
          hasIdempotencyKey: request.headers.has("idempotency-key"),
          hasCsrfToken: request.headers.has("x-csrf-token"),
        });
      },
    ],
    afterResponse: [
      (request, _options, response) => {
        const startedAt = Number(request.headers.get("x-yoncom-request-started-at") ?? Date.now());
        traceEvent("client", "http.response", {
          traceId: request.headers.get(getTraceHeaderName()),
          method: request.method,
          path: summarizePath(request.url),
          status: response.status,
          durationMs: traceDurationMs(startedAt),
        });
        return response;
      },
    ],
    beforeError: [
      (error) => {
        const request = error.request;
        const response = error.response;
        const startedAt = Number(request?.headers.get("x-yoncom-request-started-at") ?? Date.now());
        traceEvent("client", "http.error", {
          traceId: request?.headers.get(getTraceHeaderName()),
          method: request?.method,
          path: request ? summarizePath(request.url) : undefined,
          status: response?.status,
          durationMs: traceDurationMs(startedAt),
        });
        return error;
      },
    ],
  },
});

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  let cookieValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;

  // Self-healing CSRF: if the cookie is missing, generate and set a new one
  if (!cookieValue && name === csrfCookieName) {
    const newCsrfToken = crypto.randomUUID();
    document.cookie = `${csrfCookieName}=${newCsrfToken}; path=/; max-age=604800; SameSite=Lax`;
    cookieValue = newCsrfToken;
  }

  return cookieValue;
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

  if (!nextHeaders.has(getTraceHeaderName())) {
    nextHeaders.set(getTraceHeaderName(), newTraceId("mutation"));
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
  const startedAt = Date.now();

  traceEvent("client", "store.request.start", {
    route,
    method,
    mode: isQuery ? "query" : "mutation",
    traceId: new Headers(requestHeaders).get(getTraceHeaderName()),
  });

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
    traceEvent("client", "store.request.success", {
      route,
      method,
      mode: isQuery ? "query" : "mutation",
      durationMs: traceDurationMs(startedAt),
    });
    return res;
  } catch (error) {
    void kyErrorHandler(error);
    onError?.(error);
    setter?.({ isLoaded: false, error: true });
    traceEvent("client", "store.request.error", {
      route,
      method,
      mode: isQuery ? "query" : "mutation",
      durationMs: traceDurationMs(startedAt),
    });
    return null;
  } finally {
    if (isQuery) {
      endQuery();
    } else {
      endMutation();
    }
  }
}
