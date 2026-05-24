import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type ContractCase = {
  label: string;
  importPath: string;
  method: string;
  args?: unknown[];
};

const unavailableFeatureContracts: ContractCase[] = [
  { label: "GET /api/admin/payout", importPath: "~/app/api/admin/payout/route", method: "GET" },
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
      csrfCookieName: "yoncom_csrf",
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

describe("admin image upload contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("~/lib/server/auth-session", () => ({
      csrfCookieName: "yoncom_csrf",
      requireAdmin: vi.fn(async () => null),
    }));
  });

  it("stores an uploaded image and serves it through /image/[filename]", async () => {
    const uploadDir = await mkdtemp(path.join(tmpdir(), "yoncom-image-test-"));
    vi.stubEnv("YONCOM_IMAGE_UPLOAD_DIR", uploadDir);

    try {
      const formData = new FormData();
      formData.set("file", new File([new Uint8Array([137, 80, 78, 71])], "menu.png", { type: "image/png" }));

      const { PUT } = await import("~/app/api/admin/image/route");
      const uploadResponse = await PUT(new Request("http://order.test/api/admin/image", {
        method: "PUT",
        headers: {
          origin: "http://order.test",
          cookie: "yoncom_csrf=csrf-token",
          "x-csrf-token": "csrf-token",
          "idempotency-key": "test-idempotency-key",
        },
        body: formData,
      }));

      expect(uploadResponse.status).toBe(200);
      const uploadBody = await uploadResponse.json();
      expect(uploadBody.result.filename).toMatch(/^\/image\/.+\.png$/);

      const storedFilename = uploadBody.result.filename.replace("/image/", "");
      await expect(readFile(path.join(uploadDir, storedFilename))).resolves.toEqual(Buffer.from([137, 80, 78, 71]));

      const { GET } = await import("~/app/image/[filename]/route");
      const readResponse = await GET(new Request(`http://order.test/image/${storedFilename}`), {
        params: Promise.resolve({ filename: storedFilename }),
      });

      expect(readResponse.status).toBe(200);
      expect(readResponse.headers.get("content-type")).toBe("image/png");
      expect(Array.from(new Uint8Array(await readResponse.arrayBuffer()))).toEqual([137, 80, 78, 71]);
    } finally {
      vi.unstubAllEnvs();
      await rm(uploadDir, { recursive: true, force: true });
    }
  });
});
