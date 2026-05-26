import type { UserRole } from "db/schema";

export type PublicSessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type HeartBeat = {
  result: string;
  user: PublicSessionUser | null;
}
