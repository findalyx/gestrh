import { Role } from "@prisma/client";
import type { IconName } from "@/components/Icon";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  /** Titre court affiché dans la topbar */
  title: string;
  /** Sous-titre affiché dans la topbar */
  subtitle: string;
  /** Rôles autorisés à voir cet item dans le menu */
  roles: Role[];
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

const ALL: Role[] = [Role.DIRECTION, Role.RECTEUR, Role.DOYEN, Role.DRH, Role.MANAGER, Role.AGENT];
const STAFF: Role[] = [Role.DIRECTION, Role.RECTEUR, Role.DOYEN, Role.DRH, Role.MANAGER];
const ADMIN: Role[] = [Role.DIRECTION, Role.DRH];

/**
 * Filtre les sections de navigation selon le rôle. Les sections vides
 * sont retirées.
 */
export function navSectionsFor(role: Role): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.roles.includes(role)),
  })).filter((s) => s.items.length > 0);
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Principal",
    items: [
      {
        label: "Tableau de bord",
        href: "/tableau-de-bord",
        icon: "dashboard",
        title: "Tableau de bord RH stratégique",
        subtitle: "Vue intégrée · Direction générale · Année 2025-2026",
        roles: ALL,
      },
      {
        label: "Personnel",
        href: "/personnel",
        icon: "users",
        title: "Gestion du personnel",
        subtitle: "Dossiers individuels · PER, PATS et prestataires",
        roles: STAFF,
      },
      {
        label: "Paie & avantages",
        href: "/paie",
        icon: "payroll",
        title: "Paie & avantages sociaux",
        subtitle: "Bulletins, primes et déclarations sociales",
        roles: [Role.DIRECTION, Role.DRH, Role.AGENT],
      },
      {
        label: "Congés & absences",
        href: "/conges",
        icon: "calendar",
        title: "Congés & absences",
        subtitle: "Demandes, validations et soldes",
        roles: ALL,
      },
      {
        label: "Évaluation & performance",
        href: "/evaluation",
        icon: "evaluation",
        title: "Évaluation & performance",
        subtitle: "Campagnes d'entretiens annuels",
        roles: ALL,
      },
    ],
  },
  {
    label: "Gestion RH",
    items: [
      {
        label: "Formation & compétences",
        href: "/formation",
        icon: "training",
        title: "Formation & développement",
        subtitle: "Catalogue, plan annuel et compétences",
        roles: ALL,
      },
      {
        label: "Recrutement",
        href: "/recrutement",
        icon: "recruitment",
        title: "Recrutement & intégration",
        subtitle: "Offres, candidatures et onboarding",
        roles: ADMIN,
      },
      {
        label: "Communication interne",
        href: "/communication",
        icon: "communication",
        title: "Communication interne",
        subtitle: "Annonces, notifications et messagerie",
        roles: ALL,
      },
      {
        label: "Conformité & archives",
        href: "/conformite",
        icon: "compliance",
        title: "Conformité & archives",
        subtitle: "Documents, traçabilité et RGPD",
        roles: ADMIN,
      },
    ],
  },
  {
    label: "Système",
    items: [
      {
        label: "Paramètres & sécurité",
        href: "/parametres",
        icon: "settings",
        title: "Paramètres & sécurité",
        subtitle: "Comptes, profils et configuration",
        roles: ADMIN,
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
