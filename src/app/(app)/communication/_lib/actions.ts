"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import {
  deleteAnnouncementAttachmentFile,
  deleteAnnouncementFolder,
  saveAnnouncementAttachment,
} from "@/lib/attachment-storage";
import { createSignedUploadUrl, sanitizeFilename } from "@/lib/supabase-storage";

function guessAttachMime(filename: string): string {
  switch (filename.split(".").pop()?.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

const AnnouncementSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court").max(140),
  body: z.string().trim().min(5, "Contenu trop court").max(4000),
});

export type AnnouncementFormState = {
  errors?: Partial<Record<"title" | "body" | "_form", string[]>>;
  values?: { title?: string; body?: string };
  ok?: boolean;
  message?: string;
};

export type CommunicationActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

// ============================================================
//  HELPER : sauvegarder les fichiers joints d'un FormData
// ============================================================
async function saveAttachmentsFromForm(
  announcementId: string,
  formData: FormData,
): Promise<{ saved: number; warnings: string[] }> {
  const files = formData.getAll("attachments");
  let saved = 0;
  const warnings: string[] = [];

  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;
    const result = await saveAnnouncementAttachment({ announcementId, file: f });
    if (!result.ok) {
      warnings.push(`${f.name} : ${result.error}`);
      continue;
    }
    await prisma.announcementAttachment.create({
      data: {
        announcementId,
        filename: result.filename,
        mimeType: result.mimeType,
        size: result.size,
      },
    });
    saved++;
  }
  return { saved, warnings };
}

// ============================================================
//  PUBLIER UNE ANNONCE — DIRECTION + DRH
// ============================================================
export async function publishAnnouncement(
  _prev: AnnouncementFormState | undefined,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  };
  const parsed = AnnouncementSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }

  const created = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      authorId: me.id,
    },
    select: { id: true },
  });

  const { saved, warnings } = await saveAttachmentsFromForm(created.id, formData);

  await logAudit({
    userId: me.id,
    action: "PUBLISH_ANNOUNCEMENT",
    entity: "Announcement",
    entityId: created.id,
    details: `${parsed.data.title}${saved > 0 ? ` · ${saved} pièce(s) jointe(s)` : ""}`,
  });

  revalidatePath("/communication");
  revalidatePath(`/communication/${created.id}`);

  if (warnings.length > 0) {
    return {
      ok: true,
      message: `Annonce publiée. Attention : ${warnings.join(", ")}`,
    };
  }
  redirect(`/communication/${created.id}`);
}

// ============================================================
//  METTRE À JOUR UNE ANNONCE — auteur ou admin
// ============================================================
export async function updateAnnouncement(
  announcementId: string,
  _prev: AnnouncementFormState | undefined,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const me = await getCurrentUser();

  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, authorId: true, title: true },
  });
  if (!ann) {
    return { errors: { _form: ["Annonce introuvable."] } };
  }

  const isAuthor = ann.authorId === me.id;
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  if (!isAuthor && !isAdmin) {
    return { errors: { _form: ["Vous ne pouvez modifier que vos propres annonces."] } };
  }

  const raw = {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  };
  const parsed = AnnouncementSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }

  await prisma.announcement.update({
    where: { id: announcementId },
    data: { title: parsed.data.title, body: parsed.data.body },
  });

  // Pièces jointes additionnelles éventuelles
  const { saved, warnings } = await saveAttachmentsFromForm(
    announcementId,
    formData,
  );

  await logAudit({
    userId: me.id,
    action: "UPDATE_ANNOUNCEMENT",
    entity: "Announcement",
    entityId: announcementId,
    details: `${parsed.data.title}${saved > 0 ? ` · +${saved} pièce(s) jointe(s)` : ""}`,
  });

  revalidatePath("/communication");
  revalidatePath(`/communication/${announcementId}`);
  return {
    ok: true,
    message:
      warnings.length > 0
        ? `Annonce mise à jour. Attention : ${warnings.join(", ")}`
        : "Annonce mise à jour.",
  };
}

// ============================================================
//  SUPPRIMER UNE ANNONCE — auteur ou admin
// ============================================================
export async function deleteAnnouncement(
  announcementId: string,
  _prev: CommunicationActionState,
  _formData: FormData,
): Promise<CommunicationActionState> {
  const me = await getCurrentUser();

  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, title: true, authorId: true },
  });
  if (!ann) return { ok: false, error: "Annonce introuvable." };

  const isAuthor = ann.authorId === me.id;
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  if (!isAuthor && !isAdmin) {
    return { ok: false, error: "Vous ne pouvez supprimer que vos propres annonces." };
  }

  await prisma.announcement.delete({ where: { id: announcementId } });
  await deleteAnnouncementFolder(announcementId);

  await logAudit({
    userId: me.id,
    action: "DELETE_ANNOUNCEMENT",
    entity: "Announcement",
    entityId: announcementId,
    details: ann.title,
  });

  revalidatePath("/communication");
  redirect("/communication");
}

// ============================================================
//  UPLOAD DIRECT D'UNE PIÈCE JOINTE (jusqu'à 20 Mo) — annonce existante
// ============================================================
export async function requestAttachmentUpload(
  announcementId: string,
  filename: string,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  await requireRole(Role.DIRECTION, Role.DRH);
  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true },
  });
  if (!ann) return { ok: false, error: "Annonce introuvable." };

  const clean = sanitizeFilename(filename) || "fichier";
  // Nom unique pour éviter toute collision dans le dossier de l'annonce.
  const unique = `${Date.now()}-${clean}`;
  return createSignedUploadUrl(`announcements/${announcementId}/${unique}`);
}

export async function finalizeAttachmentUpload(
  announcementId: string,
  path: string,
  _filename: string,
  size: number,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);
  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true },
  });
  if (!ann) return { ok: false, error: "Annonce introuvable." };

  // Le nom réellement stocké = dernier segment du chemin (avec préfixe unique).
  const storedName = path.split("/").pop() || sanitizeFilename(_filename);
  await prisma.announcementAttachment.create({
    data: {
      announcementId,
      filename: storedName,
      mimeType: guessAttachMime(storedName),
      size,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_ANNOUNCEMENT_ATTACHMENT",
    entity: "AnnouncementAttachment",
    details: `annonce ${announcementId} · ${storedName} (${Math.round(size / 1024)} Ko)`,
  });

  revalidatePath(`/communication/${announcementId}`);
  revalidatePath("/communication");
  return { ok: true, message: "Pièce jointe ajoutée." };
}

// ============================================================
//  SUPPRIMER UNE PIÈCE JOINTE — auteur ou admin
// ============================================================
export async function deleteAttachment(
  attachmentId: string,
  _prev: CommunicationActionState,
  _formData: FormData,
): Promise<CommunicationActionState> {
  const me = await getCurrentUser();

  const att = await prisma.announcementAttachment.findUnique({
    where: { id: attachmentId },
    include: { announcement: { select: { authorId: true, id: true } } },
  });
  if (!att) return { ok: false, error: "Pièce jointe introuvable." };

  const isAuthor = att.announcement.authorId === me.id;
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  if (!isAuthor && !isAdmin) {
    return { ok: false, error: "Action non autorisée." };
  }

  await prisma.announcementAttachment.delete({ where: { id: attachmentId } });
  await deleteAnnouncementAttachmentFile({
    announcementId: att.announcement.id,
    filename: att.filename,
  });

  await logAudit({
    userId: me.id,
    action: "DELETE_ATTACHMENT",
    entity: "AnnouncementAttachment",
    entityId: attachmentId,
    details: att.filename,
  });

  revalidatePath("/communication");
  revalidatePath(`/communication/${att.announcement.id}`);
  return { ok: true, message: "Pièce jointe supprimée." };
}
