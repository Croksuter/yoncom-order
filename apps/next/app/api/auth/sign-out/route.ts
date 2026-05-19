import { clearAuthResponse } from "~/lib/server/auth-session";

export async function POST() {
  return clearAuthResponse({ result: "Success" });
}
