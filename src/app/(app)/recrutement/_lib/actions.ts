"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApplicationStage, JobStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { deleteCvFolder, saveCvFile } from "@/lib/cv-storage";
import { createSignedUploadUrl, sanitizeFilename } from "@/lib/supabase-storage";

function guessCvMime(filename: string): string {
  switch (filename.split(".").pop()?.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

export type CvUploadState =
  | { ok: true; message: string }
  | { ok: false; error: string };

// ============================================================
//  UPLOAD DIRECT DU CV (jusqu'à 20 Mo) — sur une candidature existante
// ============================================================
export async function requestCvUpload(
  applicationId: string,
  filename: string,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  await requireRole(Role.DIRECTION, Role.DRH);
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true },
  });
  if (!app) return { ok: false, error: "Candidature introuvable." };

  await deleteCvFolder(applicationId); // un seul CV par candidature
  const clean = sanitizeFilename(filename) || "cv.pdf";
  return createSignedUploadUrl(`cvs/${applicationId}/${clean}`);
}

export async function finalizeCvUpload(
  applicationId: string,
  _path: string,
  filename: string,
  size: number,
): Promise<CvUploadState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, jobPostingId: true },
  });
  if (!app) return { ok: false, error: "Candidature introuvable." };

  const clean = sanitizeFilename(filename) || "cv.pdf";
  await prisma.application.update({
    where: { id: applicationId },
    data: { cvFilename: clean, cvMimeType: guessCvMime(clean), cvSize: size },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_CV",
    entity: "Application",
    entityId: applicationId,
    details: `${clean} (${Math.round(size / 1024)} Ko)`,
  });

  revalidatePath(`/recrutement/${app.jobPostingId}/candidat/${applicationId}`);
  return { ok: true, message: "CV enregistré." };
}
import {
  ApplicationSchema,
  JobPostingSchema,
  nextStage,
  type ApplicationFormState,
  type JobPostingFormState,
  type RecruitmentActionState,
} from "./schema";

// ============================================================
//  CRÉER UNE OFFRE — DRH / DIRECTION
// ============================================================
export async function createJobPosting(
  _prev: JobPostingFormState | undefined,
  formData: FormData,
): Promise<JobPostingFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    openings: String(formData.get("openings") ?? "1"),
    serviceId: String(formData.get("serviceId") ?? ""),
    closesAt: String(formData.get("closesAt") ?? ""),
  };

  const parsed = JobPostingSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }

  const created = await prisma.jobPosting.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category,
      openings: parsed.data.openings,
      serviceId: parsed.data.serviceId || null,
      closesAt: parsed.data.closesAt ? new Date(parsed.data.closesAt) : null,
      status: JobStatus.OUVERT,
    },
    select: { id: true, title: true },
  });

  await logAudit({
    userId: me.id,
    action: "CREATE_JOB_POSTING",
    entity: "JobPosting",
    entityId: created.id,
    details: created.title,
  });

  revalidatePath("/recrutement");
  redirect(`/recrutement/${created.id}`);
}

// ============================================================
//  CLÔTURER UNE OFFRE — DRH / DIRECTION
// ============================================================
export async function closeJobPosting(
  postingId: string,
  _prev: RecruitmentActionState,
  _formData: FormData,
): Promise<RecruitmentActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const posting = await prisma.jobPosting.findUnique({
    where: { id: postingId },
    select: { id: true, title: true, status: true },
  });
  if (!posting) return { ok: false, error: "Offre introuvable." };

  if (posting.status === JobStatus.FERME) {
    return { ok: false, error: "L'offre est déjà fermée." };
  }

  await prisma.jobPosting.update({
    where: { id: postingId },
    data: { status: JobStatus.FERME },
  });

  await logAudit({
    userId: me.id,
    action: "CLOSE_JOB_POSTING",
    entity: "JobPosting",
    entityId: postingId,
    details: posting.title,
  });

  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${postingId}`);
  return { ok: true, message: "Offre clôturée." };
}

// ============================================================
//  RÉ-OUVRIR UNE OFFRE — DRH / DIRECTION
// ============================================================
export async function reopenJobPosting(
  postingId: string,
  _prev: RecruitmentActionState,
  _formData: FormData,
): Promise<RecruitmentActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const posting = await prisma.jobPosting.findUnique({
    where: { id: postingId },
    select: { id: true, title: true, status: true },
  });
  if (!posting) return { ok: false, error: "Offre introuvable." };

  if (posting.status === JobStatus.OUVERT) {
    return { ok: false, error: "L'offre est déjà ouverte." };
  }

  await prisma.jobPosting.update({
    where: { id: postingId },
    data: { status: JobStatus.OUVERT },
  });

  await logAudit({
    userId: me.id,
    action: "REOPEN_JOB_POSTING",
    entity: "JobPosting",
    entityId: postingId,
    details: posting.title,
  });

  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${postingId}`);
  return { ok: true, message: "Offre ré-ouverte." };
}

// ============================================================
//  AJOUTER UN CANDIDAT — DRH / DIRECTION
// ============================================================
export async function addApplication(
  postingId: string,
  _prev: ApplicationFormState | undefined,
  formData: FormData,
): Promise<ApplicationFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    candidateName: String(formData.get("candidateName") ?? ""),
    candidateEmail: String(formData.get("candidateEmail") ?? ""),
    candidatePhone: String(formData.get("candidatePhone") ?? ""),
    cvUrl: String(formData.get("cvUrl") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = ApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }

  // Vérifie que l'offre existe et est ouverte
  const posting = await prisma.jobPosting.findUnique({
    where: { id: postingId },
    select: { id: true, title: true, status: true },
  });
  if (!posting) {
    return { errors: { _form: ["Offre introuvable."] }, values: raw };
  }
  if (posting.status !== JobStatus.OUVERT && posting.status !== JobStatus.EN_COURS) {
    return {
      errors: { _form: ["Impossible d'ajouter un candidat à une offre fermée."] },
      values: raw,
    };
  }

  const created = await prisma.application.create({
    data: {
      jobPostingId: postingId,
      candidateName: parsed.data.candidateName,
      candidateEmail: parsed.data.candidateEmail,
      candidatePhone: parsed.data.candidatePhone || null,
      cvUrl: parsed.data.cvUrl || null,
      notes: parsed.data.notes || null,
      stage: ApplicationStage.CANDIDATURE,
    },
    select: { id: true },
  });

  // Si un fichier CV est joint, on le sauvegarde sur disque
  const cvFile = formData.get("cvFile");
  if (cvFile instanceof File && cvFile.size > 0) {
    const result = await saveCvFile({ applicationId: created.id, file: cvFile });
    if (!result.ok) {
      // Le candidat est créé mais le CV n'a pas pu être stocké : on signale l'erreur
      // sans bloquer l'inscription du candidat.
      return {
        errors: { _form: [`Candidat enregistré, mais le CV n'a pas pu être joint : ${result.error}`] },
      };
    }
    await prisma.application.update({
      where: { id: created.id },
      data: {
        cvFilename: result.filename,
        cvMimeType: result.mimeType,
        cvSize: result.size,
      },
    });
  }

  await logAudit({
    userId: me.id,
    action: "ADD_APPLICATION",
    entity: "Application",
    entityId: created.id,
    details: `${parsed.data.candidateName} pour « ${posting.title} »`,
  });

  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${postingId}`);
  return {};
}

// ============================================================
//  FAIRE AVANCER UN CANDIDAT DANS LE PIPELINE
// ============================================================
export async function advanceApplication(
  applicationId: string,
  _prev: RecruitmentActionState,
  _formData: FormData,
): Promise<RecruitmentActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      stage: true,
      candidateName: true,
      jobPostingId: true,
    },
  });
  if (!app) return { ok: false, error: "Candidature introuvable." };

  if (app.stage === ApplicationStage.REJETE) {
    return { ok: false, error: "Candidature rejetée — ne peut plus avancer." };
  }

  const next = nextStage(app.stage);
  if (!next) {
    return { ok: false, error: "Cette candidature est déjà à la dernière étape." };
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { stage: next },
  });

  // Si on vient de recruter, on vérifie si l'offre doit passer en POURVU.
  // (La transition automatique vers EN_COURS a été retirée : OUVERT et
  // EN_COURS sont fusionnés visuellement sous "En cours".)
  if (next === ApplicationStage.RECRUTE) {
    const posting = await prisma.jobPosting.findUnique({
      where: { id: app.jobPostingId },
      select: { openings: true, status: true },
    });
    if (posting && posting.status !== JobStatus.POURVU) {
      const recruitedCount = await prisma.application.count({
        where: {
          jobPostingId: app.jobPostingId,
          stage: ApplicationStage.RECRUTE,
        },
      });
      if (recruitedCount >= posting.openings) {
        await prisma.jobPosting.update({
          where: { id: app.jobPostingId },
          data: { status: JobStatus.POURVU },
        });
      }
    }
  }

  await logAudit({
    userId: me.id,
    action: "ADVANCE_APPLICATION",
    entity: "Application",
    entityId: applicationId,
    details: `${app.candidateName} : ${app.stage} → ${next}`,
  });

  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${app.jobPostingId}`);
  return { ok: true, message: `Avancé en ${next}.` };
}

// ============================================================
//  REJETER UN CANDIDAT
// ============================================================
export async function rejectApplication(
  applicationId: string,
  _prev: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      stage: true,
      candidateName: true,
      jobPostingId: true,
      notes: true,
    },
  });
  if (!app) return { ok: false, error: "Candidature introuvable." };

  if (app.stage === ApplicationStage.REJETE) {
    return { ok: false, error: "Déjà rejetée." };
  }
  if (app.stage === ApplicationStage.RECRUTE) {
    return { ok: false, error: "Un candidat recruté ne peut pas être rejeté." };
  }

  const reason = String(formData.get("reason") ?? "").trim();

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      stage: ApplicationStage.REJETE,
      notes: reason
        ? `${app.notes ? app.notes + "\n\n" : ""}Motif du rejet : ${reason}`
        : app.notes,
    },
  });

  await logAudit({
    userId: me.id,
    action: "REJECT_APPLICATION",
    entity: "Application",
    entityId: applicationId,
    details: `${app.candidateName}${reason ? ` · motif="${reason}"` : ""}`,
  });

  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${app.jobPostingId}`);
  return { ok: true, message: "Candidature rejetée." };
}

// ============================================================
//  AJOUTER UNE NOTE SUR UNE CANDIDATURE — DRH / DIRECTION
//  La note est horodatée et associée à l'étape courante du pipeline.
// ============================================================
export async function addApplicationNote(
  applicationId: string,
  _prev: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 3) {
    return { ok: false, error: "Note trop courte (min 3 caractères)." };
  }
  if (body.length > 2000) {
    return { ok: false, error: "Note trop longue (max 2000 caractères)." };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, jobPostingId: true, stage: true, candidateName: true },
  });
  if (!app) return { ok: false, error: "Candidature introuvable." };

  await prisma.applicationNote.create({
    data: {
      applicationId,
      body,
      stage: app.stage,
      authorId: me.id,
    },
  });

  await logAudit({
    userId: me.id,
    action: "ADD_APPLICATION_NOTE",
    entity: "ApplicationNote",
    entityId: applicationId,
    details: `${app.candidateName} · étape ${app.stage}`,
  });

  revalidatePath(`/recrutement/${app.jobPostingId}/candidat/${applicationId}`);
  return { ok: true, message: "Note ajoutée." };
}

// ============================================================
//  SUPPRIMER UNE NOTE — DRH / DIRECTION
// ============================================================
export async function deleteApplicationNote(
  noteId: string,
  _prev: RecruitmentActionState,
  _formData: FormData,
): Promise<RecruitmentActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const note = await prisma.applicationNote.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      applicationId: true,
      application: { select: { jobPostingId: true } },
    },
  });
  if (!note) return { ok: false, error: "Note introuvable." };

  await prisma.applicationNote.delete({ where: { id: noteId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_APPLICATION_NOTE",
    entity: "ApplicationNote",
    entityId: noteId,
  });

  revalidatePath(
    `/recrutement/${note.application.jobPostingId}/candidat/${note.applicationId}`,
  );
  return { ok: true, message: "Note supprimée." };
}

// ============================================================
//  PLANIFIER UN ENTRETIEN
// ============================================================
export async function setInterviewDate(
  applicationId: string,
  _prev: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const dateStr = String(formData.get("interviewAt") ?? "").trim();
  if (!dateStr) {
    return { ok: false, error: "Date d'entretien requise." };
  }
  const interviewAt = new Date(dateStr);
  if (Number.isNaN(interviewAt.getTime())) {
    return { ok: false, error: "Date invalide." };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, candidateName: true, jobPostingId: true },
  });
  if (!app) return { ok: false, error: "Candidature introuvable." };

  await prisma.application.update({
    where: { id: applicationId },
    data: { interviewAt },
  });

  await logAudit({
    userId: me.id,
    action: "SET_INTERVIEW_DATE",
    entity: "Application",
    entityId: applicationId,
    details: `${app.candidateName} · ${dateStr}`,
  });

  revalidatePath(`/recrutement/${app.jobPostingId}`);
  return { ok: true, message: "Date d'entretien enregistrée." };
}
