import type { StaffCategory } from "@prisma/client";

export type AnnouncementAudience = {
  categories: StaffCategory[];
  serviceIds: string[];
};

export const CATEGORY_LABEL: Record<StaffCategory, string> = {
  PER: "PER",
  PATS: "PATS",
  PRESTATAIRE: "Permanents",
};

/**
 * Une annonce sans ciblage (deux listes vides) s'adresse à tout le personnel.
 * Sinon elle est visible si la catégorie de l'agent OU son service est ciblé —
 * un « ou », pour pouvoir viser « les PER » et « le service Technique » d'un
 * seul envoi.
 */
export function isAnnouncementVisibleTo(
  audience: AnnouncementAudience,
  agent: { category: StaffCategory; serviceId: string } | null,
): boolean {
  const targeted =
    audience.categories.length > 0 || audience.serviceIds.length > 0;
  if (!targeted) return true;
  if (!agent) return false;
  return (
    audience.categories.includes(agent.category) ||
    audience.serviceIds.includes(agent.serviceId)
  );
}

/** Libellé lisible de l'audience, pour l'affichage sur l'annonce. */
export function audienceLabel(
  audience: AnnouncementAudience,
  serviceNameById: Map<string, string>,
): string {
  const parts: string[] = [
    ...audience.categories.map((c) => CATEGORY_LABEL[c]),
    ...audience.serviceIds.map((id) => serviceNameById.get(id) ?? "Service"),
  ];
  return parts.length === 0 ? "Tout le personnel" : parts.join(" · ");
}
