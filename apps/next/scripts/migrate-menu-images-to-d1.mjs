import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const root = resolve(appDir, "../..");
const dryRun = process.argv.includes("--dry-run");
const contentType = "image/png";
const extension = "png";
const maxBase64ChunkChars = 900_000;

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((rawLine) => rawLine.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();

        if (
          (value.startsWith("\"") && value.endsWith("\"")) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        return [key, value];
      }),
  );
}

const env = {
  ...parseEnvFile(join(root, ".env")),
  ...parseEnvFile(join(root, ".env.local")),
  ...process.env,
};

const accountId = env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = env.CLOUDFLARE_DATABASE_ID;
const token = env.CLOUDFLARE_D1_TOKEN;

if (!accountId || !databaseId || !token) {
  throw new Error("Cloudflare D1 env vars are required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN");
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

async function query(sql, params = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json().catch(() => null);
  const result = payload?.result?.[0];

  if (!response.ok || !payload?.success || !result?.success) {
    const message =
      result?.error ??
      payload?.errors?.map((error) => error.message).join(", ") ??
      `D1 query failed with ${response.status}`;
    throw new Error(message);
  }

  return result.results ?? [];
}

async function batch(statements) {
  if (statements.length === 0) {
    return [];
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(statements.length === 1 ? statements[0] : { batch: statements }),
  });
  const payload = await response.json().catch(() => null);
  const results = payload?.result ?? [];
  const failed = results.find((result) => !result.success);

  if (!response.ok || !payload?.success || failed || results.length === 0) {
    const message =
      failed?.error ??
      payload?.errors?.map((error) => error.message).join(", ") ??
      `D1 batch failed with ${response.status}`;
    throw new Error(message);
  }

  return results;
}

async function tableExists(tableName) {
  const rows = await query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [tableName]);
  return rows.length > 0;
}

async function ensureImageTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS uploadedImages (
      id text PRIMARY KEY NOT NULL,
      originalName text NOT NULL,
      contentType text NOT NULL,
      extension text NOT NULL,
      byteSize integer NOT NULL,
      base64Size integer NOT NULL,
      chunkCount integer NOT NULL,
      createdAt integer NOT NULL
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS uploadedImageChunks (
      imageId text NOT NULL,
      chunkIndex integer NOT NULL,
      data text NOT NULL,
      PRIMARY KEY(imageId, chunkIndex),
      FOREIGN KEY (imageId) REFERENCES uploadedImages(id) ON UPDATE no action ON DELETE cascade
    )
  `);
}

function chunkBase64(data) {
  const chunks = [];
  for (let index = 0; index < data.length; index += maxBase64ChunkChars) {
    chunks.push(data.slice(index, index + maxBase64ChunkChars));
  }
  return chunks;
}

async function normalizeToStoredPng(bytes) {
  const rotated = await sharp(bytes, {
    animated: false,
    limitInputPixels: 50_000_000,
  })
    .rotate()
    .toBuffer();
  const metadata = await sharp(rotated).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error("Image dimensions are unavailable");
  }

  const size = Math.min(width, height);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);

  return await sharp(rotated)
    .extract({ left, top, width: size, height: size })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function readD1ImageRecord(imageId) {
  const [image] = await query(
    "SELECT id, originalName, contentType, chunkCount FROM uploadedImages WHERE id = ?",
    [imageId],
  );
  if (!image) {
    return null;
  }

  const chunks = await query(
    "SELECT chunkIndex, data FROM uploadedImageChunks WHERE imageId = ? ORDER BY chunkIndex ASC",
    [imageId],
  );
  if (chunks.length !== Number(image.chunkCount)) {
    return null;
  }

  return {
    bytes: Buffer.from(chunks.map((chunk) => chunk.data).join(""), "base64"),
    originalName: String(image.originalName ?? ""),
  };
}

async function readD1Image(imageId) {
  return (await readD1ImageRecord(imageId))?.bytes ?? null;
}

async function hasCompleteD1Image(imageId) {
  return (await readD1Image(imageId)) !== null;
}

async function saveD1Image(imageId, sourceName, bytes) {
  const base64 = bytes.toString("base64");
  const chunks = chunkBase64(base64);
  const now = Date.now();

  await batch([
    {
      sql: "DELETE FROM uploadedImageChunks WHERE imageId = ?",
      params: [imageId],
    },
    {
      sql: "DELETE FROM uploadedImages WHERE id = ?",
      params: [imageId],
    },
    {
      sql: `
        INSERT INTO uploadedImages (
          id,
          originalName,
          contentType,
          extension,
          byteSize,
          base64Size,
          chunkCount,
          createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [imageId, sourceName, contentType, extension, bytes.byteLength, base64.length, chunks.length, now],
    },
    ...chunks.map((chunk, index) => ({
      sql: "INSERT INTO uploadedImageChunks (imageId, chunkIndex, data) VALUES (?, ?, ?)",
      params: [imageId, index, chunk],
    })),
  ]);
}

function localImageCandidates(imageId) {
  const paths = [];
  const uploadDir = env.YONCOM_IMAGE_UPLOAD_DIR;

  if (uploadDir) {
    paths.push(resolve(uploadDir, imageId));
  }
  paths.push(resolve(root, ".data/images", imageId));
  paths.push(resolve(appDir, ".data/images", imageId));

  return paths;
}

async function loadImageSource(image, menu) {
  if (image.startsWith("data:image/")) {
    const match = image.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Unsupported data URL image format");
    }
    return { bytes: Buffer.from(match[2], "base64"), sourceName: `${menu.id}-data-url` };
  }

  if (image.startsWith("/image/")) {
    const imageId = image.slice("/image/".length).split("?")[0];
    const d1Bytes = await readD1Image(imageId);
    if (d1Bytes) {
      return { bytes: d1Bytes, sourceName: imageId };
    }

    for (const candidate of localImageCandidates(imageId)) {
      if (existsSync(candidate)) {
        return { bytes: readFileSync(candidate), sourceName: basename(candidate) };
      }
    }

    throw new Error(`Missing local/D1 image for ${image}`);
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    const response = await fetch(image, {
      headers: { "user-agent": "yoncom-order-image-migration/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`Image fetch failed with ${response.status}`);
    }
    return { bytes: Buffer.from(await response.arrayBuffer()), sourceName: image };
  }

  for (const candidate of localImageCandidates(image)) {
    if (existsSync(candidate)) {
      return { bytes: readFileSync(candidate), sourceName: basename(candidate) };
    }
  }

  for (const candidate of [
    resolve(root, image.replace(/^\/+/, "")),
    resolve(appDir, image.replace(/^\/+/, "")),
    resolve(root, "public", image.replace(/^\/+/, "")),
  ]) {
    if (existsSync(candidate)) {
      return { bytes: readFileSync(candidate), sourceName: basename(candidate) };
    }
  }

  throw new Error(`Unsupported image reference ${image}`);
}

async function loadMenuImage(menu) {
  const image = String(menu.image ?? "").trim();
  if (!image || image === "/favicon.ico") {
    return null;
  }

  if (image.startsWith("/image/")) {
    const imageId = image.slice("/image/".length).split("?")[0];
    const d1Record = await readD1ImageRecord(imageId);

    if (d1Record?.originalName && d1Record.originalName !== imageId && d1Record.originalName !== image) {
      try {
        return await loadImageSource(d1Record.originalName, menu);
      } catch {
        // Fall back to current D1 bytes if the original source is no longer reachable.
      }
    }

    if (d1Record) {
      return { bytes: d1Record.bytes, sourceName: d1Record.originalName || imageId };
    }

    for (const candidate of localImageCandidates(imageId)) {
      if (existsSync(candidate)) {
        return { bytes: readFileSync(candidate), sourceName: basename(candidate) };
      }
    }

    throw new Error(`Missing local/D1 image for ${image}`);
  }

  return await loadImageSource(image, menu);
}

async function getMenus() {
  if (!(await tableExists("menus"))) {
    throw new Error("menus table does not exist");
  }

  return await query(
    `SELECT id, name, image FROM ${quoteIdentifier("menus")} WHERE image IS NOT NULL AND image != '' ORDER BY id`,
  );
}

async function migrateMenu(menu) {
  const loaded = await loadMenuImage(menu);
  if (!loaded) {
    return { status: "skipped", id: menu.id, name: menu.name, reason: "empty image" };
  }

  const normalized = await normalizeToStoredPng(loaded.bytes);
  const metadata = await sharp(normalized).metadata();
  if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
    throw new Error("normalized image dimensions are invalid");
  }

  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 20);
  const imageId = `menu-${menu.id}-${hash}.${extension}`;
  const nextImage = `/image/${imageId}`;
  const alreadyStored = await hasCompleteD1Image(imageId);

  if (!dryRun && !alreadyStored) {
    await saveD1Image(imageId, loaded.sourceName, normalized);
  }

  if (!dryRun && menu.image !== nextImage) {
    await query(
      `UPDATE ${quoteIdentifier("menus")} SET image = ?, updatedAt = ? WHERE id = ?`,
      [nextImage, Date.now(), menu.id],
    );
  }

  return {
    status: menu.image === nextImage && alreadyStored ? "unchanged" : dryRun ? "would-update" : "updated",
    id: menu.id,
    name: menu.name,
    image: nextImage,
  };
}

async function main() {
  await ensureImageTables();
  const menus = await getMenus();
  const results = [];

  for (const menu of menus) {
    try {
      results.push(await migrateMenu(menu));
    } catch (error) {
      results.push({
        status: "failed",
        id: menu.id,
        name: menu.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ dryRun, total: results.length, counts, results }, null, 2));

  if (results.some((result) => result.status === "failed")) {
    process.exitCode = 1;
  }
}

await main();
