import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/d1";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "db/schema";

type D1ApiRow = Record<string, unknown>;

type D1ApiQueryResult<T = D1ApiRow> = {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
  error?: string;
};

type D1ApiResponse<T = D1ApiRow> = {
  success: boolean;
  errors?: { code?: number; message: string }[];
  messages?: { code?: number; message: string }[];
  result?: D1ApiQueryResult<T>[];
};

class D1HttpPreparedStatement {
  constructor(
    private readonly database: D1HttpDatabase,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new D1HttpPreparedStatement(this.database, this.sql, params);
  }

  async all<T = D1ApiRow>() {
    return this.database.query<T>(this.sql, this.params);
  }

  async run<T = D1ApiRow>() {
    return this.database.query<T>(this.sql, this.params);
  }

  async first<T = D1ApiRow>(column?: string) {
    const result = await this.database.query<T>(this.sql, this.params);
    const first = result.results?.[0] ?? null;

    if (first && column && typeof first === "object" && column in first) {
      return first[column as keyof T] as T[keyof T];
    }

    return first;
  }

  async raw<T = unknown>() {
    const result = await this.database.query<Record<string, T>>(this.sql, this.params);
    return (result.results ?? []).map((row) => Object.values(row));
  }

  toD1Query() {
    return { sql: this.sql, params: this.params };
  }
}

class D1HttpDatabase {
  private readonly endpoint: string;

  constructor(
    accountId: string,
    databaseId: string,
    private readonly token: string,
  ) {
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  }

  prepare(sql: string) {
    return new D1HttpPreparedStatement(this, sql);
  }

  async batch<T = D1ApiRow>(statements: D1HttpPreparedStatement[]) {
    return this.queryBatch<T>(statements.map((statement) => statement.toD1Query()));
  }

  async exec(sql: string) {
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    const results = await this.queryBatch(statements.map((statement) => ({ sql: statement, params: [] })));
    return {
      count: results.reduce((count, result) => count + (result.results?.length ?? 0), 0),
      duration: results.reduce((duration, result) => duration + Number(result.meta?.duration ?? 0), 0),
    };
  }

  async query<T = D1ApiRow>(sql: string, params: unknown[]): Promise<D1ApiQueryResult<T>> {
    return (await this.queryBatch<T>([{ sql, params }]))[0];
  }

  async queryBatch<T = D1ApiRow>(
    statements: Array<{ sql: string; params: unknown[] }>,
  ): Promise<Array<D1ApiQueryResult<T>>> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(statements.length === 1 ? statements[0] : { batch: statements }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as D1ApiResponse<T> | null;
    const results = payload?.result ?? [];
    const failed = results.find((result) => !result.success);

    if (!response.ok || !payload?.success || failed || results.length === 0) {
      const message =
        failed?.error ??
        payload?.errors?.map((error) => error.message).join(", ") ??
        `D1 query failed with ${response.status}`;
      throw new Error(message);
    }

    return results;
  }
}

let cachedD1: D1HttpDatabase | null = null;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let envLoaded = false;
let cachedConfigKey: string | null = null;

const d1EnvKeys = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_DATABASE_ID",
  "CLOUDFLARE_D1_TOKEN",
] as const;

type D1Config = Record<(typeof d1EnvKeys)[number], string>;

function ensureEnvLoaded() {
  if (envLoaded) {
    return;
  }

  loadEnvConfig(resolve(process.cwd(), "../.."));
  envLoaded = true;
}

export function getDb() {
  const { database, configKey } = getD1Database();

  if (cachedDb && cachedConfigKey === configKey) {
    return cachedDb;
  }

  cachedDb = drizzle(database as never, {
    schema,
  });
  cachedConfigKey = configKey;
  return cachedDb;
}

function getD1Database() {
  ensureEnvLoaded();
  applyLocalEnvOverrides();

  const config = readD1Config();
  const configKey = d1EnvKeys.map((key) => config[key]).join(":");

  if (cachedD1 && cachedConfigKey === configKey) {
    return { database: cachedD1, configKey };
  }

  cachedD1 = new D1HttpDatabase(
    config.CLOUDFLARE_ACCOUNT_ID,
    config.CLOUDFLARE_DATABASE_ID,
    config.CLOUDFLARE_D1_TOKEN,
  );
  cachedDb = null;
  cachedConfigKey = configKey;

  return { database: cachedD1, configKey };
}

function readD1Config(): D1Config {
  const config = Object.fromEntries(
    d1EnvKeys.map((key) => [key, process.env[key] ?? ""]),
  ) as D1Config;

  if (!config.CLOUDFLARE_ACCOUNT_ID || !config.CLOUDFLARE_DATABASE_ID || !config.CLOUDFLARE_D1_TOKEN) {
    throw new Error("Cloudflare D1 environment variables are not configured.");
  }

  if (config.CLOUDFLARE_ACCOUNT_ID.includes("@")) {
    throw new Error("Cloudflare D1 configuration is invalid: account id must not be an email.");
  }

  return config;
}

function applyLocalEnvOverrides() {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    return;
  }

  for (const envFile of [".env", ".env.local"]) {
    const envPath = resolve(process.cwd(), "../..", envFile);
    if (!existsSync(envPath)) {
      continue;
    }

    for (const [key, value] of parseEnvFile(envPath)) {
      if (d1EnvKeys.includes(key as (typeof d1EnvKeys)[number])) {
        process.env[key] = value;
      }
    }
  }
}

function parseEnvFile(envPath: string) {
  const content = readFileSync(envPath, "utf8");
  const mtime = statSync(envPath).mtimeMs;
  const values: [string, string][] = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    values.push([key, value]);
  }

  // Touching the stat value makes the dependency on file freshness explicit
  // without leaking env values into logs or cache keys.
  void mtime;
  return values;
}

export async function queryD1<T = D1ApiRow>(sql: string, params: unknown[] = []) {
  const result = await queryD1Result<T>(sql, params);
  return result.results ?? [];
}

export async function queryD1Result<T = D1ApiRow>(sql: string, params: unknown[] = []) {
  const { database } = getD1Database();
  return await database.query<T>(sql, params);
}

export async function queryD1Batch<T = D1ApiRow>(
  statements: Array<{ sql: string; params?: unknown[] }>,
) {
  const { database } = getD1Database();
  return await database.queryBatch<T>(
    statements.map((statement) => ({
      sql: statement.sql,
      params: statement.params ?? [],
    })),
  );
}

export async function executeD1(sql: string, params: unknown[] = []) {
  const result = await queryD1Result(sql, params);
  const meta = result.meta ?? {};
  const changed =
    Number(meta.changes ?? meta.changed_db ?? meta.rows_written ?? meta.rowsWritten ?? 0) ||
    (Array.isArray(result.results) ? result.results.length : 0);

  return {
    changed,
    meta,
    results: result.results ?? [],
  };
}

export async function hasD1Table(name: string) {
  const rows = await queryD1<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name],
  );
  return rows.length > 0;
}
