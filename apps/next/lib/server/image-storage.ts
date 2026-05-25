import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiRequestError } from "~/lib/server/api";

const maxImageBytes = 5 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getImageStorageDir() {
  return process.env.YONCOM_IMAGE_UPLOAD_DIR
    ? path.resolve(process.env.YONCOM_IMAGE_UPLOAD_DIR)
    : path.join(process.cwd(), ".data", "images");
}

export function getImageContentType(filename: string) {
  const extension = path.extname(filename).slice(1).toLowerCase();
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

export async function saveUploadedImage(file: File) {
  const extension = imageExtensions[file.type];
  if (!extension) {
    throw new ApiRequestError("Unsupported image type", 415);
  }
  if (file.size > maxImageBytes) {
    throw new ApiRequestError("Image file too large", 413);
  }

  const storageDir = getImageStorageDir();
  await mkdir(storageDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(path.join(storageDir, filename), bytes);

  return filename;
}

export async function readStoredImage(filename: string) {
  assertSafeImageFilename(filename);
  return readFile(path.join(getImageStorageDir(), filename));
}
