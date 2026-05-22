import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

export type DashboardView = "equipe" | "personnel";

export function DashboardTabs({ current }: { current: DashboardView }) {
  return (
    <nav className="flex gap-2 border-b border-sc-border">
      <Tab href="/tableau-de-bord" icon="users" label="Mon équipe" active={current === "equipe"} />
      <Tab href="/tableau-de-bord?vue=personnel" icon="dashboard" label="Mon espace personnel" active={current === "personnel"} />
    </nav>
  );
}

function Tab({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: IconName;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition ${
        active
          ? "border-sc-blue text-sc-blue-darker"
          : "border-transparent text-gray-500 hover:text-sc-blue-darker"
      }`}
    >
      <Icon name={icon} size={14} />
      {label}
    </Link>
  );
}
