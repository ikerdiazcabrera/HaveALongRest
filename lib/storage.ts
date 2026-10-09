import "server-only";
import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { IMAGE_TYPES, sniffImageType } from "./image-type";

export { IMAGE_TYPES };

export const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export class UploadError extends Error {}

/**
 * Guarda una imagen y devuelve su URL pública.
 * Con BLOB_READ_WRITE_TOKEN (Vercel Blob) sube a la nube; si no, al disco local
 * (servido por app/api/files): suficiente para desarrollo.
 */
export async function saveImage(file: File, folder: string): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError("La imagen supera los 4 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw new UploadError("Formato no admitido (usa PNG, JPG, WebP o GIF)");

  const key = `${folder}/${randomUUID()}.${IMAGE_TYPES[type]}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, Buffer.from(bytes), { access: "public", contentType: type });
    return blob.url;
  }
  const target = path.join(UPLOAD_DIR, ...key.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return `/api/files/${key}`;
}
