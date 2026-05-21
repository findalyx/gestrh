import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function CommunicationPage() {
  return (
    <ModulePlaceholder
      icon="communication"
      specRef="5.8"
      intro="Communication interne entre la direction, les managers et les agents de l'université."
      features={[
        {
          title: "Notifications automatisées",
          description: "Échéances, validations et rappels automatiques.",
        },
        {
          title: "Annonces de la direction",
          description: "Diffusion des annonces institutionnelles.",
        },
        {
          title: "Calendrier institutionnel",
          description: "Calendrier partagé de l'université.",
        },
        {
          title: "Messagerie interne",
          description: "Échanges entre agents et managers.",
        },
      ]}
    />
  );
}
