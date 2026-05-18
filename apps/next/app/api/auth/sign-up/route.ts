import { notMigrated } from "~/lib/server/responses";

export async function POST() {
  return notMigrated("POST /api/auth/sign-up", {
    schema: "AuthRequest.signUpValidation",
  });
}
