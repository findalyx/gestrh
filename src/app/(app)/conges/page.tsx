import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function CongesPage() {
  return (
    <ModulePlaceholder
      icon="calendar"
      specRef="5.4"
      intro="Gestion des demandes de congés et absences avec workflow de validation hiérarchique et suivi des soldes."
      features={[
        {
          title: "Demandes en ligne",
          description: "Saisie des demandes de congés directement par les agents.",
        },
        {
          title: "Validation hiérarchique",
          description: "Workflow de validation Manager puis DRH.",
        },
        {
          title: "Suivi des soldes",
          description: "Congés annuels, maladies et exceptionnels.",
        },
        {
          title: "Calendrier des absences",
          description: "Vue calendaire des absences par service.",
        },
        {
          title: "Gestion des justificatifs",
          description: "Dépôt des certificats médicaux et autres pièces.",
        },
        {
          title: "Alertes d'organisation",
          description: "Détection des déséquilibres d'effectifs par service.",
        },
      ]}
    />
  );
}
