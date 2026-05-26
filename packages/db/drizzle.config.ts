import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envPath = existsSync(resolve(__dirname, "../../.env.local"))
  ? resolve(__dirname, "../../.env.local")
  : resolve(__dirname, "../../.env");

config({ path: envPath });

export default {
  schema: "./schema.ts",
  out: "./.migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
} satisfies Config;
