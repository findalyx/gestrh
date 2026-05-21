import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function FormationPage() {
  return (
    <ModulePlaceholder
      icon="training"
      specRef="5.6"
      intro="Gestion du plan de formation annuel et développement des compétences du personnel."
      features={[
        {
          title: "Catalogue de formations",
          description: "Formations internes et externes référencées.",
        },
        {
          title: "Plan de formation annuel",
          description: "Élaboration et suivi du plan annuel.",
        },
        {
          title: "Inscriptions & sessions",
          description: "Inscriptions et suivi des sessions de formation.",
        },
        {
          title: "Cartographie des compétences",
          description: "Compétences disponibles par agent.",
        },
        {
          title: "Bilans de formation",
          description: "Identification des besoins et bilans.",
        },
      ]}
    />
  );
}
