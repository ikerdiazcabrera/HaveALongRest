"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/actions/uploads";

/** Botón que sube una imagen a la campaña y devuelve su URL. */
export function ImageUploadButton({
  campaignId,
  onUploaded,
  label = "Subir imagen",
  className = "btn btn-secondary btn-sm",
}: {
  campaignId: string;
  onUploaded: (url: string, file: File) => void;
  label?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setBusy(true);
    setError(null);
    const data = new FormData();
    data.set("campaignId", campaignId);
    data.set("file", file);
    try {
      const result = await uploadImage(data);
      if ("error" in result) setError(result.error);
      else onUploaded(result.url, file);
    } catch {
      setError("No se pudo subir la imagen");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Subiendo…" : label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handle(file);
        }}
      />
      {error && <span className="text-xs text-red-300">{error}</span>}
    </span>
  );
}

/** Campo de formulario con la URL de una imagen de portada (input oculto `name`). */
export function CoverField({
  name,
  campaignId,
  initial,
  onChange,
}: {
  name: string;
  campaignId: string;
  initial: string | null;
  onChange?: (url: string) => void;
}) {
  const [url, setUrlState] = useState(initial ?? "");
  const setUrl = (value: string) => {
    setUrlState(value);
    onChange?.(value);
  };
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={url} />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Portada" className="h-36 w-full max-w-md rounded-lg border border-line object-cover" />
      ) : (
        <div className="themed-bg flex h-36 w-full max-w-md items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-3">
          Sin portada
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <ImageUploadButton campaignId={campaignId} onUploaded={setUrl} label={url ? "Cambiar imagen" : "Subir imagen"} />
        {url && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUrl("")}>
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
