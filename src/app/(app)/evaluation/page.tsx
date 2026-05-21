import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function EvaluationPage() {
  return (
    <ModulePlaceholder
      icon="evaluation"
      specRef="5.7"
      intro="Pilotage des campagnes d'évaluation annuelle et suivi de la performance individuelle et collective."
      features={[
        {
          title: "Objectifs individuels & collectifs",
          description: "Définition et suivi des objectifs des agents.",
        },
        {
          title: "Entretiens annuels",
          description: "Campagne d'entretiens annuels d'évaluation.",
        },
        {
          title: "Grilles paramétrables",
          description: "Grilles d'évaluation distinctes pour PER et PATS.",
        },
        {
          title: "Hauts potentiels",
          description: "Identification des agents à fort potentiel.",
        },
        {
          title: "Rapports de performance",
          description: "Génération de rapports et suivi des plans d'action.",
        },
      ]}
    />
  );
}
