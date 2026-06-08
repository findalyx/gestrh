"use server";

import { revalidatePath } from "next/cache";
import { DocumentType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { sanitizeFilename } from "@/lib/supabase-storage";
import {
  deleteAgentDocumentFolder,
  saveAgentDocumentFile,
  validateDocumentFile,
} from "@/lib/document-storage";

const DOC_TYPE_TITLE: Record<DocumentType, string> = {
  CONTRAT: "Contrat de travail",
  CONTRAT_SIGNE: "Contrat signé",
  AVENANT: "Avenant",
  AVENANT_SIGNE: "Avenant signé",
  DEMISSION: "Lettre de démission",
  NOTIFICATION_CONTRAT: "Notification contractuelle",
  DIPLOME: "Diplôme",
  CERTIFICATION: "Certification",
  BULLETIN_PAIE: "Bulletin de paie",
  JUSTIFICATIF: "Justificatif",
  CNI: "Carte nationale d'identité",
  CASIER_JUDICIAIRE: "Casier judiciaire — bulletin n°3",
  RIB: "Relevé d'identité bancaire",
  PHOTO: "Photo d'identité",
  CERTIFICAT_MEDICAL: "Certificat médical d'aptitude",
  CV: "Curriculum vitæ",
  AUTRE: "Document",
};

export type UploadDocumentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Téléverse une pièce justificative pour un agent. Le fichier est stocké sur
 * Supabase (documents/{id}/…) ; la base ne garde que les métadonnées.
 * Renvoie toujours un résultat typé (jamais d'exception non gérée) afin
 * d'éviter la réponse 500 opaque côté client et de remonter la vraie cause.
 */
export async function uploadAgentDocument(
  agentId: string,
  formData: FormData,
): Promise<UploadDocumentResult> {
  try {
    const me = await requireRole(Role.DIRECTION, Role.DRH);

    const rawType = String(formData.get("docType") ?? "").trim();
    if (!Object.values(DocumentType).includes(rawType as DocumentType)) {
      return { ok: false, error: "Type de document invalide." };
    }
    const docType = rawType as DocumentType;

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Aucun fichier sélectionné." };
    }
    const invalid = validateDocumentFile(file);
    if (invalid) return { ok: false, error: invalid };

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true },
    });
    if (!agent) return { ok: false, error: "Agent introuvable." };

    const customTitle = String(formData.get("title") ?? "").trim();

    // On crée la ligne d'abord (id requis pour le chemin de stockage), puis on
    // téléverse ; en cas d'échec d'upload on annule la ligne.
    const doc = await prisma.document.create({
      data: {
        type: docType,
        title: customTitle || DOC_TYPE_TITLE[docType] || file.name,
        fileName: sanitizeFilename(file.name),
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        agentId,
        uploadedById: me.id,
      },
      select: { id: true },
    });

    const saved = await saveAgentDocumentFile({ documentId: doc.id, file });
    if (!saved.ok) {
      await prisma.document.delete({ where: { id: doc.id } });
      return { ok: false, error: saved.error };
    }

    await logAudit({
      userId: me.id,
      action: "UPLOAD_AGENT_DOCUMENT",
      entity: "Document",
      entityId: doc.id,
      details: `${docType} · agent ${agentId}`,
    });

    revalidatePath(`/personnel/${agentId}/documents`);
    revalidatePath(`/personnel/${agentId}`);
    return { ok: true };
  } catch (e) {
    console.error("[uploadAgentDocument] échec:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Échec du téléversement : ${msg}` };
  }
}

export async function deleteAgentDocument(
  agentId: string,
  documentId: string,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, type: true, agentId: true },
  });
  if (!doc) throw new Error("Document introuvable.");

  await deleteAgentDocumentFolder(documentId);
  await prisma.document.delete({ where: { id: documentId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_AGENT_DOCUMENT",
    entity: "Document",
    entityId: documentId,
    details: `${doc.type} · agent ${agentId}`,
  });

  revalidatePath(`/personnel/${agentId}/documents`);
  revalidatePath(`/personnel/${agentId}`);
}
