import { describe, expect, it } from "vitest";

type ContractCase = {
  label: string;
  importPath: string;
  method: string;
  args?: unknown[];
};

const placeholderContracts: ContractCase[] = [
  { label: "POST /api/auth/sign-in", importPath: "~/app/api/auth/sign-in/route", method: "POST" },
  { label: "POST /api/auth/sign-up", importPath: "~/app/api/auth/sign-up/route", method: "POST" },
  { label: "POST /api/auth/sign-out", importPath: "~/app/api/auth/sign-out/route", method: "POST" },
  { label: "GET /api/auth/session", importPath: "~/app/api/auth/session/route", method: "GET" },
  { label: "POST /api/order", importPath: "~/app/api/order/route", method: "POST" },
  { label: "DELETE /api/order", importPath: "~/app/api/order/route", method: "DELETE" },
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
  { label: "POST /api/admin/deposit", importPath: "~/app/api/admin/deposit/route", method: "POST" },
  { label: "PUT /api/admin/image", importPath: "~/app/api/admin/image/route", method: "PUT" },
  { label: "POST /api/admin/menu", importPath: "~/app/api/admin/menu/route", method: "POST" },
  { label: "PUT /api/admin/menu", importPath: "~/app/api/admin/menu/route", method: "PUT" },
  { label: "DELETE /api/admin/menu", importPath: "~/app/api/admin/menu/route", method: "DELETE" },
  {
    label: "GET /api/admin/menu/[menuId]",
    importPath: "~/app/api/admin/menu/[menuId]/route",
    method: "GET",
    args: [
      new Request("http://order.test/api/admin/menu/menu_1234567890"),
      { params: Promise.resolve({ menuId: "menu_1234567890" }) },
    ],
  },
  {
    label: "POST /api/admin/menuCategory",
    importPath: "~/app/api/admin/menuCategory/route",
    method: "POST",
  },
  {
    label: "PUT /api/admin/menuCategory",
    importPath: "~/app/api/admin/menuCategory/route",
    method: "PUT",
  },
  {
    label: "DELETE /api/admin/menuCategory",
    importPath: "~/app/api/admin/menuCategory/route",
    method: "DELETE",
  },
  { label: "POST /api/admin/table", importPath: "~/app/api/admin/table/route", method: "POST" },
  { label: "PUT /api/admin/table", importPath: "~/app/api/admin/table/route", method: "PUT" },
  { label: "DELETE /api/admin/table", importPath: "~/app/api/admin/table/route", method: "DELETE" },
  {
    label: "PUT /api/admin/table/occupy",
    importPath: "~/app/api/admin/table/occupy/route",
    method: "PUT",
  },
  {
    label: "PUT /api/admin/table/vacate",
    importPath: "~/app/api/admin/table/vacate/route",
    method: "PUT",
  },
  { label: "PUT /api/admin/order", importPath: "~/app/api/admin/order/route", method: "PUT" },
  { label: "DELETE /api/admin/order", importPath: "~/app/api/admin/order/route", method: "DELETE" },
  {
    label: "PUT /api/admin/order/cancel",
    importPath: "~/app/api/admin/order/cancel/route",
    method: "PUT",
  },
  {
    label: "PUT /api/admin/order/complete",
    importPath: "~/app/api/admin/order/complete/route",
    method: "PUT",
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
