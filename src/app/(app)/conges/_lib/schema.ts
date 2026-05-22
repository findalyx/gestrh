import { z } from "zod";
import { LeaveType } from "@prisma/client";

const dateString = z
  .string()
  .trim()
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "Date invalide",
  });

export const LeaveRequestSchema = z
  .object({
    type: z.nativeEnum(LeaveType),
    startDate: dateString,
    endDate: dateString,
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const s = new Date(data.startDate);
    const e = new Date(data.endDate);

    if (e < s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "La date de fin doit être après le début",
      });
    }

    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (s > oneYearFromNow) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Date trop lointaine (plus d'un an dans le futur)",
      });
    }
  });

export type LeaveRequestValues = z.infer<typeof LeaveRequestSchema>;

export type LeaveFormState = {
  errors?: Partial<Record<keyof LeaveRequestValues | "_form", string[]>>;
  values?: Partial<Record<keyof LeaveRequestValues, string>>;
};

export type LeaveActionState = {
  ok: boolean;
  message: string;
} | undefined;

/**
 * Calcule le nombre de jours calendaires d'une demande, bornes incluses.
 */
export function calcDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}
