export const API_BASE_PATH = "/api";

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path.startsWith("/") ? path : `${API_BASE_PATH}/${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });

  const data = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new Error(
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : `Request failed with ${response.status}`,
    );
  }

  return data as T;
}
