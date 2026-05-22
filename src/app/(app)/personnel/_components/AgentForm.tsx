"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AgentStatus,
  Gender,
  StaffCategory,
  StaffSubCategory,
} from "@prisma/client";
import {
  SUB_CATEGORIES_BY_CATEGORY,
  type AgentFormState,
} from "../_lib/schema";

export type AgentFormDefaults = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  gender?: Gender;
  birthDate?: string; // YYYY-MM-DD
  birthPlace?: string;
  nationality?: string;
  maritalStatus?: string;
  category?: StaffCategory;
  subCategory?: StaffSubCategory;
  jobTitle?: string;
  serviceId?: string;
  status?: AgentStatus;
  hireDate?: string; // YYYY-MM-DD
};

type Service = { id: string; name: string; code: string };

type Props = {
  services: Service[];
  defaults: AgentFormDefaults;
  matricule?: string; // affiché en édition
  submitLabel: string;
  cancelHref: string;
  action: (state: AgentFormState | undefined, formData: FormData) => Promise<AgentFormState>;
};

const SUB_LABEL: Record<StaffSubCategory, string> = {
  PER_ENSEIGNEMENT: "Enseignement",
  PER_RECHERCHE: "Recherche",
  PATS_ADMINISTRATIF: "Administratif",
  PATS_TECHNIQUE: "Technique",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  RETRAITE: "Retraité",
  INACTIF: "Inactif",
};

export function AgentForm({
  services,
  defaults,
  matricule,
  submitLabel,
  cancelHref,
  action,
}: Props) {
  const [state, formAction, pending] = useActionState<AgentFormState | undefined, FormData>(
    action,
    undefined,
  );

  // L'état persistant côté client se limite à la catégorie : elle pilote la liste
  // des sous-catégories disponibles dans le select.
  const [category, setCategory] = useState<StaffCategory>(
    (state?.values?.category as StaffCategory) ??
      defaults.category ??
      StaffCategory.PER,
  );

  const v = (key: keyof AgentFormDefaults) =>
    state?.values?.[key] ?? defaults[key] ?? "";

  const err = (key: string) => state?.errors?.[key as never]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      {state?.errors?._form && (
        <div className="rounded-lg border border-sc-danger/30 bg-sc-danger-light px-3.5 py-2.5 text-[12.5px] text-sc-danger">
          {state.errors._form[0]}
        </div>
      )}

      {matricule && (
        <div className="rounded-lg border border-sc-border bg-sc-blue-bg px-4 py-2.5 text-[12.5px]">
          Matricule : <span className="font-mono font-semibold">{matricule}</span>{" "}
          <span className="text-gray-500">— ne peut pas être modifié</span>
        </div>
      )}

      <FieldGroup title="Identité">
        <Row>
          <Field label="Prénom" name="firstName" required error={err("firstName")}>
            <input
              id="firstName"
              name="firstName"
              defaultValue={v("firstName") as string}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Nom" name="lastName" required error={err("lastName")}>
            <input
              id="lastName"
              name="lastName"
              defaultValue={v("lastName") as string}
              required
              className={inputCls}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Sexe" name="gender" required error={err("gender")}>
            <select
              id="gender"
              name="gender"
              defaultValue={(v("gender") as string) || Gender.HOMME}
              required
              className={inputCls}
            >
              <option value={Gender.HOMME}>Homme</option>
              <option value={Gender.FEMME}>Femme</option>
            </select>
          </Field>
          <Field
            label="Date de naissance"
            name="birthDate"
            error={err("birthDate")}
          >
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              defaultValue={v("birthDate") as string}
              className={inputCls}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Lieu de naissance" name="birthPlace" error={err("birthPlace")}>
            <input
              id="birthPlace"
              name="birthPlace"
              defaultValue={v("birthPlace") as string}
              placeholder="Ex: Dakar, Thiès, Saint-Louis…"
              className={inputCls}
            />
          </Field>
          <Field label="Nationalité" name="nationality" error={err("nationality")}>
            <input
              id="nationality"
              name="nationality"
              defaultValue={v("nationality") as string}
              placeholder="Ex: Sénégalaise"
              className={inputCls}
            />
          </Field>
        </Row>
        <Row>
          <Field
            label="Situation de famille"
            name="maritalStatus"
            error={err("maritalStatus")}
          >
            <select
              id="maritalStatus"
              name="maritalStatus"
              defaultValue={v("maritalStatus") as string}
              className={inputCls}
            >
              <option value="">—</option>
              <option value="Célibataire">Célibataire</option>
              <option value="Marié(e)">Marié(e)</option>
              <option value="Divorcé(e)">Divorcé(e)</option>
              <option value="Veuf(ve)">Veuf(ve)</option>
            </select>
          </Field>
          <Field label="Adresse" name="address" error={err("address")}>
            <input
              id="address"
              name="address"
              defaultValue={v("address") as string}
              className={inputCls}
            />
          </Field>
        </Row>
      </FieldGroup>

      <FieldGroup title="Contact">
        <Row>
          <Field label="Email" name="email" required error={err("email")}>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={v("email") as string}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Téléphone" name="phone" error={err("phone")}>
            <input
              id="phone"
              name="phone"
              defaultValue={v("phone") as string}
              className={inputCls}
            />
          </Field>
        </Row>
      </FieldGroup>

      <FieldGroup title="Affectation">
        <Row>
          <Field label="Service" name="serviceId" required error={err("serviceId")}>
            <select
              id="serviceId"
              name="serviceId"
              defaultValue={v("serviceId") as string}
              required
              className={inputCls}
            >
              <option value="">— Choisir —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Poste" name="jobTitle" required error={err("jobTitle")}>
            <input
              id="jobTitle"
              name="jobTitle"
              defaultValue={v("jobTitle") as string}
              required
              className={inputCls}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Catégorie" name="category" required error={err("category")}>
            <select
              id="category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as StaffCategory)}
              required
              className={inputCls}
            >
              <option value={StaffCategory.PER}>PER (Enseignant / Recherche)</option>
              <option value={StaffCategory.PATS}>PATS (Administratif / Technique)</option>
            </select>
          </Field>
          <Field
            label="Sous-catégorie"
            name="subCategory"
            required
            error={err("subCategory")}
          >
            <select
              id="subCategory"
              name="subCategory"
              defaultValue={(v("subCategory") as string) || SUB_CATEGORIES_BY_CATEGORY[category][0]}
              key={category} // reset quand la catégorie change
              required
              className={inputCls}
            >
              {SUB_CATEGORIES_BY_CATEGORY[category].map((sc) => (
                <option key={sc} value={sc}>
                  {SUB_LABEL[sc]}
                </option>
              ))}
            </select>
          </Field>
        </Row>
        <Row>
          <Field
            label="Date d'embauche"
            name="hireDate"
            required
            error={err("hireDate")}
          >
            <input
              id="hireDate"
              name="hireDate"
              type="date"
              defaultValue={v("hireDate") as string}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Statut" name="status" required error={err("status")}>
            <select
              id="status"
              name="status"
              defaultValue={(v("status") as string) || AgentStatus.ACTIF}
              required
              className={inputCls}
            >
              {(Object.keys(STATUS_LABEL) as AgentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </Row>
      </FieldGroup>

      <div className="flex items-center justify-end gap-3 border-t border-sc-border pt-5">
        <Link
          href={cancelHref}
          className="rounded-lg border border-sc-border bg-white px-4 py-2.5 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sc-blue px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3.5 py-2 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-sc-border bg-white p-5">
      <legend className="px-2 font-serif text-[14px] font-semibold text-sc-blue-darker">
        {title}
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

function Field({
  label,
  name,
  required,
  error,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[12px] font-medium text-sc-blue-darker"
      >
        {label}
        {required && <span className="text-sc-danger"> *</span>}
      </label>
      {children}
      {error && <p className="text-[11.5px] text-sc-danger">{error}</p>}
    </div>
  );
}
