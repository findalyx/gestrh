"use client";

import { useActionState } from "react";
import {
  publishAnnouncement,
  updateAnnouncement,
  type AnnouncementFormState,
} from "../_lib/actions";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

type Props = {
  /** Mode édition : id de l'annonce + valeurs par défaut */
  editing?: {
    id: string;
    title: string;
    body: string;
  };
};

export function AnnouncementForm({ editing }: Props) {
  const action = editing
    ? updateAnnouncement.bind(null, editing.id)
    : publishAnnouncement;
  const [state, formAction, pending] = useActionState<
    AnnouncementFormState | undefined,
    FormData
  >(action, undefined);

  const err = (k: "title" | "body" | "_form") => state?.errors?.[k]?.[0];
  // En création : si succès, on vide les champs
  const cleared = !editing && state?.ok;
  const defaultTitle = cleared
    ? ""
    : (state?.values?.title ?? editing?.title ?? "");
  const defaultBody = cleared
    ? ""
    : (state?.values?.body ?? editing?.body ?? "");

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      {err("_form") && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3 py-2 text-[12.5px] text-sc-danger">
          {err("_form")}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-lg border border-sc-green/30 bg-sc-green-light px-3 py-2 text-[12.5px] text-sc-green-dark">
          ✓ {state.message}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-[12px] font-medium text-sc-blue-darker">
          Titre <span className="text-sc-danger">*</span>
        </label>
        <input
          id="title"
          name="title"
          defaultValue={defaultTitle}
          required
          maxLength={140}
          className={inputCls}
        />
        {err("title") && <p className="text-[11.5px] text-sc-danger">{err("title")}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-[12px] font-medium text-sc-blue-darker">
          Contenu <span className="text-sc-danger">*</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={editing ? 8 : 5}
          defaultValue={defaultBody}
          required
          maxLength={4000}
          placeholder="Annonce visible par tout le personnel de l'organisation."
          className={`${inputCls} resize-none`}
        />
        {err("body") && <p className="text-[11.5px] text-sc-danger">{err("body")}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="attachments"
          className="text-[12px] font-medium text-sc-blue-darker"
        >
          Pièces jointes
        </label>
        <input
          id="attachments"
          name="attachments"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
          className="block w-full text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-sc-blue file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white hover:file:bg-sc-blue-dark"
        />
        <p className="text-[11px] text-gray-500">
          Images, PDF, Word, Excel — 5 Mo max par fichier. Sélectionne plusieurs
          fichiers avec Ctrl/Cmd.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-5 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending
            ? editing
              ? "Enregistrement…"
              : "Publication…"
            : editing
              ? "Enregistrer les modifications"
              : "Publier l'annonce"}
        </button>
      </div>
    </form>
  );
}
