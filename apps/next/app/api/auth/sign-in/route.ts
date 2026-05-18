import { notMigrated } from "~/lib/server/responses";

export async function POST() {
  return notMigrated("POST /api/auth/sign-in", {
    schema: "AuthRequest.signInValidation",
  });
}
