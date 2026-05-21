import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function ConformitePage() {
  return (
    <ModulePlaceholder
      icon="compliance"
      specRef="5.9"
      intro="Archivage sécurisé des documents RH et conformité réglementaire (Code du travail sénégalais, RGPD)."
      features={[
        {
          title: "Archivage sécurisé",
          description: "Conservation sécurisée de tous les documents RH.",
        },
        {
          title: "Droit du travail sénégalais",
          description: "Respect du Code du travail en vigueur.",
        },
        {
          title: "Conformité RGPD",
          description: "Protection des données personnelles.",
        },
        {
          title: "Préparation des audits",
          description: "Préparation des audits internes et externes.",
        },
        {
          title: "Traçabilité",
          description: "Historique des modifications de toutes les actions RH.",
        },
      ]}
    />
  );
}
