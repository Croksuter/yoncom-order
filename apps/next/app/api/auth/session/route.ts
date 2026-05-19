import { NextResponse } from "next/server";
import { getSessionUser } from "~/lib/server/auth-session";
import { routeError } from "~/lib/server/api";

export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({ result: user ? "Success" : "No active session", user });
  } catch (error) {
    return routeError(error);
  }
}
