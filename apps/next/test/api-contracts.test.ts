import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

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

  it("stores an uploaded image in D1 and serves it through /image/[filename]", async () => {
    const storedImages = new Map<string, {
      contentType: string;
      chunkCount: number;
      chunks: { chunkIndex: number; data: string }[];
    }>();

    vi.doMock("~/lib/server/db", () => ({
      queryD1Batch: vi.fn(async (statements: Array<{ sql: string; params?: unknown[] }>) => {
        for (const statement of statements) {
          const params = statement.params ?? [];
          if (statement.sql.includes("INSERT INTO uploadedImages")) {
            storedImages.set(String(params[0]), {
              contentType: String(params[2]),
              chunkCount: Number(params[6]),
              chunks: [],
            });
          }

          if (statement.sql.includes("INSERT INTO uploadedImageChunks")) {
            const image = storedImages.get(String(params[0]));
            image?.chunks.push({
              chunkIndex: Number(params[1]),
              data: String(params[2]),
            });
          }
        }

        return statements.map(() => ({
          success: true,
          results: [],
          meta: { changes: 1 },
        }));
      }),
      queryD1: vi.fn(async (sql: string, params: unknown[]) => {
        const imageId = String(params[0]);
        const image = storedImages.get(imageId);
        if (!image) return [];

        if (sql.includes("FROM uploadedImages")) {
          return [{
            id: imageId,
            contentType: image.contentType,
            chunkCount: image.chunkCount,
          }];
        }

        if (sql.includes("FROM uploadedImageChunks")) {
          return image.chunks.toSorted((a, b) => a.chunkIndex - b.chunkIndex);
        }

        return [];
      }),
    }));

    const originalImage = await sharp({
      create: {
        width: 8,
        height: 4,
        channels: 3,
        background: "#ff0000",
      },
    }).png().toBuffer();

    const formData = new FormData();
    formData.set("file", new File([originalImage], "menu.png", { type: "image/png" }));

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
    expect(storedImages.get(storedFilename)).toMatchObject({
      contentType: "image/png",
      chunkCount: 1,
    });

    const { GET } = await import("~/app/image/[filename]/route");
    const readResponse = await GET(new Request(`http://order.test/image/${storedFilename}`), {
      params: Promise.resolve({ filename: storedFilename }),
    });

    expect(readResponse.status).toBe(200);
    expect(readResponse.headers.get("content-type")).toBe("image/png");
    const returnedImage = Buffer.from(await readResponse.arrayBuffer());
    const metadata = await sharp(returnedImage).metadata();
    expect(metadata.width).toBe(4);
    expect(metadata.height).toBe(4);
  });
});
