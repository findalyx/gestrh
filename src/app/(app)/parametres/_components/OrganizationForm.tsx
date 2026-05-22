"use client";

import { useActionState } from "react";
import {
  updateOrganization,
  uploadLogo,
  deleteLogo,
} from "../_lib/organization-actions";
import type {
  LogoActionState,
  OrgFormState,
} from "../_lib/organization-actions";

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

type Defaults = {
  name: string;
  shortName: string | null;
  tagline: string | null;
  address: string | null;
  city: string | null;
  country: string;
  ninea: string | null;
  rccm: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  capital: string | null; // formaté en string pour le formulaire (BigInt → string)
  bp: string | null;
  legalRepName: string | null;
  legalRepTitle: string | null;
  logoFilename: string | null;
};

export function OrganizationForm({
  defaults,
  logoUrl,
}: {
  defaults: Defaults;
  logoUrl: string | null;
}) {
  return (
    <div className="space-y-6">
      <LogoBlock currentLogoUrl={logoUrl} hasLogo={!!defaults.logoFilename} />
      <IdentityBlock defaults={defaults} />
    </div>
  );
}

// ============================================================
//  Bloc logo
// ============================================================
function LogoBlock({
  currentLogoUrl,
  hasLogo,
}: {
  currentLogoUrl: string | null;
  hasLogo: boolean;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState<LogoActionState, FormData>(
    uploadLogo,
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<LogoActionState, FormData>(
    deleteLogo,
    undefined,
  );

  return (
    <div className="rounded-xl border border-sc-border bg-white p-5">
      <h4 className="text-[13px] font-semibold text-sc-blue-darker">
        Logo de l&apos;organisation
      </h4>
      <p className="mt-1 text-[12px] text-gray-500">
        Affiché dans la barre latérale, l&apos;écran de connexion et l&apos;en-tête
        des bulletins de paie. PNG, JPG, SVG ou WebP — 2 Mo max.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        {/* Aperçu */}
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl border border-sc-border bg-sc-blue-bg">
          {currentLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentLogoUrl}
              alt="Logo actuel"
              className="max-h-20 max-w-20 object-contain"
            />
          ) : (
            <span className="text-[11px] text-gray-400">Aucun logo</span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <form action={uploadAction} className="flex flex-col gap-2">
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              required
              className="block w-full text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-sc-blue file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white hover:file:bg-sc-blue-dark"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={uploadPending}
                className="rounded-lg bg-sc-blue px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
              >
                {uploadPending ? "Envoi…" : "Mettre à jour le logo"}
              </button>
              {hasLogo && (
                <form action={deleteAction} className="inline">
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="rounded-lg border border-sc-danger/30 bg-white px-3 py-1.5 text-[12px] font-medium text-sc-danger transition hover:bg-sc-danger-light disabled:opacity-60"
                  >
                    {deletePending ? "…" : "Supprimer"}
                  </button>
                </form>
              )}
            </div>
          </form>
          {uploadState?.ok && (
            <p className="text-[12px] text-sc-green-dark">✓ {uploadState.message}</p>
          )}
          {uploadState && !uploadState.ok && (
            <p className="text-[12px] text-sc-danger">{uploadState.error}</p>
          )}
          {deleteState?.ok && (
            <p className="text-[12px] text-sc-green-dark">✓ {deleteState.message}</p>
          )}
          {deleteState && !deleteState.ok && (
            <p className="text-[12px] text-sc-danger">{deleteState.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Bloc identité (form)
// ============================================================
function IdentityBlock({ defaults }: { defaults: Defaults }) {
  const [state, formAction, pending] = useActionState<OrgFormState | undefined, FormData>(
    updateOrganization,
    undefined,
  );

  const v = (k: string): string =>
    (state?.values as Record<string, string> | undefined)?.[k] ?? "";

  const dflt = (k: keyof Defaults, fallback: string = ""): string =>
    (defaults[k] as string | null | undefined) ?? fallback;

  const err = (k: string) => state?.errors?.[k as never]?.[0];

  return (
    <form action={formAction} className="rounded-xl border border-sc-border bg-white p-5 space-y-4">
      <h4 className="text-[13px] font-semibold text-sc-blue-darker">
        Identité & contact
      </h4>

      {state?.errors?._form && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3 py-2 text-[12px] text-sc-danger">
          {state.errors._form[0]}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-lg border border-sc-green/30 bg-sc-green-light px-3 py-2 text-[12px] text-sc-green-dark">
          ✓ {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nom de l'organisation" name="name" required error={err("name")}>
          <input
            id="name"
            name="name"
            defaultValue={v("name") || dflt("name")}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Sigle / initiales" name="shortName" hint="Ex: SC, USC (max 8 car.)" error={err("shortName")}>
          <input
            id="shortName"
            name="shortName"
            defaultValue={v("shortName") || dflt("shortName")}
            maxLength={8}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Sous-titre" name="tagline" hint="Affiché sous le nom dans la sidebar" error={err("tagline")}>
        <input
          id="tagline"
          name="tagline"
          defaultValue={v("tagline") || dflt("tagline")}
          maxLength={60}
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <Field label="Adresse" name="address" error={err("address")}>
          <input
            id="address"
            name="address"
            defaultValue={v("address") || dflt("address")}
            className={inputCls}
          />
        </Field>
        <Field label="Ville" name="city" error={err("city")}>
          <input
            id="city"
            name="city"
            defaultValue={v("city") || dflt("city")}
            className={inputCls}
          />
        </Field>
        <Field label="Pays" name="country" error={err("country")}>
          <input
            id="country"
            name="country"
            defaultValue={v("country") || dflt("country", "Sénégal")}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="N° NINEA" name="ninea" hint="Identifiant fiscal" error={err("ninea")}>
          <input
            id="ninea"
            name="ninea"
            defaultValue={v("ninea") || dflt("ninea")}
            className={inputCls}
          />
        </Field>
        <Field label="N° RCCM" name="rccm" hint="Registre du commerce" error={err("rccm")}>
          <input
            id="rccm"
            name="rccm"
            defaultValue={v("rccm") || dflt("rccm")}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Téléphone" name="phone" error={err("phone")}>
          <input
            id="phone"
            name="phone"
            defaultValue={v("phone") || dflt("phone")}
            className={inputCls}
          />
        </Field>
        <Field label="Email" name="email" error={err("email")}>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={v("email") || dflt("email")}
            className={inputCls}
          />
        </Field>
        <Field label="Site web" name="website" error={err("website")}>
          <input
            id="website"
            name="website"
            type="url"
            placeholder="https://…"
            defaultValue={v("website") || dflt("website")}
            className={inputCls}
          />
        </Field>
      </div>

      {/* ============================================================
          Bloc Informations légales — utilisé pour les contrats PDF
          ============================================================ */}
      <div className="mt-2 border-t border-sc-border pt-4">
        <h5 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">
          Informations légales (figurent sur les contrats)
        </h5>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Capital social"
          name="capital"
          hint="En FCFA — ex: 10000000"
          error={err("capital")}
        >
          <input
            id="capital"
            name="capital"
            type="number"
            min={0}
            step={1}
            defaultValue={v("capital") || dflt("capital")}
            className={inputCls}
          />
        </Field>
        <Field
          label="Boîte postale"
          name="bp"
          hint="Ex: BP 45.000 Dakar-Fann"
          error={err("bp")}
        >
          <input
            id="bp"
            name="bp"
            defaultValue={v("bp") || dflt("bp")}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Nom du représentant légal"
          name="legalRepName"
          hint="Signataire des contrats"
          error={err("legalRepName")}
        >
          <input
            id="legalRepName"
            name="legalRepName"
            defaultValue={v("legalRepName") || dflt("legalRepName")}
            className={inputCls}
          />
        </Field>
        <Field
          label="Titre / fonction"
          name="legalRepTitle"
          hint="Ex: PDG, Directeur Général, Recteur…"
          error={err("legalRepTitle")}
        >
          <input
            id="legalRepTitle"
            name="legalRepTitle"
            defaultValue={v("legalRepTitle") || dflt("legalRepTitle")}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-5 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-[12px] font-medium text-sc-blue-darker">
        {label}
        {required && <span className="text-sc-danger"> *</span>}
        {hint && (
          <span className="ml-1 text-[10.5px] font-normal text-gray-400">
            ({hint})
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-[11.5px] text-sc-danger">{error}</p>}
    </div>
  );
}
