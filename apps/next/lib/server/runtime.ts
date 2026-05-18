export type MigrationRuntimeDecision =
  | "cloudflare-next-runtime"
  | "provider-migration"
  | "phased-external-api";

export const runtimeDecision: MigrationRuntimeDecision = "phased-external-api";

export const runtimeNotes = [
  "Current API depends on Cloudflare D1 binding DB.",
  "Current image upload/read depends on Cloudflare R2 binding R2_BUCKET.",
  "This Next.js workspace starts with route parity and does not assume those bindings exist.",
] as const;
