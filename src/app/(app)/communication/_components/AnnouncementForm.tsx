"use client";

import { useActionState, useState } from "react";
import type { StaffCategory } from "@prisma/client";
import { CATEGORY_LABEL } from "@/lib/announcement-audience";
import {
  publishAnnouncement,
  updateAnnouncement,
  type AnnouncementFormState,
} from "../_lib/actions";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

type Props = {
  /** Services proposés comme destinataires. */
  services: { id: string; name: string }[];
  /** Mode édition : id de l'annonce + valeurs par défaut */
  editing?: {
    id: string;
    title: string;
    body: string;
    categories: StaffCategory[];
    serviceIds: string[];
  };
};

const CATEGORIES: StaffCategory[] = ["PER", "PATS", "PRESTATAIRE"];

export function AnnouncementForm({ services, editing }: Props) {
  // Ciblage : aucune case cochée = tout le personnel.
  const [categories, setCategories] = useState<StaffCategory[]>(
    editing?.categories ?? [],
  );
  const [serviceIds, setServiceIds] = useState<string[]>(
    editing?.serviceIds ?? [],
  );
  const targeted = categories.length > 0 || serviceIds.length > 0;

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

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

      {/* Destinataires */}
      <div className="rounded-lg border border-sc-border bg-gray-50/60 p-3">
        <p className="text-[12px] font-medium text-sc-blue-darker">
          Destinataires
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Aucune case cochée = <strong>tout le personnel</strong>. Sinon
          l&apos;annonce est visible par les catégories <em>ou</em> les services
          sélectionnés.
        </p>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <label
              key={c}
              className={`cursor-pointer rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                categories.includes(c)
                  ? "border-sc-blue bg-sc-blue-light text-sc-blue"
                  : "border-sc-border bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                name="categories"
                value={c}
                checked={categories.includes(c)}
                onChange={() => setCategories((l) => toggle(l, c))}
                className="sr-only"
              />
              {CATEGORY_LABEL[c]}
            </label>
          ))}
        </div>

        {services.length > 0 && (
          <>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Services
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {services.map((sv) => (
                <label
                  key={sv.id}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                    serviceIds.includes(sv.id)
                      ? "border-sc-teal bg-sc-teal/10 text-sc-teal-dark"
                      : "border-sc-border bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="services"
                    value={sv.id}
                    checked={serviceIds.includes(sv.id)}
                    onChange={() => setServiceIds((l) => toggle(l, sv.id))}
                    className="sr-only"
                  />
                  {sv.name}
                </label>
              ))}
            </div>
          </>
        )}

        <p className="mt-2.5 text-[11.5px] text-gray-600">
          Visible par :{" "}
          <strong>
            {targeted
              ? [
                  ...categories.map((c) => CATEGORY_LABEL[c]),
                  ...serviceIds.map(
                    (id) => services.find((sv) => sv.id === id)?.name ?? "Service",
                  ),
                ].join(" · ")
              : "tout le personnel"}
          </strong>
        </p>
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
