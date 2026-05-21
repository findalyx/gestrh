import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function PaiePage() {
  return (
    <ModulePlaceholder
      icon="payroll"
      specRef="5.3"
      intro="Automatisation du calcul des salaires et gestion des avantages sociaux, en conformité avec la réglementation sénégalaise."
      features={[
        {
          title: "Calcul automatique des salaires",
          description: "Application des grilles salariales PER et PATS.",
        },
        {
          title: "Primes & indemnités",
          description: "Gestion des primes, indemnités et allocations.",
        },
        {
          title: "Bulletins de paie PDF",
          description: "Génération des bulletins de paie en FCFA.",
        },
        {
          title: "Déclarations sociales",
          description: "Cotisations CSS, IPRES et IPM conformes à la loi.",
        },
        {
          title: "Historique de paie",
          description: "Consultation de l'historique de paie par agent.",
        },
      ]}
    />
  );
}
