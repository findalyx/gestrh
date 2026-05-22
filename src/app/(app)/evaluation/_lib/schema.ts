import { z } from "zod";

/**
 * Schéma de saisie d'une évaluation. Tous les champs sont optionnels en
 * brouillon ; la finalisation exige une note globale.
 */
export const EvaluationDraftSchema = z.object({
  objectives: z.string().trim().max(2000).optional().or(z.literal("")),
  comments: z.string().trim().max(2000).optional().or(z.literal("")),
  overallScore: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().min(0).max(100).nullable(),
    )
    .optional(),
  highPotential: z.preprocess((v) => v === "on" || v === true, z.boolean()).optional(),
});

export const EvaluationFinalSchema = EvaluationDraftSchema.extend({
  overallScore: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number({ message: "La note globale est obligatoire pour finaliser" })
      .min(0)
      .max(100),
  ),
});

export type EvaluationValues = z.infer<typeof EvaluationDraftSchema>;

export type EvaluationFormState =
  | {
      ok?: false;
      errors?: Partial<Record<keyof EvaluationValues | "_form", string[]>>;
      values?: Partial<Record<keyof EvaluationValues, string>>;
    }
  | { ok: true; message: string }
  | undefined;

export type CampaignActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;
