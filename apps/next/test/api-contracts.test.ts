import { describe, expect, it } from "vitest";

type ContractCase = {
  label: string;
  importPath: string;
  method: string;
  args?: unknown[];
};

const placeholderContracts: ContractCase[] = [
  {
    label: "GET /api/order/[tableId]",
    importPath: "~/app/api/order/[tableId]/route",
    method: "GET",
    args: [
      new Request("http://order.test/api/order/table_123456789"),
      { params: Promise.resolve({ tableId: "table_123456789" }) },
    ],
  },
  {
    label: "GET /api/order/[tableId]/[orderId]",
    importPath: "~/app/api/order/[tableId]/[orderId]/route",
    method: "GET",
    args: [
      new Request("http://order.test/api/order/table_123456789/order_1234567"),
      {
        params: Promise.resolve({
          tableId: "table_123456789",
          orderId: "order_1234567",
        }),
      },
    ],
  },
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

describe("not-yet-migrated API contracts", () => {
  it.each(placeholderContracts)("$label advertises an explicit 501 migration placeholder", async (contract) => {
    const routeModule = (await import(contract.importPath)) as Record<
      string,
      (...args: unknown[]) => Promise<Response> | Response
    >;
    const response = await routeModule[contract.method](...(contract.args ?? []));
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toBe("NEXT_MIGRATION_NOT_IMPLEMENTED");
    expect(body.contract).toContain(contract.label.split(" ")[0]);
  });
});
