"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import type { NavSection } from "@/lib/navigation";

export type SidebarProps = {
  sections: NavSection[];
  /** Compteurs affichés en pastille, indexés par href */
  badges?: Record<string, number>;
  organization: {
    name: string;
    shortName: string | null;
    tagline: string | null;
    logoUrl: string | null;
  };
};

export function Sidebar({ sections, badges = {}, organization }: SidebarProps) {
  const pathname = usePathname();
  const initials =
    organization.shortName?.toUpperCase() ||
    organization.name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto bg-gradient-to-b from-sc-blue-darker to-sc-blue-dark text-white">
      {/* Marque */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/10 px-5 py-4">
        {organization.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={organization.logoUrl}
            alt={organization.name}
            className="h-10 w-10 flex-shrink-0 rounded-xl bg-white/95 object-contain p-1"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sc-teal to-sc-green font-serif text-lg font-bold">
            {initials || "?"}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-serif text-[17px] font-semibold leading-tight">
            {organization.name}
          </h1>
          {organization.tagline && (
            <p className="text-[11px] uppercase tracking-wider text-white/60">
              {organization.tagline}
            </p>
          )}
        </div>
      </div>

      {/* Sections de navigation */}
      <nav className="flex-1 py-1">
        {sections.map((section) => (
          <div key={section.label} className="py-1.5">
            <div className="px-5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
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
                  className={`flex items-center gap-3 border-l-[3px] px-5 py-[9px] text-[13.5px] transition-colors ${
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
