import { z } from "zod";
import { TrainingStatus } from "@prisma/client";

const dateString = z
  .string()
  .trim()
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "Date invalide",
  });

export const CourseSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court").max(140),
  category: z.string().trim().min(2, "Catégorie requise").max(60),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  isInternal: z.preprocess((v) => v === "on" || v === true, z.boolean()).optional(),
  instructor: z.string().trim().max(120).optional().or(z.literal("")),
  objectives: z.string().trim().max(2000).optional().or(z.literal("")),
  durationHours: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().min(1).max(500).nullable(),
    )
    .optional(),
});

export const CourseModuleSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court").max(140),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  durationHours: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().min(1).max(200).nullable(),
    )
    .optional(),
});

export const SessionSchema = z
  .object({
    courseId: z.string().min(1, "Cours requis"),
    startDate: dateString,
    endDate: dateString,
    location: z.string().trim().max(120).optional().or(z.literal("")),
    capacity: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 20 : Number(v)),
      z.number().int().min(1, "Min 1").max(500, "Max 500"),
    ),
    status: z.nativeEnum(TrainingStatus).default(TrainingStatus.PLANIFIEE),
  })
  .superRefine((d, ctx) => {
    if (new Date(d.endDate) < new Date(d.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "La date de fin doit suivre la date de début",
      });
    }
  });

export type CourseValues = z.infer<typeof CourseSchema>;
export type SessionValues = z.infer<typeof SessionSchema>;
export type CourseModuleValues = z.infer<typeof CourseModuleSchema>;

export type CourseFormState = {
  errors?: Partial<Record<keyof CourseValues | "_form", string[]>>;
  values?: Partial<Record<keyof CourseValues, string>>;
  ok?: boolean;
  message?: string;
};

export type CourseModuleFormState = {
  errors?: Partial<Record<keyof CourseModuleValues | "_form", string[]>>;
  values?: Partial<Record<keyof CourseModuleValues, string>>;
  ok?: boolean;
};

export type SessionFormState = {
  errors?: Partial<Record<keyof SessionValues | "_form", string[]>>;
  values?: Partial<Record<keyof SessionValues, string>>;
};

export type TrainingActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;
