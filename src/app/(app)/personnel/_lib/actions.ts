"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, Role, StaffCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { removePrefix } from "@/lib/supabase-storage";
import { AgentFormSchema, type AgentFormState } from "./schema";

/**
 * Génère le prochain matricule pour une catégorie (PER-XXXX / PATS-XXXX).
 * Lit le plus grand numéro existant et incrémente. Tournée en transaction
 * pour éviter les courses sur la création concurrente.
 */
async function nextMatricule(
  tx: Prisma.TransactionClient,
  category: StaffCategory,
): Promise<string> {
  const prefix = `${category}-`;
  const last = await tx.agent.findFirst({
    where: { matricule: { startsWith: prefix } },
    orderBy: { matricule: "desc" },
    select: { matricule: true },
  });

  let next = 1;
  if (last) {
    const num = Number.parseInt(last.matricule.slice(prefix.length), 10);
    if (!Number.isNaN(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function rawFormValues(formData: FormData) {
  return {
    matricule: String(formData.get("matricule") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    birthPlace: String(formData.get("birthPlace") ?? ""),
    nationality: String(formData.get("nationality") ?? ""),
    maritalStatus: String(formData.get("maritalStatus") ?? ""),
    category: String(formData.get("category") ?? ""),
    subCategory: String(formData.get("subCategory") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    serviceId: String(formData.get("serviceId") ?? ""),
    status: String(formData.get("status") ?? "ACTIF"),
    hireDate: String(formData.get("hireDate") ?? ""),
  };
}

export async function createAgent(
  _prev: AgentFormState | undefined,
  formData: FormData,
): Promise<AgentFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = rawFormValues(formData);
  const parsed = AgentFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }
  const data = parsed.data;

  // Email unique
  const existing = await prisma.agent.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) {
    return {
      errors: { email: ["Un agent avec cet email existe déjà"] },
      values: raw,
    };
  }

  // Matricule explicite (ex. pour rattacher des bulletins) : doit être unique.
  const wantedMatricule = data.matricule ? data.matricule.trim() : "";
  if (wantedMatricule) {
    const clash = await prisma.agent.findUnique({
      where: { matricule: wantedMatricule },
      select: { id: true },
    });
    if (clash) {
      return {
        errors: { matricule: ["Ce matricule est déjà utilisé par un autre agent"] },
        values: raw,
      };
    }
  }

  let createdId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const matricule = wantedMatricule || (await nextMatricule(tx, data.category));
      const created = await tx.agent.create({
        data: {
          matricule,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
          gender: data.gender,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
          birthPlace: data.birthPlace || null,
          nationality: data.nationality || null,
          maritalStatus: data.maritalStatus || null,
          category: data.category,
          subCategory: data.subCategory,
          jobTitle: data.jobTitle,
          serviceId: data.serviceId,
          status: data.status,
          hireDate: new Date(data.hireDate),
        },
        select: { id: true, matricule: true },
      });
      return created;
    });
    createdId = result.id;

    await logAudit({
      userId: me.id,
      action: "CREATE_AGENT",
      entity: "Agent",
      entityId: createdId,
      details: `matricule=${result.matricule} ${data.firstName} ${data.lastName}`,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return {
          errors: { matricule: ["Ce matricule est déjà utilisé par un autre agent"] },
          values: raw,
        };
      }
      if (e.code === "P2003") {
        return {
          errors: { serviceId: ["Service introuvable"] },
          values: raw,
        };
      }
    }
    throw e;
  }

  revalidatePath("/personnel");
  redirect(`/personnel/${createdId}`);
}

export async function updateAgent(
  agentId: string,
  _prev: AgentFormState | undefined,
  formData: FormData,
): Promise<AgentFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = rawFormValues(formData);
  const parsed = AgentFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }
  const data = parsed.data;

  // Email unique (sauf le sien)
  const sameEmail = await prisma.agent.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (sameEmail && sameEmail.id !== agentId) {
    return {
      errors: { email: ["Un autre agent utilise déjà cet email"] },
      values: raw,
    };
  }

  try {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        address: data.address || null,
        gender: data.gender,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        birthPlace: data.birthPlace || null,
        nationality: data.nationality || null,
        maritalStatus: data.maritalStatus || null,
        category: data.category,
        subCategory: data.subCategory,
        jobTitle: data.jobTitle,
        serviceId: data.serviceId,
        status: data.status,
        hireDate: new Date(data.hireDate),
      },
    });

    await logAudit({
      userId: me.id,
      action: "UPDATE_AGENT",
      entity: "Agent",
      entityId: agentId,
      details: `${data.firstName} ${data.lastName}`,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        return {
          errors: { _form: ["Cet agent n'existe plus"] },
          values: raw,
        };
      }
      if (e.code === "P2003") {
        return {
          errors: { serviceId: ["Service introuvable"] },
          values: raw,
        };
      }
    }
    throw e;
  }

  revalidatePath("/personnel");
  revalidatePath(`/personnel/${agentId}`);
  redirect(`/personnel/${agentId}`);
}

// ============================================================
//  SUPPRIMER UN AGENT — DIRECTION uniquement
//  Utile quand un collaborateur a été ajouté par erreur.
//
//  Précautions :
//  - Réservé DIRECTION (pas DRH) car acte irréversible
//  - Impossible si l'agent a des bulletins de paie validés
//  - Impossible si l'agent manage encore un service actif (au moins un autre agent)
//  - Purge en cascade : contrats, congés, évaluations, formations, docs, user
//  - Purge aussi les fichiers Supabase Storage (PDF contrats)
// ============================================================
export type DeleteAgentResult =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

export async function deleteAgent(
  agentId: string,
  _prev: DeleteAgentResult,
  _formData: FormData,
): Promise<DeleteAgentResult> {
  const me = await requireRole(Role.DIRECTION);

  // Charge le contexte minimal pour valider la suppression
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      contracts: { select: { id: true } },
      _count: {
        select: {
          payrollRecords: true,
          leaveRequests: true,
        },
      },
      managedService: { select: { id: true, name: true } },
      user: { select: { id: true } },
    },
  });
  if (!agent) return { ok: false, error: "Agent introuvable." };

  // Garde-fous : si l'agent a de la donnée métier importante, on refuse
  // et on suggère plutôt de le passer en INACTIF.
  if (agent._count.payrollRecords > 0) {
    return {
      ok: false,
      error: `Suppression impossible : ${agent._count.payrollRecords} bulletin(s) de paie existent. Passe l'agent en statut INACTIF plutôt qu'une suppression.`,
    };
  }
  if (agent._count.leaveRequests > 5) {
    return {
      ok: false,
      error: `Suppression impossible : ${agent._count.leaveRequests} demandes de congés dans l'historique. Passe l'agent en statut INACTIF plutôt qu'une suppression.`,
    };
  }
  if (agent.managedService) {
    return {
      ok: false,
      error: `Suppression impossible : cet agent manage le service « ${agent.managedService.name} ». Réaffecte le manager du service avant.`,
    };
  }

  // Purge Supabase Storage — les PDF de contrats de cet agent
  for (const c of agent.contracts) {
    await removePrefix(`contracts/${c.id}`);
  }

  // Suppression proprement dite. Cascade Prisma :
  //  - contracts → PayrollRecord, Document, ContractRenewal, Resignation, ContractNotification
  //  - leaveRequests, leaveBalances, careerEntries, evaluations, enrollments : tous en Cascade
  //  - user (compte de connexion) : pas de cascade sur User.agentId → on le supprime avant
  try {
    if (agent.user) {
      await prisma.user.delete({ where: { id: agent.user.id } });
    }
    await prisma.agent.delete({ where: { id: agentId } });
  } catch (e) {
    console.error("[deleteAgent] échec :", e);
    return {
      ok: false,
      error: "Erreur lors de la suppression. Vérifie les dépendances de l'agent.",
    };
  }

  await logAudit({
    userId: me.id,
    action: "DELETE_AGENT",
    entity: "Agent",
    entityId: agentId,
    details: `${agent.firstName} ${agent.lastName} (${agent.matricule})`,
  });

  revalidatePath("/personnel");
  revalidatePath("/parametres");
  return {
    ok: true,
    message: `Agent ${agent.firstName} ${agent.lastName} supprimé.`,
  };
}
