import Link from "next/link";
import { LeaveType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { LeaveRequestForm } from "../_components/LeaveRequestForm";

export const dynamic = "force-dynamic";

const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUEL: "Congés annuels",
  MALADIE: "Maladie",
  MATERNITE: "Maternité",
  PATERNITE: "Paternité",
  EXCEPTIONNEL: "Exceptionnel",
  SANS_SOLDE: "Sans solde",
};

export default async function NewLeaveRequestPage() {
  const me = await getCurrentUser();

  if (!me.agent) {
    return (
      <div className="rounded-xl border border-sc-warning/30 bg-sc-warning-light p-5 text-[13px] text-[#854f0b]">
        Votre compte n&apos;est pas relié à une fiche agent. Vous ne pouvez pas
        soumettre de demande de congé. Contactez la DRH.
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { agentId: me.agent.id, year: currentYear },
    orderBy: { type: "asc" },
  });

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/conges" className="hover:text-sc-blue">
          Congés
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">Nouvelle demande</span>
      </div>

      <header>
        <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
          Nouvelle demande de congé
        </h2>
        <p className="mt-1 text-[12.5px] text-gray-500">
          Votre demande sera transmise à votre responsable hiérarchique pour
          validation. Vous serez notifié(e) de la décision.
        </p>
      </header>

      {/* Rappel des soldes */}
      {balances.length > 0 && (
        <section className="rounded-xl border border-sc-border bg-sc-blue-bg p-4">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wider text-sc-blue-darker">
            Vos soldes {currentYear}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {balances.map((b) => {
              const remaining = b.totalDays - b.usedDays;
              return (
                <div
                  key={b.id}
                  className="rounded-lg border border-sc-border bg-white p-2.5"
                >
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
                    {LEAVE_TYPE_LABEL[b.type]}
                  </p>
                  <p className="mt-1 font-serif text-base font-bold text-sc-blue-darker">
                    {remaining}
                    <span className="text-[11px] font-normal text-gray-500">
                      {" "}
                      / {b.totalDays} j
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <LeaveRequestForm todayISO={todayISO} />
    </div>
  );
}
