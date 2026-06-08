"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import {
  putObject,
  removePrefix,
  sanitizeFilename,
} from "@/lib/supabase-storage";

export type PhotoActionResult = { ok: true } | { ok: false; error: string };

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 Mo (limite pratique Server Action)
const PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Téléverse / remplace la photo d'un agent. Stockage privé Supabase
 * (agents/{id}/photo_…), chemin conservé dans Agent.photoUrl. Renvoie toujours
 * un résultat typé (pas d'exception non gérée → pas de 500 opaque).
 */
export async function uploadAgentPhoto(
  agentId: string,
  formData: FormData,
): Promise<PhotoActionResult> {
  try {
    const me = await requireRole(Role.DIRECTION, Role.DRH);

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Aucune image sélectionnée." };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return {
        ok: false,
        error: `Image trop volumineuse (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 4 Mo.`,
      };
    }
    const mime = file.type || "";
    if (!PHOTO_MIME.has(mime)) {
      return { ok: false, error: "Format accepté : JPEG, PNG ou WebP." };
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true },
    });
    if (!agent) return { ok: false, error: "Agent introuvable." };

    // On purge l'ancienne photo (l'extension peut changer) puis on dépose.
    await removePrefix(`agents/${agentId}`);

    const path = `agents/${agentId}/photo_${sanitizeFilename(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const put = await putObject({
      path,
      buffer,
      contentType: mime,
      upsert: true,
    });
    if (!put.ok) return { ok: false, error: put.error };

    await prisma.agent.update({
      where: { id: agentId },
      data: { photoUrl: path },
    });

    await logAudit({
      userId: me.id,
      action: "UPLOAD_AGENT_PHOTO",
      entity: "Agent",
      entityId: agentId,
    });

    revalidatePath(`/personnel/${agentId}`);
    revalidatePath("/personnel");
    return { ok: true };
  } catch (e) {
    console.error("[uploadAgentPhoto] échec:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Échec du téléversement : ${msg}` };
  }
}

export async function deleteAgentPhoto(
  agentId: string,
): Promise<PhotoActionResult> {
  try {
    const me = await requireRole(Role.DIRECTION, Role.DRH);

    await removePrefix(`agents/${agentId}`);
    await prisma.agent.update({
      where: { id: agentId },
      data: { photoUrl: null },
    });

    await logAudit({
      userId: me.id,
      action: "DELETE_AGENT_PHOTO",
      entity: "Agent",
      entityId: agentId,
    });

    revalidatePath(`/personnel/${agentId}`);
    revalidatePath("/personnel");
    return { ok: true };
  } catch (e) {
    console.error("[deleteAgentPhoto] échec:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Échec : ${msg}` };
  }
}
