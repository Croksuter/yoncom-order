type TraceFields = Record<string, unknown>;

const tracePrefix = "[yoncom-trace]";
const traceIdHeader = "x-yoncom-trace-id";

export function isTraceEnabled() {
  return (
    process.env.NEXT_PUBLIC_YONCOM_TRACE === "1" ||
    process.env.YONCOM_TRACE === "1" ||
    process.env.NODE_ENV === "development"
  );
}

export function newTraceId(prefix = "trace") {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

export function getTraceHeaderName() {
  return traceIdHeader;
}

export function traceEvent(layer: "client" | "server" | "worker", event: string, fields: TraceFields = {}) {
  if (!isTraceEnabled()) return;

  const payload = {
    ts: new Date().toISOString(),
    clockMs: Date.now(),
    layer,
    event,
    ...fields,
  };

  console.log(`${tracePrefix} ${JSON.stringify(payload)}`);
}

export function traceDurationMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

export function summarizePath(input: string) {
  try {
    const url = new URL(input);
    return url.pathname;
  } catch {
    return input.split("?")[0] || input;
  }
}

export function summarizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim().slice(0, 180);
}
