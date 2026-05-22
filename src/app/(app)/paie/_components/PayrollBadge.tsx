import type { PayrollStatus } from "@prisma/client";

const STATUS_STYLE: Record<PayrollStatus, string> = {
  BROUILLON: "bg-gray-100 text-gray-600",
  VALIDE: "bg-sc-blue-light text-sc-blue",
  PAYE: "bg-sc-green-light text-sc-green-dark",
};

const STATUS_LABEL: Record<PayrollStatus, string> = {
  BROUILLON: "Brouillon",
  VALIDE: "Validé",
  PAYE: "Payé",
};

export function PayrollStatusBadge({ value }: { value: PayrollStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider ${STATUS_STYLE[value]}`}
    >
      {STATUS_LABEL[value]}
    </span>
  );
}
