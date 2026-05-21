import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function ParametresPage() {
  return (
    <ModulePlaceholder
      icon="settings"
      specRef="4"
      intro="Gestion des comptes, des profils utilisateurs et de la configuration de sécurité de l'application."
      features={[
        {
          title: "Gestion des comptes",
          description: "Création et administration des comptes utilisateurs.",
        },
        {
          title: "Profils & droits",
          description:
            "Direction Générale, DRH, Manager et Agent — droits différenciés.",
        },
        {
          title: "Authentification sécurisée",
          description: "Connexion par JWT avec mots de passe hachés (bcrypt).",
        },
        {
          title: "Journal d'audit",
          description: "Traçabilité de toutes les actions RH.",
        },
        {
          title: "Sauvegardes",
          description: "Sauvegardes automatiques quotidiennes des données.",
        },
      ]}
    />
  );
}
