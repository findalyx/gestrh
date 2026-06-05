"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";

/**
 * Coquille applicative responsive.
 *  - Desktop (lg+) : grille fixe sidebar 260px + contenu.
 *  - Mobile / tablette : sidebar en tiroir (drawer) ouvert par le hamburger
 *    de la topbar, avec fond semi-opaque. Se referme à la navigation.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: SidebarProps;
  topbar: Omit<TopbarProps, "onMenuClick">;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Referme le tiroir à chaque changement de page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar : tiroir sur mobile, colonne fixe sur desktop */}
      <div
        className={`no-print fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-200 ease-out lg:static lg:z-auto lg:transform-none ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar {...sidebar} />
      </div>

      {/* Fond semi-opaque (mobile uniquement) */}
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <main className="min-w-0">
        <Topbar {...topbar} onMenuClick={() => setOpen(true)} />
        <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6 print-content">
          {children}
        </div>
      </main>
    </div>
  );
}
