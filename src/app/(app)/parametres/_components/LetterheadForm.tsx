"use client";

import { useActionState } from "react";
import {
  uploadLetterhead,
  deleteLetterhead,
  type LogoActionState,
} from "../_lib/organization-actions";

export function LetterheadForm({ exists }: { exists: boolean }) {
  const [upState, upAction, upPending] = useActionState<
    LogoActionState,
    FormData
  >(uploadLetterhead, undefined);
  const [delState, delAction, delPending] = useActionState<
    LogoActionState,
    FormData
  >(deleteLetterhead, undefined);

  const state = upState ?? delState;

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-gray-600">
        Téléversez le papier en-tête officiel de l&apos;établissement au format
        Word (<span className="font-mono">.docx</span>) — en-tête (logo) et pied
        de page. Il sera appliqué automatiquement aux attestations générées
        (congés, reprise, travail). Le fichier est stocké de façon privée et
        n&apos;est jamais exposé publiquement.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
            exists
              ? "bg-sc-green-light text-sc-green-dark"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {exists
            ? "✓ Papier en-tête configuré"
            : "Aucun papier en-tête (texte simple)"}
        </span>
      </div>

      <form action={upAction} className="flex flex-wrap items-center gap-3">
        <input
          name="letterhead"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          className="block text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-sc-blue-light file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-sc-blue"
        />
        <button
          type="submit"
          disabled={upPending}
          className="rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {upPending ? "Envoi…" : exists ? "Remplacer" : "Téléverser"}
        </button>

        {exists && (
          <button
            type="submit"
            formAction={delAction}
            disabled={delPending}
            className="rounded-lg border border-sc-border bg-white px-4 py-2 text-[12.5px] font-medium text-gray-700 transition hover:text-sc-danger disabled:opacity-60"
          >
            {delPending ? "Suppression…" : "Supprimer"}
          </button>
        )}
      </form>

      {state && !state.ok && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3 py-2 text-[12.5px] text-sc-danger">
          {state.error}
        </div>
      )}
      {state && state.ok && (
        <div className="rounded-lg border border-sc-green/30 bg-sc-green-light px-3 py-2 text-[12.5px] text-sc-green-dark">
          {state.message}
        </div>
      )}
    </div>
  );
}
