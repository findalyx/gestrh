import { Icon, type IconName } from "@/components/Icon";

export type KpiColor = "blue" | "purple" | "green" | "teal" | "danger" | "warning";

export const KPI_ICON_STYLE: Record<KpiColor, string> = {
  blue: "bg-sc-blue-light text-sc-blue",
  purple: "bg-sc-purple-light text-sc-purple",
  green: "bg-sc-green-light text-sc-green-dark",
  teal: "bg-sc-teal-light text-sc-teal-dark",
  danger: "bg-sc-danger-light text-sc-danger",
  warning: "bg-sc-warning-light text-[#854f0b]",
};

/**
 * Carte de synthèse standardisée — icône colorée en cercle à gauche +
 * label / valeur / hint à droite. Utilisée sur tous les modules (tableau de
 * bord, paie, recrutement, formation…).
 */
export function KpiCard({
  color,
  icon,
  label,
  value,
  hint,
}: {
  color: KpiColor;
  icon: IconName;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(51,89,164,0.08)]">
      <div
        className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full ${KPI_ICON_STYLE[color]}`}
      >
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium text-gray-500">
          {label}
        </div>
        <div className="truncate whitespace-nowrap text-[19px] font-bold leading-tight text-sc-blue-darker">
          {value}
        </div>
        <div className="truncate text-[11px] text-gray-500">{hint}</div>
      </div>
    </div>
  );
}
