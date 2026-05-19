import { apiHealth } from "~/lib/server/responses";

export function GET() {
  return apiHealth();
}
