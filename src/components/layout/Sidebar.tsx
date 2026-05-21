"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { NAV_SECTIONS } from "@/lib/navigation";

type SidebarProps = {
  /** Compteurs affichés en pastille, indexés par href */
  badges?: Record<string, number>;
};

export function Sidebar({ badges = {} }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto bg-gradient-to-b from-sc-blue-darker to-sc-blue-dark text-white">
      {/* Marque */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sc-teal to-sc-green font-serif text-lg font-bold">
          SC
        </div>
        <div>
          <h1 className="font-serif text-[17px] font-semibold leading-tight">
            St Christopher
          </h1>
          <p className="text-[11px] uppercase tracking-wider text-white/60">
            SIRH · Université
          </p>
        </div>
      </div>

      {/* Sections de navigation */}
      <nav className="py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="py-3">
            <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              {section.label}
            </div>
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const badge = badges[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 border-l-[3px] px-5 py-[11px] text-[13.5px] transition-colors ${
                    active
                      ? "border-sc-teal bg-sc-teal/15 font-medium text-white"
                      : "border-transparent font-normal text-white/75 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon name={item.icon} size={18} className="opacity-85" />
                  <span className="flex-1">{item.label}</span>
                  {badge ? (
                    <span className="rounded-full bg-sc-green px-[7px] py-[2px] text-[10px] font-semibold text-white">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
