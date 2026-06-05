import Link from "next/link";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/dal";
import { listCddAlerts, listRetirementAlerts } from "@/lib/contract-alerts";
import {
  CddAlertsCard,
  RetirementCard,
} from "@/components/dashboard/ContractAlertsCards";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function EcheancesPage() {
  await requireRole(Role.DIRECTION, Role.DRH);

  const [cddAlerts, retirementAlerts] = await Promise.all([
    listCddAlerts(),
    listRetirementAlerts(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sc-warning-light text-[#854f0b]">
            <Icon name="alert" size={22} />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold text-sc-blue-darker">
              Échéances &amp; départs à anticiper
            </h2>
            <p className="text-[12px] text-gray-600">
              Contrats à durée déterminée arrivant à terme et départs en retraite
              dans les 5 ans.
            </p>
          </div>
        </div>
        <Link
          href="/personnel"
          className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
        >
          ← Liste agents
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CddAlertsCard alerts={cddAlerts} />
        <RetirementCard alerts={retirementAlerts} />
      </div>
    </div>
  );
}
