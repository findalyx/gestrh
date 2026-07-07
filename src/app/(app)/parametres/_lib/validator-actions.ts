"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

export type ValidatorActionState =
  | { ok: true; message: string; chain?: Record<number, string> }
  | { ok: false; error: string }
  | undefined;

const CreateValidatorSchema = z.object({
  agentId: z.string().trim().min(1, "Choisissez une personne"),
  label: z.string().trim().min(2, "Libellé requis").max(60),
});

// ============================================================
//  AJOUTER UN VALIDATEUR — DIRECTION + DRH
// ============================================================
export async function createValidator(
  _prev: ValidatorActionState,
  formData: FormData,
): Promise<ValidatorActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const parsed = CreateValidatorSchema.safeParse({
    agentId: String(formData.get("agentId") ?? ""),
    label: String(formData.get("label") ?? ""),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Données invalides";
    return { ok: false, error: first };
  }
  const { agentId, label } = parsed.data;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { firstName: true, lastName: true },
  });
  if (!agent) return { ok: false, error: "Personne introuvable." };

  const existing = await prisma.validator.findUnique({ where: { agentId } });
  if (existing) {
    return { ok: false, error: "Cette personne est déjà un validateur." };
  }

  await prisma.validator.create({ data: { agentId, label } });

  await logAudit({
    userId: me.id,
    action: "CREATE_VALIDATOR",
    entity: "Validator",
    details: `${agent.firstName} ${agent.lastName} · ${label}`,
  });

  revalidatePath("/parametres");
  return { ok: true, message: "Validateur ajouté." };
}

// ============================================================
//  SUPPRIMER UN VALIDATEUR — DIRECTION + DRH
//  Retire aussi ce validateur de toutes les chaînes (cascade).
// ============================================================
export async function deleteValidator(
  validatorId: string,
  _prev: ValidatorActionState,
  _formData: FormData,
): Promise<ValidatorActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const validator = await prisma.validator.findUnique({
    where: { id: validatorId },
    select: { id: true, label: true, agent: { select: { firstName: true, lastName: true } } },
  });
  if (!validator) return { ok: false, error: "Validateur introuvable." };

  await prisma.validator.delete({ where: { id: validatorId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_VALIDATOR",
    entity: "Validator",
    entityId: validatorId,
    details: `${validator.agent.firstName} ${validator.agent.lastName} · ${validator.label}`,
  });

  revalidatePath("/parametres");
  return { ok: true, message: "Validateur retiré." };
}

// ============================================================
//  DÉFINIR LA CHAÎNE DE VALIDATION D'UN AGENT — DIRECTION + DRH
//  Reçoit level1..level4 (ids de validateurs, éventuellement vides).
//  Compacte en niveaux contigus 1..N et remplace la chaîne existante.
// ============================================================
export async function setLeaveChain(
  agentId: string,
  _prev: ValidatorActionState,
  formData: FormData,
): Promise<ValidatorActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!agent) return { ok: false, error: "Agent introuvable." };

  // Récupère les 4 sélections, ignore les vides, garde l'ordre.
  const picks = [1, 2, 3, 4]
    .map((n) => String(formData.get(`level${n}`) ?? "").trim())
    .filter(Boolean);

  // Un même validateur ne peut pas occuper deux niveaux.
  const unique = new Set(picks);
  if (unique.size !== picks.length) {
    return {
      ok: false,
      error: "Un même validateur ne peut pas occuper deux niveaux.",
    };
  }

  // Vérifie que tous les ids existent et qu'aucun n'est l'agent lui-même.
  if (picks.length > 0) {
    const validators = await prisma.validator.findMany({
      where: { id: { in: picks } },
      select: { id: true, agentId: true },
    });
    if (validators.length !== picks.length) {
      return { ok: false, error: "Un validateur sélectionné n'existe plus." };
    }
    if (validators.some((v) => v.agentId === agentId)) {
      return {
        ok: false,
        error: "La personne ne peut pas être son propre validateur.",
      };
    }
  }

  // Remplace la chaîne : on efface puis on recrée en niveaux contigus.
  await prisma.$transaction(async (tx) => {
    await tx.leaveApprovalStep.deleteMany({ where: { agentId } });
    if (picks.length > 0) {
      await tx.leaveApprovalStep.createMany({
        data: picks.map((validatorId, i) => ({
          agentId,
          level: i + 1,
          validatorId,
        })),
      });
    }
  });

  await logAudit({
    userId: me.id,
    action: "SET_LEAVE_CHAIN",
    entity: "Agent",
    entityId: agentId,
    details: `${agent.firstName} ${agent.lastName} · ${picks.length} niveau(x)`,
  });

  revalidatePath(`/personnel/${agentId}`);
  revalidatePath("/parametres");

  // Renvoie la chaîne compactée (niveaux contigus) pour que le formulaire
  // se synchronise sans dépendre du re-rendu serveur.
  const chain: Record<number, string> = {};
  picks.forEach((validatorId, i) => {
    chain[i + 1] = validatorId;
  });

  return {
    ok: true,
    chain,
    message:
      picks.length === 0
        ? "Chaîne effacée (repli sur le Directeur Général)."
        : `Chaîne enregistrée (${picks.length} niveau${picks.length > 1 ? "x" : ""}).`,
  };
}
