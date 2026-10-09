"use server";

import { canEditPages } from "@/lib/permissions";
import { LIMITS, rateLimit, retryMessage } from "@/lib/rate-limit";
import { saveImage, UploadError } from "@/lib/storage";
import { ActionError, getActor } from "./shared";

/** Sube una imagen para una campaña (solo el equipo de máster). */
export async function uploadImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  try {
    const { user, campaign, viewer } = await getActor(formData.get("campaignId"));
    if (!canEditPages(viewer)) return { error: "Solo el equipo de máster puede subir imágenes" };
    const limited = await rateLimit(`upload:${user.id}`, ...LIMITS.uploadPerUser);
    if (!limited.ok) return { error: retryMessage(limited.retryAfterSeconds) };
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "No se ha recibido ninguna imagen" };
    return { url: await saveImage(file, `campaigns/${campaign.id}`) };
  } catch (e) {
    if (e instanceof ActionError || e instanceof UploadError) return { error: e.message };
    throw e;
  }
}
