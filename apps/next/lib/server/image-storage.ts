import { ApiRequestError } from "~/lib/server/api";
import { queryD1, queryD1Batch } from "~/lib/server/db";
import sharp from "sharp";

const maxImageBytes = 5 * 1024 * 1024;
const maxBase64ChunkChars = 900_000;
const storedImageContentType = "image/png";
const storedImageExtension = "png";
const imageExtensions: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function getImageContentType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  return "application/octet-stream";
}

export function assertSafeImageFilename(filename: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes("..")) {
    throw new ApiRequestError("Invalid image filename", 400);
  }
}

export async function resizeImageToStoredPng(bytes: Uint8Array) {
  try {
    const rotated = await sharp(Buffer.from(bytes), {
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
  } catch {
    throw new ApiRequestError("Unsupported image data", 415);
  }
}

type StoredImageRow = {
  id: string;
  contentType: string;
  chunkCount: number;
};

type StoredImageChunkRow = {
  chunkIndex: number;
  data: string;
};

function chunkBase64(data: string) {
  const chunks: string[] = [];
  for (let index = 0; index < data.length; index += maxBase64ChunkChars) {
    chunks.push(data.slice(index, index + maxBase64ChunkChars));
  }
  return chunks;
}

function notFoundError() {
  const error = new Error("Image Not Found") as NodeJS.ErrnoException;
  error.code = "ENOENT";
  return error;
}

export async function saveUploadedImage(file: File) {
  const extension = imageExtensions[file.type];
  if (!extension) {
    throw new ApiRequestError("Unsupported image type", 415);
  }
  if (file.size > maxImageBytes) {
    throw new ApiRequestError("Image file too large", 413);
  }

  const filename = `${Date.now()}-${crypto.randomUUID()}.${storedImageExtension}`;
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const bytes = await resizeImageToStoredPng(originalBytes);
  const base64 = bytes.toString("base64");
  const chunks = chunkBase64(base64);
  const now = Date.now();

  await queryD1Batch([
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
      params: [
        filename,
        file.name || filename,
        storedImageContentType,
        storedImageExtension,
        bytes.byteLength,
        base64.length,
        chunks.length,
        now,
      ],
    },
    ...chunks.map((chunk, index) => ({
      sql: `
        INSERT INTO uploadedImageChunks (
          imageId,
          chunkIndex,
          data
        ) VALUES (?, ?, ?)
      `,
      params: [filename, index, chunk],
    })),
  ]);

  return filename;
}

export async function readStoredImage(filename: string) {
  assertSafeImageFilename(filename);
  const [image] = await queryD1<StoredImageRow>(
    "SELECT id, contentType, chunkCount FROM uploadedImages WHERE id = ?",
    [filename],
  );

  if (!image) {
    throw notFoundError();
  }

  const chunks = await queryD1<StoredImageChunkRow>(
    "SELECT chunkIndex, data FROM uploadedImageChunks WHERE imageId = ? ORDER BY chunkIndex ASC",
    [filename],
  );

  if (chunks.length !== image.chunkCount) {
    throw new ApiRequestError("Image data is incomplete", 500);
  }

  const ordered = chunks
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((chunk, index) => {
      if (chunk.chunkIndex !== index) {
        throw new ApiRequestError("Image data is incomplete", 500);
      }
      return chunk.data;
    })
    .join("");

  return {
    bytes: Buffer.from(ordered, "base64"),
    contentType: image.contentType || getImageContentType(filename),
  };
}
