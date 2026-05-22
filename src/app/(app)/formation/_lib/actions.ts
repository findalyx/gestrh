"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EnrollmentStatus,
  Role,
  TrainingStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import {
  CourseSchema,
  CourseModuleSchema,
  SessionSchema,
  type CourseFormState,
  type CourseModuleFormState,
  type SessionFormState,
  type TrainingActionState,
} from "./schema";

// ============================================================
//  CRÉER UN COURS — DRH / DIRECTION
// ============================================================
export async function createCourse(
  _prev: CourseFormState | undefined,
  formData: FormData,
): Promise<CourseFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? ""),
    isInternal: formData.get("isInternal") === "on" ? "on" : "",
    instructor: String(formData.get("instructor") ?? ""),
    objectives: String(formData.get("objectives") ?? ""),
    durationHours: String(formData.get("durationHours") ?? ""),
  };

  const parsed = CourseSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }

  const created = await prisma.trainingCourse.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description || null,
      isInternal: parsed.data.isInternal ?? true,
      instructor: parsed.data.instructor || null,
      objectives: parsed.data.objectives || null,
      durationHours: parsed.data.durationHours ?? null,
    },
    select: { id: true, title: true },
  });

  await logAudit({
    userId: me.id,
    action: "CREATE_TRAINING_COURSE",
    entity: "TrainingCourse",
    entityId: created.id,
    details: created.title,
  });

  revalidatePath("/formation");
  redirect(`/formation/${created.id}`);
}

// ============================================================
//  CRÉER UNE SESSION — DRH / DIRECTION
// ============================================================
export async function createSession(
  _prev: SessionFormState | undefined,
  formData: FormData,
): Promise<SessionFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    courseId: String(formData.get("courseId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    location: String(formData.get("location") ?? ""),
    capacity: String(formData.get("capacity") ?? "20"),
    status: String(formData.get("status") ?? TrainingStatus.PLANIFIEE),
  };

  const parsed = SessionSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }

  // Vérifie que le cours existe
  const course = await prisma.trainingCourse.findUnique({
    where: { id: parsed.data.courseId },
    select: { id: true, title: true },
  });
  if (!course) {
    return { errors: { courseId: ["Cours introuvable"] }, values: raw };
  }

  const created = await prisma.trainingSession.create({
    data: {
      courseId: parsed.data.courseId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      location: parsed.data.location || null,
      capacity: parsed.data.capacity,
      status: parsed.data.status,
    },
    select: { id: true },
  });

  await logAudit({
    userId: me.id,
    action: "CREATE_TRAINING_SESSION",
    entity: "TrainingSession",
    entityId: created.id,
    details: `${course.title} · ${parsed.data.startDate} → ${parsed.data.endDate}`,
  });

  revalidatePath("/formation");
  revalidatePath(`/formation/${course.id}`);
  redirect(`/formation/${course.id}`);
}

// ============================================================
//  M'INSCRIRE À UNE SESSION
// ============================================================
export async function enrollSelf(
  sessionId: string,
  _prev: TrainingActionState,
  _formData: FormData,
): Promise<TrainingActionState> {
  const me = await getCurrentUser();
  if (!me.agent) {
    return { ok: false, error: "Compte non relié à un agent." };
  }

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      capacity: true,
      _count: { select: { enrollments: true } },
      course: { select: { id: true, title: true } },
    },
  });
  if (!session) return { ok: false, error: "Session introuvable." };

  if (session.status !== TrainingStatus.OUVERTE) {
    return { ok: false, error: "Les inscriptions ne sont pas ouvertes." };
  }
  if (session._count.enrollments >= session.capacity) {
    return { ok: false, error: "Session complète." };
  }

  // Empêche la double inscription
  const exists = await prisma.trainingEnrollment.count({
    where: { agentId: me.agent.id, sessionId },
  });
  if (exists > 0) {
    return { ok: false, error: "Vous êtes déjà inscrit(e) à cette session." };
  }

  const created = await prisma.trainingEnrollment.create({
    data: {
      agentId: me.agent.id,
      sessionId,
      status: EnrollmentStatus.INSCRIT,
    },
    select: { id: true },
  });

  await logAudit({
    userId: me.id,
    action: "ENROLL_TRAINING",
    entity: "TrainingEnrollment",
    entityId: created.id,
    details: session.course.title,
  });

  revalidatePath("/formation");
  revalidatePath(`/formation/${session.course.id}`);
  revalidatePath("/tableau-de-bord");
  return { ok: true, message: "Inscription enregistrée." };
}

// ============================================================
//  ME DÉSINSCRIRE D'UNE SESSION
// ============================================================
export async function unenrollSelf(
  enrollmentId: string,
  _prev: TrainingActionState,
  _formData: FormData,
): Promise<TrainingActionState> {
  const me = await getCurrentUser();

  const enrollment = await prisma.trainingEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      agentId: true,
      session: { select: { status: true, course: { select: { id: true, title: true } } } },
    },
  });
  if (!enrollment) return { ok: false, error: "Inscription introuvable." };

  const isMine = enrollment.agentId === me.agent?.id;
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  if (!isMine && !isAdmin) {
    return {
      ok: false,
      error: "Vous ne pouvez désinscrire que votre propre inscription.",
    };
  }

  if (
    enrollment.session.status === TrainingStatus.EN_COURS ||
    enrollment.session.status === TrainingStatus.TERMINEE
  ) {
    return {
      ok: false,
      error: "La session a déjà commencé — désinscription impossible.",
    };
  }

  await prisma.trainingEnrollment.delete({ where: { id: enrollmentId } });

  await logAudit({
    userId: me.id,
    action: "UNENROLL_TRAINING",
    entity: "TrainingEnrollment",
    entityId: enrollmentId,
    details: enrollment.session.course.title,
  });

  revalidatePath("/formation");
  revalidatePath(`/formation/${enrollment.session.course.id}`);
  revalidatePath("/tableau-de-bord");
  return { ok: true, message: "Désinscription effectuée." };
}

// ============================================================
//  CHANGER LE STATUT D'UNE SESSION — DRH / DIRECTION
// ============================================================
export async function setSessionStatus(
  sessionId: string,
  newStatus: TrainingStatus,
  _prev: TrainingActionState,
  _formData: FormData,
): Promise<TrainingActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      course: { select: { id: true, title: true } },
    },
  });
  if (!session) return { ok: false, error: "Session introuvable." };

  // Quand on bascule en TERMINEE, on marque les inscriptions encore INSCRIT/CONFIRME comme REALISE.
  if (newStatus === TrainingStatus.TERMINEE) {
    await prisma.$transaction([
      prisma.trainingSession.update({
        where: { id: sessionId },
        data: { status: newStatus },
      }),
      prisma.trainingEnrollment.updateMany({
        where: {
          sessionId,
          status: { in: [EnrollmentStatus.INSCRIT, EnrollmentStatus.CONFIRME] },
        },
        data: { status: EnrollmentStatus.REALISE },
      }),
    ]);
  } else {
    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { status: newStatus },
    });
  }

  await logAudit({
    userId: me.id,
    action: "SET_SESSION_STATUS",
    entity: "TrainingSession",
    entityId: sessionId,
    details: `${session.course.title} : ${session.status} → ${newStatus}`,
  });

  revalidatePath("/formation");
  revalidatePath(`/formation/${session.course.id}`);
  return { ok: true, message: `Statut mis à jour : ${newStatus}.` };
}

// ============================================================
//  METTRE À JOUR UN COURS — DRH / DIRECTION
// ============================================================
export async function updateCourse(
  courseId: string,
  _prev: CourseFormState | undefined,
  formData: FormData,
): Promise<CourseFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? ""),
    isInternal: formData.get("isInternal") === "on" ? "on" : "",
    instructor: String(formData.get("instructor") ?? ""),
    objectives: String(formData.get("objectives") ?? ""),
    durationHours: String(formData.get("durationHours") ?? ""),
  };
  const parsed = CourseSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }

  await prisma.trainingCourse.update({
    where: { id: courseId },
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description || null,
      isInternal: parsed.data.isInternal ?? true,
      instructor: parsed.data.instructor || null,
      objectives: parsed.data.objectives || null,
      durationHours: parsed.data.durationHours ?? null,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPDATE_TRAINING_COURSE",
    entity: "TrainingCourse",
    entityId: courseId,
    details: parsed.data.title,
  });

  revalidatePath("/formation");
  revalidatePath(`/formation/${courseId}`);
  return { ok: true, message: "Cours mis à jour." };
}

// ============================================================
//  AJOUTER UN MODULE PÉDAGOGIQUE — DRH / DIRECTION
// ============================================================
export async function addCourseModule(
  courseId: string,
  _prev: CourseModuleFormState | undefined,
  formData: FormData,
): Promise<CourseModuleFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    durationHours: String(formData.get("durationHours") ?? ""),
  };
  const parsed = CourseModuleSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }

  // Détermine l'ordre suivant
  const lastOrder = await prisma.courseModule.aggregate({
    where: { courseId },
    _max: { order: true },
  });
  const nextOrder = (lastOrder._max.order ?? -1) + 1;

  await prisma.courseModule.create({
    data: {
      courseId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      durationHours: parsed.data.durationHours ?? null,
      order: nextOrder,
    },
  });

  await logAudit({
    userId: me.id,
    action: "ADD_COURSE_MODULE",
    entity: "CourseModule",
    details: `${parsed.data.title} (cours ${courseId})`,
  });

  revalidatePath(`/formation/${courseId}`);
  return { ok: true };
}

// ============================================================
//  SUPPRIMER UN MODULE — DRH / DIRECTION
// ============================================================
export async function deleteCourseModule(
  moduleId: string,
  _prev: TrainingActionState,
  _formData: FormData,
): Promise<TrainingActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const m = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, title: true },
  });
  if (!m) return { ok: false, error: "Module introuvable." };

  await prisma.courseModule.delete({ where: { id: moduleId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_COURSE_MODULE",
    entity: "CourseModule",
    entityId: moduleId,
    details: m.title,
  });

  revalidatePath(`/formation/${m.courseId}`);
  return { ok: true, message: "Module supprimé." };
}
