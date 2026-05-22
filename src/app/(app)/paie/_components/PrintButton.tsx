"use client";

import { Icon } from "@/components/Icon";

export function PrintButton({ label = "Imprimer / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
      title="Ouvrir la fenêtre d'impression — choisir « Enregistrer en PDF » pour télécharger"
    >
      <Icon name="export" size={13} />
      {label}
    </button>
  );
}
