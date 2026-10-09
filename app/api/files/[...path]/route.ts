import { readFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_TYPES, UPLOAD_DIR } from "@/lib/storage";

const CONTENT_TYPES = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([type, ext]) => [ext, type]));

/** Sirve las imágenes subidas en desarrollo (en producción se usan URLs de Vercel Blob). */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  if (segments.some((s) => !/^[\w.-]+$/.test(s) || s.startsWith("."))) {
    return new Response("No encontrado", { status: 404 });
  }
  const file = path.join(UPLOAD_DIR, ...segments);
  const type = CONTENT_TYPES[path.extname(file).slice(1)];
  if (!type || !file.startsWith(UPLOAD_DIR + path.sep)) return new Response("No encontrado", { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
