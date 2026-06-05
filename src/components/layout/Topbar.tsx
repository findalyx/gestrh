"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { NAV_ITEMS } from "@/lib/navigation";
import { logout } from "@/app/login/actions";

export type TopbarNotification = {
  id: string;
  variant: "warning" | "danger" | "info";
  title: string;
  message: string;
  link: string;
};

export type TopbarProps = {
  notifications: TopbarNotification[];
  user: { name: string; role: string; initials: string };
  /** Si true, on affiche la barre de recherche d'agents (DRH/Direction/Manager) */
  showSearch?: boolean;
  /** Callback du bouton hamburger (mobile) — ouvre le menu latéral. */
  onMenuClick?: () => void;
};

const VARIANT_STYLES: Record<
  TopbarNotification["variant"],
  { wrap: string; icon: "alert" | "info" | "bell" }
> = {
  warning: { wrap: "bg-sc-warning-light text-[#854f0b]", icon: "alert" },
  danger: { wrap: "bg-sc-danger-light text-sc-danger", icon: "info" },
  info: { wrap: "bg-sc-teal-light text-sc-teal-dark", icon: "bell" },
};

export function Topbar({
  notifications,
  user,
  showSearch = false,
  onMenuClick,
}: TopbarProps) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const current =
    NAV_ITEMS.find(
      (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
    ) ?? NAV_ITEMS[0];

  // Recherche contextuelle : selon le module courant, on cible la bonne page
  // (et son propre paramètre ?q=). Par défaut on cherche un agent.
  const search = pathname.startsWith("/paie")
    ? { action: "/paie", placeholder: "Rechercher un bulletin (nom, matricule)…" }
    : { action: "/personnel", placeholder: "Rechercher un agent…" };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-sc-border bg-white px-4 py-3.5 no-print sm:px-6 sm:py-4 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Ouvrir le menu"
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-lg border border-sc-border bg-gray-50 text-gray-700 transition hover:border-sc-blue hover:bg-sc-blue-light hover:text-sc-blue lg:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-serif text-lg font-semibold text-sc-blue-darker sm:text-[22px]">
            {current.title}
          </h2>
          <p className="mt-0.5 hidden truncate text-[12.5px] text-gray-500 sm:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Recherche contextuelle — cible le module courant (Manager + DRH + Direction) */}
        {showSearch && (
          <form
            action={search.action}
            method="get"
            className="relative hidden md:block"
          >
            <Icon
              name="search"
              size={15}
              className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              name="q"
              type="search"
              placeholder={search.placeholder}
              autoComplete="off"
              className="w-[280px] rounded-lg border border-sc-border bg-gray-50 py-[9px] pl-[38px] pr-3.5 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10"
            />
          </form>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            className="relative flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-sc-border bg-gray-50 text-gray-700 transition hover:border-sc-blue hover:bg-sc-blue-light hover:text-sc-blue"
          >
            <Icon name="bell" size={17} />
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-sc-danger px-[5px] text-[10px] font-bold text-white">
                {notifications.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_10px_30px_rgba(51,89,164,0.12)]">
              <div className="flex items-center justify-between border-b border-sc-border bg-sc-blue-bg px-[18px] py-3.5">
                <h4 className="font-serif text-sm font-semibold text-sc-blue-darker">
                  Alertes RH
                </h4>
                {notifications.length > 0 && (
                  <span className="rounded-full bg-sc-danger px-2 py-[2px] text-[11px] font-semibold text-white">
                    {notifications.length}
                  </span>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Icon
                    name="bell"
                    size={20}
                    className="mx-auto text-gray-300"
                  />
                  <p className="mt-2 text-[12.5px] text-gray-500">
                    Aucune alerte. Tout est à jour ✓
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const s = VARIANT_STYLES[n.variant];
                  return (
                    <Link
                      key={n.id}
                      href={n.link}
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-2.5 border-b border-gray-100 px-4 py-3 last:border-b-0 transition hover:bg-sc-blue-bg"
                    >
                      <div
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${s.wrap}`}
                      >
                        <Icon name={s.icon} size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-[12.5px] font-semibold text-sc-ink">
                          {n.title}
                        </h5>
                        <p className="text-[11.5px] leading-snug text-gray-500">
                          {n.message}
                        </p>
                      </div>
                      <span className="text-[11px] text-sc-blue">→</span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Profil utilisateur */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-label="Menu utilisateur"
            aria-expanded={userMenuOpen}
            className="flex items-center gap-2.5 border-l border-sc-border pl-3.5 transition hover:opacity-80"
          >
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gradient-to-br from-sc-purple to-sc-blue text-[13px] font-semibold text-white">
              {user.initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-[13px] font-medium text-sc-ink">{user.name}</p>
              <p className="text-[11.5px] text-gray-500">{user.role}</p>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[200px] overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_10px_30px_rgba(51,89,164,0.12)]">
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] font-medium text-sc-ink transition hover:bg-sc-blue-bg hover:text-sc-danger"
                >
                  <Icon name="logout" size={15} />
                  Se déconnecter
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
