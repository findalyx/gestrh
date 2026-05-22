import { z } from "zod";
import { ApplicationStage, JobStatus, StaffCategory } from "@prisma/client";

const dateString = z
  .string()
  .trim()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), {
    message: "Date invalide",
  });

// ============================================================
//  OFFRE D'EMPLOI
// ============================================================
export const JobPostingSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court").max(140),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.nativeEnum(StaffCategory),
  openings: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 1 : Number(v)),
    z.number().int().min(1, "Min 1").max(50, "Max 50"),
  ),
  serviceId: z.string().optional().or(z.literal("")),
  closesAt: dateString.optional().or(z.literal("")),
});

export type JobPostingValues = z.infer<typeof JobPostingSchema>;

export type JobPostingFormState = {
  errors?: Partial<Record<keyof JobPostingValues | "_form", string[]>>;
  values?: Partial<Record<keyof JobPostingValues, string>>;
};

// ============================================================
//  CANDIDATURE
// ============================================================
export const ApplicationSchema = z.object({
  candidateName: z.string().trim().min(2, "Nom requis").max(120),
  candidateEmail: z.string().trim().toLowerCase().email("Email invalide"),
  candidatePhone: z.string().trim().max(40).optional().or(z.literal("")),
  cvUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (s) => !s || /^https?:\/\//.test(s),
      "Doit commencer par http:// ou https://",
    ),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ApplicationValues = z.infer<typeof ApplicationSchema>;

export type ApplicationFormState = {
  errors?: Partial<Record<keyof ApplicationValues | "_form", string[]>>;
  values?: Partial<Record<keyof ApplicationValues, string>>;
};

// ============================================================
//  ACTIONS SIMPLES (avancer / rejeter / planifier / fermer)
// ============================================================
export type RecruitmentActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

// Pipeline ordonné des étapes (du début vers la fin)
export const PIPELINE_ORDER: ApplicationStage[] = [
  ApplicationStage.CANDIDATURE,
  ApplicationStage.PRESELECTION,
  ApplicationStage.ENTRETIEN,
  ApplicationStage.FINALISTE,
  ApplicationStage.RECRUTE,
];

export function nextStage(current: ApplicationStage): ApplicationStage | null {
  const i = PIPELINE_ORDER.indexOf(current);
  if (i < 0 || i >= PIPELINE_ORDER.length - 1) return null;
  return PIPELINE_ORDER[i + 1];
}

export { JobStatus, ApplicationStage };
