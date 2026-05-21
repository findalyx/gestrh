import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function RecrutementPage() {
  return (
    <ModulePlaceholder
      icon="recruitment"
      specRef="5.5"
      intro="Gestion du recrutement, de la publication des offres à l'intégration des nouveaux collaborateurs."
      features={[
        {
          title: "Publication d'offres",
          description: "Diffusion des offres d'emploi.",
        },
        {
          title: "Tri des candidatures",
          description: "Réception et tri des candidatures reçues.",
        },
        {
          title: "Pipeline de recrutement",
          description:
            "Candidatures → Présélection → Entretiens → Finalistes → Recrutés.",
        },
        {
          title: "Planification des entretiens",
          description: "Organisation et suivi des entretiens.",
        },
        {
          title: "Parcours d'intégration",
          description: "Checklist d'onboarding des nouveaux collaborateurs.",
        },
      ]}
    />
  );
}
