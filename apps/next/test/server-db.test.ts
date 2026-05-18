import { describe, expect, it, vi } from "vitest";
import { d1Failure, d1Success, installD1FetchMock, stubCloudflareEnv } from "./helpers/d1";

describe("Cloudflare D1 HTTP adapter", () => {
  it("sends SQL, params, and bearer token to the Cloudflare D1 query endpoint", async () => {
    stubCloudflareEnv();
    const { requests } = installD1FetchMock(() => d1Success([{ id: "menu_1" }]));

    const { queryD1 } = await import("~/lib/server/db");
    const rows = await queryD1("SELECT * FROM menus WHERE id = ?", ["menu_1"]);

    expect(rows).toEqual([{ id: "menu_1" }]);
    expect(requests).toEqual([
      {
        url: "https://api.cloudflare.com/client/v4/accounts/account_123/d1/database/database_456/query",
        method: "POST",
        authorization: "Bearer token_789",
        sql: "SELECT * FROM menus WHERE id = ?",
        params: ["menu_1"],
      },
    ]);
  });

  it("checks D1 table presence through sqlite_master", async () => {
    stubCloudflareEnv();
    const { requests } = installD1FetchMock(() => d1Success([{ name: "tableContext" }]));

    const { hasD1Table } = await import("~/lib/server/db");
    await expect(hasD1Table("tableContext")).resolves.toBe(true);

    expect(requests[0].sql).toBe(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    );
    expect(requests[0].params).toEqual(["tableContext"]);
  });

  it("surfaces D1 API failures to route handlers without returning fake data", async () => {
    stubCloudflareEnv();
    installD1FetchMock(() => d1Failure("no such table: tableContexts"));

    const { queryD1 } = await import("~/lib/server/db");
    await expect(queryD1("SELECT * FROM tableContexts")).rejects.toThrow(
      "no such table: tableContexts",
    );
  });

  it("rejects account ids that look like emails before sending a network request", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "owner@example.com");
    vi.stubEnv("CLOUDFLARE_DATABASE_ID", "database_456");
    vi.stubEnv("CLOUDFLARE_D1_TOKEN", "token_789");
    const { fetchMock } = installD1FetchMock(() => d1Success([]));

    const { queryD1 } = await import("~/lib/server/db");
    await expect(queryD1("SELECT 1")).rejects.toThrow(
      "Cloudflare D1 configuration is invalid",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rebuilds the D1 client when env values change during a dev session", async () => {
    stubCloudflareEnv();
    const { requests } = installD1FetchMock(() => d1Success([]));

    const { queryD1 } = await import("~/lib/server/db");
    await queryD1("SELECT 1");

    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account_999");
    await queryD1("SELECT 2");

    expect(requests.map((request) => request.url)).toEqual([
      "https://api.cloudflare.com/client/v4/accounts/account_123/d1/database/database_456/query",
      "https://api.cloudflare.com/client/v4/accounts/account_999/d1/database/database_456/query",
    ]);
  });
});
