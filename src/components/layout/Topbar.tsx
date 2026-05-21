"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { NAV_ITEMS } from "@/lib/navigation";

export type TopbarNotification = {
  id: string;
  variant: "warning" | "danger" | "info";
  title: string;
  message: string;
  time: string;
};

type TopbarProps = {
  notifications: TopbarNotification[];
  user: { name: string; role: string; initials: string };
};

const VARIANT_STYLES: Record<
  TopbarNotification["variant"],
  { wrap: string; icon: "alert" | "info" | "bell" }
> = {
  warning: { wrap: "bg-sc-warning-light text-[#854f0b]", icon: "alert" },
  danger: { wrap: "bg-sc-danger-light text-sc-danger", icon: "info" },
  info: { wrap: "bg-sc-teal-light text-sc-teal-dark", icon: "bell" },
};

export function Topbar({ notifications, user }: TopbarProps) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const current =
    NAV_ITEMS.find(
      (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
    ) ?? NAV_ITEMS[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-sc-border bg-white px-8 py-4">
      <div>
        <h2 className="font-serif text-[22px] font-semibold text-sc-blue-darker">
          {current.title}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-gray-500">{current.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Recherche */}
        <div className="relative">
          <Icon
            name="search"
            size={15}
            className="absolute left-[13px] top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Rechercher un agent, service..."
            className="w-[280px] rounded-lg border border-sc-border bg-gray-50 py-[9px] pl-[38px] pr-3.5 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10"
          />
        </div>

        {/* Export */}
        <button className="flex items-center gap-[7px] rounded-lg bg-sc-blue px-4 py-[9px] text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark">
          <Icon name="export" size={14} />
          Exporter
        </button>

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
                <span className="rounded-full bg-sc-danger px-2 py-[2px] text-[11px] font-semibold text-white">
                  {notifications.length} nouvelles
                </span>
              </div>
              {notifications.map((n) => {
                const s = VARIANT_STYLES[n.variant];
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-2.5 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-sc-blue-bg"
                  >
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${s.wrap}`}
                    >
                      <Icon name={s.icon} size={14} />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[12.5px] font-semibold text-sc-ink">
                        {n.title}
                      </h5>
                      <p className="text-[11.5px] leading-snug text-gray-500">
                        {n.message}
                      </p>
                      <div className="mt-1 text-[10.5px] text-gray-500">
                        {n.time}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-sc-border bg-gray-50 px-4 py-2.5 text-center">
                <span className="text-xs font-semibold text-sc-blue">
                  Voir toutes les alertes →
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Profil utilisateur */}
        <div className="flex items-center gap-2.5 border-l border-sc-border pl-3.5">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gradient-to-br from-sc-purple to-sc-blue text-[13px] font-semibold text-white">
            {user.initials}
          </div>
          <div>
            <p className="text-[13px] font-medium text-sc-ink">{user.name}</p>
            <p className="text-[11.5px] text-gray-500">{user.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
