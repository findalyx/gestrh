import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function PersonnelPage() {
  return (
    <ModulePlaceholder
      icon="users"
      specRef="5.2"
      intro="Gestion centralisée des dossiers individuels du personnel PER et PATS : informations personnelles, contractuelles et professionnelles."
      features={[
        {
          title: "Dossiers individuels",
          description:
            "Informations personnelles, contractuelles et professionnelles de chaque agent.",
        },
        {
          title: "Historique de carrière",
          description: "Suivi des postes occupés et des évolutions de carrière.",
        },
        {
          title: "Organigramme dynamique",
          description: "Représentation interactive de la structure de l'université.",
        },
        {
          title: "Archivage des documents",
          description: "Contrats, diplômes et certifications stockés de façon sécurisée.",
        },
        {
          title: "Import / export en masse",
          description: "Traitement groupé des dossiers au format Excel ou CSV.",
        },
      ]}
    />
  );
}
