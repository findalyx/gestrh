import { z } from "zod";
import {
  AgentStatus,
  DepartureReason,
  Gender,
  StaffCategory,
  StaffSubCategory,
} from "@prisma/client";

// Statuts correspondant à un agent qui a quitté l'organisation.
export const DEPARTED_STATUSES: AgentStatus[] = [
  AgentStatus.INACTIF,
  AgentStatus.RETRAITE,
];

const SUB_BY_CATEGORY: Record<StaffCategory, StaffSubCategory[]> = {
  PER: [StaffSubCategory.PER_ENSEIGNEMENT, StaffSubCategory.PER_RECHERCHE],
  PATS: [
    StaffSubCategory.PATS_ADMINISTRATIF,
    StaffSubCategory.PATS_TECHNIQUE,
  ],
  PRESTATAIRE: [StaffSubCategory.PRESTATAIRE_SERVICE],
};

export const SUB_CATEGORIES_BY_CATEGORY = SUB_BY_CATEGORY;

const dateString = z
  .string()
  .trim()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), {
    message: "Date invalide",
  });

export const AgentFormSchema = z
  .object({
    // Optionnel : si vide, le matricule est attribué automatiquement.
    // Renseigné (ex. « 3110 »), il permet de rattacher des bulletins déjà
    // importés à la fiche créée.
    matricule: z
      .string()
      .trim()
      .toUpperCase()
      .max(20)
      .regex(/^[A-Z0-9-]*$/, "Lettres, chiffres et tirets uniquement")
      .optional()
      .or(z.literal("")),
    firstName: z.string().trim().min(1, "Le prénom est requis").max(80),
    lastName: z.string().trim().min(1, "Le nom est requis").max(80),
    email: z.string().trim().toLowerCase().email("Email invalide"),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    address: z.string().trim().max(255).optional().or(z.literal("")),
    gender: z.nativeEnum(Gender),
    birthDate: dateString.optional().or(z.literal("")),
    birthPlace: z.string().trim().max(120).optional().or(z.literal("")),
    nationality: z.string().trim().max(60).optional().or(z.literal("")),
    maritalStatus: z.string().trim().max(60).optional().or(z.literal("")),
    category: z.nativeEnum(StaffCategory),
    subCategory: z.nativeEnum(StaffSubCategory),
    jobTitle: z.string().trim().min(1, "Le poste est requis").max(120),
    serviceId: z.string().trim().min(1, "Le service est requis"),
    status: z.nativeEnum(AgentStatus).default(AgentStatus.ACTIF),
    hireDate: dateString.min(1, "La date d'embauche est requise"),
    // Sortie de l'agent (renseignée quand le statut est Inactif / Retraité).
    departureDate: dateString.optional().or(z.literal("")),
    departureReason: z
      .nativeEnum(DepartureReason)
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    // Cohérence catégorie / sous-catégorie
    if (!SUB_BY_CATEGORY[data.category].includes(data.subCategory)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subCategory"],
        message: "Sous-catégorie incompatible avec la catégorie",
      });
    }

    // hireDate ≤ aujourd'hui
    const hire = new Date(data.hireDate);
    if (!Number.isNaN(hire.getTime()) && hire.getTime() > Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hireDate"],
        message: "La date d'embauche ne peut pas être future",
      });
    }

    // Un agent parti (Inactif / Retraité) DOIT avoir une date de départ.
    if (DEPARTED_STATUSES.includes(data.status) && !data.departureDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departureDate"],
        message: "La date de départ est obligatoire pour un agent parti",
      });
    }

    // Date de départ : cohérente avec l'embauche (jamais avant l'entrée).
    if (data.departureDate) {
      const dep = new Date(data.departureDate);
      if (
        !Number.isNaN(dep.getTime()) &&
        !Number.isNaN(hire.getTime()) &&
        dep.getTime() < hire.getTime()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["departureDate"],
          message: "La date de départ ne peut pas précéder l'embauche",
        });
      }
    }

    // Date de naissance plausible
    if (data.birthDate) {
      const bd = new Date(data.birthDate);
      if (!Number.isNaN(bd.getTime())) {
        const age = (Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000);
        if (age < 15 || age > 90) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["birthDate"],
            message: "Date de naissance invraisemblable",
          });
        }
      }
    }
  });

export type AgentFormValues = z.infer<typeof AgentFormSchema>;

export type AgentFormState = {
  errors?: Partial<Record<keyof AgentFormValues | "_form", string[]>>;
  values?: Partial<Record<keyof AgentFormValues, string>>;
  message?: string;
};
