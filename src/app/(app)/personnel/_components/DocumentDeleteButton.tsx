"use client";

import { useState } from "react";
import { deleteAgentDocument } from "../_lib/document-actions";

export function DocumentDeleteButton({
  agentId,
  documentId,
}: {
  agentId: string;
  documentId: string;
}) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (!confirm("Supprimer définitivement ce document ?")) return;
    setPending(true);
    try {
      await deleteAgentDocument(agentId, documentId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur de suppression.");
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[11px] font-semibold text-sc-danger hover:bg-sc-danger-light disabled:opacity-50"
    >
      {pending ? "…" : "Supprimer"}
    </button>
  );
}
