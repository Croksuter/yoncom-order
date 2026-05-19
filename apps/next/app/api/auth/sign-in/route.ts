import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { Scrypt } from "lucia";
import { users } from "db/schema";
import { signInValidation } from "shared/types/requests/client/auth";
import { authResponse } from "~/lib/server/auth-session";
import { getDb } from "~/lib/server/db";
import { routeError } from "~/lib/server/api";

export async function POST(request: Request) {
  try {
    const { email, password } = signInValidation.parse(await request.json());
    const user = await getDb().query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !(await new Scrypt().verify(user.password, password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return authResponse({ result: "Success" }, user.id);
  } catch (error) {
    return routeError(error);
  }
}
