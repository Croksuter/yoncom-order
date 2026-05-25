import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateId, Scrypt } from "lucia";
import { users } from "db/schema";
import { signUpValidation } from "shared/types/requests/client/auth";
import { getDb } from "~/lib/server/db";
import { guardUnsafeRequest, parseJsonBody, routeError } from "~/lib/server/api";

export async function POST(request: Request) {
  const guardError = guardUnsafeRequest(request, { csrf: false, idempotency: false });
  if (guardError) return guardError;

  try {
    const { email, password, name } = await parseJsonBody(request, signUpValidation);
    const existingUser = await getDb().query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return NextResponse.json({ error: "User with that email already exists." }, { status: 400 });
    }

    await getDb().insert(users).values({
      id: generateId(15),
      email,
      password: await new Scrypt().hash(password),
      name,
    });

    return NextResponse.json({ result: "Success" });
  } catch (error) {
    return routeError(error);
  }
}
