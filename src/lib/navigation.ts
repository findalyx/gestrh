import type { IconName } from "@/components/Icon";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  /** Titre court affiché dans la topbar */
  title: string;
  /** Sous-titre affiché dans la topbar */
  subtitle: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

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
      },
      {
        label: "Personnel (PER/PATS)",
        href: "/personnel",
        icon: "users",
        title: "Gestion du personnel",
        subtitle: "Dossiers individuels · PER et PATS",
      },
      {
        label: "Paie & avantages",
        href: "/paie",
        icon: "payroll",
        title: "Paie & avantages sociaux",
        subtitle: "Bulletins, primes et déclarations sociales",
      },
      {
        label: "Congés & absences",
        href: "/conges",
        icon: "calendar",
        title: "Congés & absences",
        subtitle: "Demandes, validations et soldes",
      },
      {
        label: "Évaluation & performance",
        href: "/evaluation",
        icon: "evaluation",
        title: "Évaluation & performance",
        subtitle: "Campagnes d'entretiens annuels",
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
      },
      {
        label: "Recrutement",
        href: "/recrutement",
        icon: "recruitment",
        title: "Recrutement & intégration",
        subtitle: "Offres, candidatures et onboarding",
      },
      {
        label: "Communication interne",
        href: "/communication",
        icon: "communication",
        title: "Communication interne",
        subtitle: "Annonces, notifications et messagerie",
      },
      {
        label: "Conformité & archives",
        href: "/conformite",
        icon: "compliance",
        title: "Conformité & archives",
        subtitle: "Documents, traçabilité et RGPD",
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
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
