/**
 * Bibliothèque de clauses contractuelles réutilisables.
 * Référencée par les formulaires de création de contrat et d'avenant.
 * Les textes sont calibrés pour le droit sénégalais.
 */
export type ClauseTemplate = {
  id: string;
  category: "Confidentialité" | "Mobilité" | "Non-concurrence" | "Propriété intellectuelle" | "Discipline";
  title: string;
  body: string;
};

export const CLAUSE_LIBRARY: ClauseTemplate[] = [
  {
    id: "confidentialite-generale",
    category: "Confidentialité",
    title: "Obligation générale de confidentialité",
    body:
      "L'Agent s'engage à respecter la plus stricte confidentialité concernant toute information à caractère " +
      "scientifique, pédagogique, administratif ou financier dont il aurait connaissance dans l'exercice de ses fonctions. " +
      "Cette obligation perdure au-delà de la rupture du contrat.",
  },
  {
    id: "confidentialite-medicale",
    category: "Confidentialité",
    title: "Secret médical et données de santé",
    body:
      "L'Agent est astreint au secret médical et au secret professionnel relatif aux données personnelles de santé " +
      "conformément aux dispositions du code de la santé publique et de la loi n° 2008-12 sur la protection des données à caractère personnel.",
  },
  {
    id: "mobilite-dakar",
    category: "Mobilité",
    title: "Mobilité géographique — région de Dakar",
    body:
      "L'Agent accepte le principe d'une mobilité ponctuelle sur l'ensemble des sites de l'Université situés " +
      "dans la région de Dakar, selon les nécessités du service et après notification préalable d'au moins quinze (15) jours.",
  },
  {
    id: "mobilite-nationale",
    category: "Mobilité",
    title: "Mobilité géographique — territoire national",
    body:
      "L'Agent pourra être amené à exercer ses fonctions sur tout site de l'Université situé sur le territoire " +
      "sénégalais. Toute mobilité d'une durée supérieure à trois (3) mois donnera lieu à un avenant définissant ses conditions matérielles.",
  },
  {
    id: "non-concurrence",
    category: "Non-concurrence",
    title: "Clause de non-concurrence post-contractuelle",
    body:
      "Pendant une durée de douze (12) mois suivant la fin du contrat, l'Agent s'interdit d'exercer toute activité " +
      "directement concurrente sur le territoire de la région de Dakar. Cette restriction donne lieu à une contrepartie financière équivalente " +
      "à trente pour cent (30 %) du dernier salaire mensuel brut.",
  },
  {
    id: "propriete-intellectuelle",
    category: "Propriété intellectuelle",
    title: "Propriété des travaux et publications",
    body:
      "Les travaux de recherche, publications, supports pédagogiques et inventions réalisés dans le cadre des " +
      "fonctions sont la propriété de l'Université. L'Agent conserve ses droits moraux conformément à la loi n° 2008-09 sur le droit d'auteur.",
  },
  {
    id: "discipline-deontologie",
    category: "Discipline",
    title: "Charte de déontologie universitaire",
    body:
      "L'Agent s'engage à respecter la charte de déontologie de l'Université, les principes d'intégrité scientifique, " +
      "ainsi que le règlement intérieur. Tout manquement pourra donner lieu à des sanctions disciplinaires conformes à la convention collective applicable.",
  },
];
