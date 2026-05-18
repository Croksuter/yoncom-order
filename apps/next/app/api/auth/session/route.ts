import { notMigrated } from "~/lib/server/responses";

export async function GET() {
  return notMigrated("GET /api/auth/session", {
    dependency: "Lucia session cookie",
  });
}
