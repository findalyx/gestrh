import Link from "next/link";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/contract-utils";
import type { CddAlertItem, RetirementAlertItem } from "@/lib/contract-alerts";

const LEVEL_STYLE: Record<CddAlertItem["level"], { badge: string; row: string }> = {
  expire: { badge: "bg-sc-danger-light text-sc-danger", row: "border-l-sc-danger" },
  imminent: { badge: "bg-sc-danger-light text-sc-danger", row: "border-l-sc-danger" },
  proche: { badge: "bg-orange-100 text-orange-700", row: "border-l-orange-400" },
  anticipe: { badge: "bg-amber-50 text-amber-700", row: "border-l-amber-300" },
};

const LEVEL_LABEL: Record<CddAlertItem["level"], string> = {
  expire: "Expiré",
  imminent: "J−15",
  proche: "J−30",
  anticipe: "J−90",
};

function CddBadge({ days, level }: { days: number; level: CddAlertItem["level"] }) {
  const label =
    level === "expire" ? `Expiré (J${days})` : days === 0 ? "Aujourd'hui" : `J−${days}`;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEVEL_STYLE[level].badge}`}
    >
      {label}
    </span>
  );
}

function CardShell({
  title,
  icon,
  total,
  children,
  emptyMessage,
}: {
  title: string;
  icon: "alert" | "users";
  total: number;
  children: React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2.5 font-serif text-[15px] font-semibold text-sc-blue-darker">
          <span className="h-[16px] w-1 rounded bg-sc-teal" />
          {title}
        </h3>
        <span className="rounded-full bg-sc-blue-light px-2 py-0.5 text-[11px] font-semibold text-sc-blue">
          {total}
        </span>
      </div>
      {total === 0 ? (
        <p className="flex items-center gap-2 text-[12px] text-gray-500">
          <Icon name={icon} size={14} /> {emptyMessage}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

export function CddAlertsCard({ alerts }: { alerts: CddAlertItem[] }) {
  const buckets = {
    expire: alerts.filter((a) => a.level === "expire").length,
    imminent: alerts.filter((a) => a.level === "imminent").length,
    proche: alerts.filter((a) => a.level === "proche").length,
    anticipe: alerts.filter((a) => a.level === "anticipe").length,
  };
  const visible = alerts.slice(0, 6);

  return (
    <CardShell
      title="Échéances CDD à venir"
      icon="alert"
      total={alerts.length}
      emptyMessage="Aucun CDD à échéance dans les 90 jours."
    >
      <div className="mb-3 grid grid-cols-4 gap-2">
        {(Object.keys(buckets) as Array<keyof typeof buckets>).map((k) => (
          <div
            key={k}
            className={`rounded-md px-2 py-1.5 text-center text-[11px] ${LEVEL_STYLE[k].badge}`}
          >
            <div className="text-[16px] font-bold leading-none">{buckets[k]}</div>
            <div className="mt-0.5 font-semibold uppercase tracking-wide">
              {LEVEL_LABEL[k]}
            </div>
          </div>
        ))}
      </div>
      <ul className="space-y-1.5">
        {visible.map((a) => (
          <li
            key={a.contractId}
            className={`flex items-center gap-3 rounded-md border-l-4 bg-sc-blue-bg px-3 py-2 text-[12px] ${LEVEL_STYLE[a.level].row}`}
          >
            <CddBadge days={a.daysRemaining} level={a.level} />
            <Link
              href={`/personnel/${a.agentId}/renouvellement`}
              className="min-w-0 flex-1 hover:underline"
            >
              <div className="truncate font-semibold text-sc-blue-darker">
                {a.agentFullName}
              </div>
              <div className="truncate text-[11px] text-gray-500">
                {a.reference} · {a.serviceName} · fin {formatDate(a.endDate)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {alerts.length > visible.length && (
        <Link
          href="/personnel?statut=ACTIF"
          className="mt-3 inline-block text-[11px] font-semibold text-sc-blue hover:underline"
        >
          Voir les {alerts.length - visible.length} autres →
        </Link>
      )}
    </CardShell>
  );
}

const WINDOW_STYLE: Record<NonNullable<RetirementAlertItem["alertWindow"]> | "long", string> = {
  3: "bg-sc-danger-light text-sc-danger",
  6: "bg-orange-100 text-orange-700",
  12: "bg-amber-50 text-amber-700",
  24: "bg-sc-blue-light text-sc-blue",
  long: "bg-gray-100 text-gray-600",
};

function RetirementBadge({ months }: { months: number }) {
  let style: string = WINDOW_STYLE.long;
  if (months <= 0) style = WINDOW_STYLE[3];
  else if (months <= 3) style = WINDOW_STYLE[3];
  else if (months <= 6) style = WINDOW_STYLE[6];
  else if (months <= 12) style = WINDOW_STYLE[12];
  else if (months <= 24) style = WINDOW_STYLE[24];

  const label =
    months <= 0
      ? `Échue (${Math.abs(months)} m)`
      : months < 12
        ? `${months} mois`
        : `${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? "s" : ""}`;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style}`}>
      {label}
    </span>
  );
}

export function RetirementCard({ alerts }: { alerts: RetirementAlertItem[] }) {
  const next24 = alerts.filter((a) => (a.alertWindow ?? 99) <= 24).length;
  const visible = alerts.slice(0, 6);

  return (
    <CardShell
      title="Départs retraite à anticiper (5 ans)"
      icon="users"
      total={alerts.length}
      emptyMessage="Aucun départ en retraite dans les 5 ans."
    >
      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-sc-blue-light px-2 py-1.5 text-center">
          <div className="text-[16px] font-bold leading-none text-sc-blue">
            {alerts.length}
          </div>
          <div className="mt-0.5 font-semibold uppercase tracking-wide text-sc-blue">
            5 ans
          </div>
        </div>
        <div className="rounded-md bg-orange-100 px-2 py-1.5 text-center">
          <div className="text-[16px] font-bold leading-none text-orange-700">
            {next24}
          </div>
          <div className="mt-0.5 font-semibold uppercase tracking-wide text-orange-700">
            ≤ 24 mois
          </div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {visible.map((a) => (
          <li
            key={a.agentId}
            className="flex items-center gap-3 rounded-md bg-sc-blue-bg px-3 py-2 text-[12px]"
          >
            <RetirementBadge months={a.totalMonthsRemaining} />
            <Link
              href={`/personnel/${a.agentId}`}
              className="min-w-0 flex-1 hover:underline"
            >
              <div className="truncate font-semibold text-sc-blue-darker">
                {a.agentFullName}
              </div>
              <div className="truncate text-[11px] text-gray-500">
                {a.serviceName} · départ {formatDate(a.retirementDate)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {alerts.length > visible.length && (
        <span className="mt-3 inline-block text-[11px] text-gray-500">
          + {alerts.length - visible.length} autres dans les 5 ans
        </span>
      )}
    </CardShell>
  );
}
