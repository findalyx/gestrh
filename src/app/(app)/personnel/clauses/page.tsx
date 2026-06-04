import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CLAUSE_LIBRARY } from "@/lib/clauses";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = [
  "Confidentialité",
  "Mobilité",
  "Non-concurrence",
  "Propriété intellectuelle",
  "Discipline",
] as const;

const CATEGORY_STYLE: Record<string, string> = {
  Confidentialité: "bg-sc-blue-light text-sc-blue",
  Mobilité: "bg-sc-teal-light text-sc-teal-dark",
  "Non-concurrence": "bg-sc-purple-light text-sc-purple",
  "Propriété intellectuelle": "bg-sc-green-light text-sc-green-dark",
  Discipline: "bg-sc-danger-light text-sc-danger",
};

export default function ClausesPage() {
  const byCategory = new Map<string, typeof CLAUSE_LIBRARY>();
  for (const c of CLAUSE_LIBRARY) {
    const arr = byCategory.get(c.category) ?? [];
    arr.push(c);
    byCategory.set(c.category, arr);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sc-blue-light text-sc-blue">
            <Icon name="compliance" size={22} />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold text-sc-blue-darker">
              Bibliothèque de clauses
            </h2>
            <p className="text-[12px] text-gray-600">
              {CLAUSE_LIBRARY.length} clauses types calibrées pour le droit
              sénégalais · réutilisables dans les contrats et avenants.
            </p>
          </div>
        </div>
        <Link
          href="/personnel"
          className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
        >
          ← Liste agents
        </Link>
      </div>

      <div className="space-y-5">
        {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => (
          <section key={cat}>
            <h3 className="mb-3 flex items-center gap-2 font-serif text-[14px] font-semibold text-sc-blue-darker">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_STYLE[cat]}`}
              >
                {cat}
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-[11px] font-normal text-gray-500">
                {byCategory.get(cat)!.length} clauses
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {byCategory.get(cat)!.map((c) => (
                <article
                  key={c.id}
                  className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
                >
                  <h4 className="text-[13px] font-semibold text-sc-blue-darker">
                    {c.title}
                  </h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-gray-700">
                    {c.body}
                  </p>
                  <div className="mt-3 text-[10px] uppercase tracking-wide text-gray-400">
                    Référence : {c.id}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
