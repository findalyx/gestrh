"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import {
  clearLogoFiles,
  getOrganization,
  saveLogoFile,
} from "@/lib/organization";

const OrgSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120),
  shortName: z.string().trim().max(8).optional().or(z.literal("")),
  tagline: z.string().trim().max(60).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  ninea: z.string().trim().max(40).optional().or(z.literal("")),
  rccm: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().optional().or(z.literal(""))
    .refine((s) => !s || /^[^@]+@[^@]+\.[^@]+$/.test(s), "Email invalide"),
  website: z.string().trim().max(120).optional().or(z.literal(""))
    .refine((s) => !s || /^https?:\/\//.test(s), "URL doit commencer par http(s)://"),
  capital: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((s) => !s || /^\d+$/.test(s), "Saisir un nombre entier en FCFA"),
  bp: z.string().trim().max(80).optional().or(z.literal("")),
  legalRepName: z.string().trim().max(120).optional().or(z.literal("")),
  legalRepTitle: z.string().trim().max(80).optional().or(z.literal("")),
});

export type OrgFormState = {
  errors?: Partial<Record<keyof z.infer<typeof OrgSchema> | "_form", string[]>>;
  values?: Partial<Record<keyof z.infer<typeof OrgSchema>, string>>;
  ok?: boolean;
  message?: string;
};

export type LogoActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

// ============================================================
//  METTRE À JOUR L'IDENTITÉ DE L'ORGANISATION — DIRECTION + DRH
// ============================================================
export async function updateOrganization(
  _prev: OrgFormState | undefined,
  formData: FormData,
): Promise<OrgFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    name: String(formData.get("name") ?? ""),
    shortName: String(formData.get("shortName") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    address: String(formData.get("address") ?? ""),
    city: String(formData.get("city") ?? ""),
    country: String(formData.get("country") ?? ""),
    ninea: String(formData.get("ninea") ?? ""),
    rccm: String(formData.get("rccm") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    website: String(formData.get("website") ?? ""),
    capital: String(formData.get("capital") ?? ""),
    bp: String(formData.get("bp") ?? ""),
    legalRepName: String(formData.get("legalRepName") ?? ""),
    legalRepTitle: String(formData.get("legalRepTitle") ?? ""),
  };

  const parsed = OrgSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }
  const data = parsed.data;

  const current = await getOrganization();
  await prisma.organization.update({
    where: { id: current.id },
    data: {
      name: data.name,
      shortName: data.shortName || null,
      tagline: data.tagline || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || current.country,
      ninea: data.ninea || null,
      rccm: data.rccm || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      capital: data.capital ? BigInt(data.capital) : null,
      bp: data.bp || null,
      legalRepName: data.legalRepName || null,
      legalRepTitle: data.legalRepTitle || null,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPDATE_ORGANIZATION",
    entity: "Organization",
    entityId: current.id,
    details: data.name,
  });

  // Le logo / nom est affiché partout — on invalide tout
  revalidatePath("/", "layout");
  return { ok: true, message: "Identité de l'organisation mise à jour." };
}

// ============================================================
//  UPLOADER UN NOUVEAU LOGO — DIRECTION + DRH
// ============================================================
export async function uploadLogo(
  _prev: LogoActionState,
  formData: FormData,
): Promise<LogoActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Veuillez choisir un fichier." };
  }

  const result = await saveLogoFile(file);
  if (!result.ok) return result;

  const current = await getOrganization();
  await prisma.organization.update({
    where: { id: current.id },
    data: {
      logoFilename: result.filename,
      logoMimeType: result.mimeType,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_LOGO",
    entity: "Organization",
    entityId: current.id,
    details: result.filename,
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Logo mis à jour." };
}

// ============================================================
//  SUPPRIMER LE LOGO — DIRECTION + DRH
// ============================================================
export async function deleteLogo(
  _prev: LogoActionState,
  _formData: FormData,
): Promise<LogoActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const current = await getOrganization();
  if (!current.logoFilename) {
    return { ok: false, error: "Aucun logo à supprimer." };
  }

  await clearLogoFiles();
  await prisma.organization.update({
    where: { id: current.id },
    data: { logoFilename: null, logoMimeType: null },
  });

  await logAudit({
    userId: me.id,
    action: "DELETE_LOGO",
    entity: "Organization",
    entityId: current.id,
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Logo supprimé." };
}
