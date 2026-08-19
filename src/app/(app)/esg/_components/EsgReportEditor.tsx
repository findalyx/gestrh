"use client";

import { useActionState, useState } from "react";
import {
  ESG_SECTIONS,
  ESG_METRICS,
  type EsgMetric,
  type EsgSectionKey,
} from "../_lib/registry";
import { saveEsgAnswers, type EsgActionState } from "../_lib/actions";

type Answers = Record<string, { value: string; comment: string }>;

const inputCls =
  "w-full rounded-lg border border-sc-border bg-gray-50 px-3 py-1.5 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10";

export function EsgReportEditor({
  reportId,
  answers,
}: {
  reportId: string;
  answers: Answers;
}) {
  const action = saveEsgAnswers.bind(null, reportId);
  const [state, formAction, pending] = useActionState<EsgActionState, FormData>(
    action,
    undefined,
  );

  // Toutes les valeurs sont contrôlées → permet de calculer les % dérivés en direct.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(ESG_METRICS.map((m) => [m.key, answers[m.key]?.value ?? ""])),
  );
  const set = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const derived = (m: EsgMetric): string => {
    if (!m.derived) return "";
    const num = Number.parseFloat(values[m.derived.num] || "");
    const den = Number.parseFloat(values[m.derived.den] || "");
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return "—";
    return `${((num / den) * 100).toFixed(1)} %`;
  };

  const bySection = (s: EsgSectionKey) =>
    ESG_METRICS.filter((m) => m.section === s);

  return (
    <form action={formAction} className="space-y-4 pb-24">
      {ESG_SECTIONS.map((section, idx) => (
        <details
          key={section.key}
          open={idx === 0}
          className="group rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
        >
          <summary className="flex cursor-pointer items-center justify-between px-5 py-3 font-serif text-[15px] font-semibold text-sc-blue-darker">
            <span>{section.label}</span>
            <span className="text-[11px] font-normal text-gray-400">
              {bySection(section.key).length} champs
            </span>
          </summary>
          <div className="space-y-3 border-t border-sc-border px-5 py-4">
            {bySection(section.key).map((m) => (
              <FieldRow
                key={m.key}
                metric={m}
                value={values[m.key] ?? ""}
                comment={answers[m.key]?.comment ?? ""}
                derivedValue={derived(m)}
                onChange={(v) => set(m.key, v)}
              />
            ))}
          </div>
        </details>
      ))}

      {/* Barre d'enregistrement collante */}
      <div className="sticky bottom-0 z-30 -mx-1 rounded-t-xl border-t border-sc-border bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-end gap-3">
          {state?.ok && (
            <span className="text-[12.5px] font-medium text-sc-green-dark">
              ✓ {state.message}
            </span>
          )}
          {state && !state.ok && (
            <span className="text-[12.5px] font-medium text-sc-danger">
              {state.error}
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sc-blue px-5 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Enregistrer le rapport"}
          </button>
        </div>
      </div>
    </form>
  );
}

function FieldRow({
  metric: m,
  value,
  comment,
  derivedValue,
  onChange,
}: {
  metric: EsgMetric;
  value: string;
  comment: string;
  derivedValue: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-sc-border/70 bg-sc-blue-bg/20 p-3">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <label
          htmlFor={`v_${m.key}`}
          className="text-[12.5px] font-medium text-sc-blue-darker"
        >
          {m.label}
          {m.unit && (
            <span className="ml-1 text-[10.5px] text-gray-400">({m.unit})</span>
          )}
        </label>
        {m.auto && (
          <span className="rounded-full bg-sc-teal-light px-2 py-[1px] text-[9.5px] font-semibold uppercase tracking-wide text-sc-teal-dark">
            Auto RH
          </span>
        )}
        {m.derived && (
          <span className="rounded-full bg-gray-100 px-2 py-[1px] text-[9.5px] font-semibold uppercase tracking-wide text-gray-500">
            Calculé
          </span>
        )}
      </div>
      {m.definition && (
        <p className="mb-1.5 text-[11px] leading-snug text-gray-500">
          {m.definition}
        </p>
      )}

      {/* Champ valeur selon le type */}
      {m.derived ? (
        <div className="rounded-lg border border-dashed border-sc-border bg-white px-3 py-1.5 text-[13px] font-semibold text-sc-blue-darker">
          {derivedValue}
        </div>
      ) : m.type === "select" ? (
        <select
          id={`v_${m.key}`}
          name={`v_${m.key}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">—</option>
          {m.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : m.type === "boolean" ? (
        <select
          id={`v_${m.key}`}
          name={`v_${m.key}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">—</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      ) : (
        <input
          id={`v_${m.key}`}
          name={`v_${m.key}`}
          type={m.type === "number" || m.type === "percent" ? "number" : "text"}
          step={m.type === "percent" ? "0.1" : undefined}
          inputMode={
            m.type === "number" || m.type === "percent" ? "decimal" : undefined
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={m.illustrative}
          className={inputCls}
        />
      )}

      {/* Commentaire (colonne « Comments » du questionnaire) */}
      <input
        name={`c_${m.key}`}
        defaultValue={comment}
        placeholder="Commentaire (optionnel)"
        className="mt-1.5 w-full rounded-lg border border-transparent bg-transparent px-3 py-1 text-[11.5px] italic text-gray-600 outline-none transition focus:border-sc-border focus:bg-white"
      />
    </div>
  );
}
