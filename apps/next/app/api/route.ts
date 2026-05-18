import { migrationHealth } from "~/lib/server/responses";

export function GET() {
  return migrationHealth();
}
