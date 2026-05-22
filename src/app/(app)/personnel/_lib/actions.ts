"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, Role, StaffCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
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

  let createdId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const matricule = await nextMatricule(tx, data.category);
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return {
        errors: { serviceId: ["Service introuvable"] },
        values: raw,
      };
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
