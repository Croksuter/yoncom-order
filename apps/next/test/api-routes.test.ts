import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("implemented Next API route handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("GET /api/menu returns menu categories from the DB query layer", async () => {
    const findMany = vi.fn(async () => [
      {
        id: "category_123456",
        name: "Meals",
        description: "Main dishes",
        menus: [],
      },
    ]);
    vi.doMock("~/lib/server/db", () => ({
      getDb: () => ({
        query: {
          menuCategories: {
            findMany,
          },
        },
      }),
    }));

    const { GET } = await import("~/app/api/menu/route");
    const response = await GET(new Request("http://order.test/api/menu"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: [
        {
          id: "category_123456",
          name: "Meals",
          description: "Main dishes",
          menus: [],
        },
      ],
    });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("GET /api/table validates the visible query string before DB access", async () => {
    const { GET } = await import("~/app/api/table/route");
    const response = await GET(new Request("http://order.test/api/table?tableId=too-short"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request" });
  });

  it("GET /api/admin/table returns the app-facing table relation payload", async () => {
    vi.doMock("~/lib/server/auth-session", () => ({
      requireAdmin: vi.fn(async () => null),
    }));
    vi.doMock("~/lib/server/table-queries", () => ({
      getTablesWithRelations: vi.fn(async () => [
        {
          id: "table_123456789",
          name: "A1",
          seats: 4,
          key: 1,
          createdAt: 1710000000000,
          updatedAt: 1710000000000,
          deletedAt: null,
          tableContexts: [],
        },
      ]),
    }));

    const { GET } = await import("~/app/api/admin/table/route");
    const response = await GET(new Request("http://order.test/api/admin/table"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: [
        {
          id: "table_123456789",
          name: "A1",
          seats: 4,
          key: 1,
          createdAt: 1710000000000,
          updatedAt: 1710000000000,
          deletedAt: null,
          tableContexts: [],
        },
      ],
    });
  });

  it("all admin API route handlers are wired through requireAdmin", () => {
    const routeFiles: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const target = join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(target);
        } else if (entry.name === "route.ts") {
          routeFiles.push(target);
        }
      }
    };

    walk(join(process.cwd(), "app/api/admin"));

    expect(routeFiles.length).toBeGreaterThan(0);
    for (const routeFile of routeFiles) {
      const source = readFileSync(routeFile, "utf8");
      expect(source, routeFile).toContain("requireAdmin");
      expect(source, routeFile).toContain("await requireAdmin()");
    }
  });
});
