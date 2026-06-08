"use server";

import { revalidatePath } from "next/cache";
import { Role, WellbeingStatus, WellbeingTopic } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/dal";

export type WellbeingPostResult = { ok: true } | { ok: false; error: string };

const MIN_LEN = 5;
const MAX_LEN = 2000;

/**
 * Dépôt d'un avis / idée — 100 % ANONYME. On exige seulement un utilisateur
 * connecté (anti-spam basique) mais AUCUN lien n'est conservé entre l'avis et
 * son auteur : seuls le sujet, le message et la date sont enregistrés.
 */
export async function submitWellbeingPost(
  formData: FormData,
): Promise<WellbeingPostResult> {
  try {
    await getCurrentUser(); // doit être connecté ; l'identité n'est PAS stockée

    const rawTopic = String(formData.get("topic") ?? "").trim();
    const topic = Object.values(WellbeingTopic).includes(
      rawTopic as WellbeingTopic,
    )
      ? (rawTopic as WellbeingTopic)
      : WellbeingTopic.AUTRE;

    const message = String(formData.get("message") ?? "").trim();
    if (message.length < MIN_LEN) {
      return { ok: false, error: "Votre message est trop court." };
    }
    if (message.length > MAX_LEN) {
      return { ok: false, error: `Message trop long (max ${MAX_LEN} caractères).` };
    }

    await prisma.wellbeingPost.create({
      data: { topic, message },
    });

    revalidatePath("/bien-etre");
    return { ok: true };
  } catch (e) {
    console.error("[submitWellbeingPost] échec:", e);
    return { ok: false, error: "Échec de l'envoi. Réessayez." };
  }
}

/** Triage DRH/Direction : marquer un avis Lu / Traité. */
export async function setWellbeingStatus(
  id: string,
  status: WellbeingStatus,
): Promise<WellbeingPostResult> {
  try {
    await requireRole(Role.DIRECTION, Role.DRH);
    await prisma.wellbeingPost.update({ where: { id }, data: { status } });
    revalidatePath("/bien-etre");
    return { ok: true };
  } catch (e) {
    console.error("[setWellbeingStatus] échec:", e);
    return { ok: false, error: "Action impossible." };
  }
}
