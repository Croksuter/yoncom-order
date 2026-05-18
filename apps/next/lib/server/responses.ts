import { NextResponse } from "next/server";

type Details = Record<string, unknown>;

export function notMigrated(contract: string, details: Details = {}) {
  return NextResponse.json(
    {
      error: "NEXT_MIGRATION_NOT_IMPLEMENTED",
      contract,
      details,
    },
    { status: 501 },
  );
}

export function migrationHealth() {
  return NextResponse.json({
    result: "Next API is Healthy",
    migrated: false,
    mutation: false,
  });
}
