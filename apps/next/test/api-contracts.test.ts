import { beforeEach, describe, expect, it, vi } from "vitest";

type ContractCase = {
  label: string;
  importPath: string;
  method: string;
  args?: unknown[];
};

const unavailableFeatureContracts: ContractCase[] = [
  { label: "GET /api/admin/payout", importPath: "~/app/api/admin/payout/route", method: "GET" },
  { label: "PUT /api/admin/image", importPath: "~/app/api/admin/image/route", method: "PUT" },
  {
    label: "GET /api/admin/menu/[menuId]",
    importPath: "~/app/api/admin/menu/[menuId]/route",
    method: "GET",
    args: [
      new Request("http://order.test/api/admin/menu/menu_1234567890"),
      { params: Promise.resolve({ menuId: "menu_1234567890" }) },
    ],
  },
];

describe("disabled optional API contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("~/lib/server/auth-session", () => ({
      requireAdmin: vi.fn(async () => null),
    }));
  });

  it.each(unavailableFeatureContracts)("$label returns an explicit feature-unavailable response", async (contract) => {
    const routeModule = (await import(contract.importPath)) as Record<
      string,
      (...args: unknown[]) => Promise<Response> | Response
    >;
    const response = await routeModule[contract.method](...(contract.args ?? []));
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toBe("FEATURE_UNAVAILABLE");
    expect(typeof body.feature).toBe("string");
  });
});
