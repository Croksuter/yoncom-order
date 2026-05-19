import { NextResponse } from "next/server";

type Details = Record<string, unknown>;

export function featureUnavailable(feature: string, details: Details = {}) {
  return NextResponse.json(
    {
      error: "FEATURE_UNAVAILABLE",
      feature,
      details,
    },
    { status: 501 },
  );
}

export function apiHealth() {
  return NextResponse.json({
    result: "Next API is Healthy",
    runtime: "next",
  });
}
