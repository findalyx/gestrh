import { Icon, type IconName } from "@/components/Icon";

type Feature = { title: string; description: string };

type ModulePlaceholderProps = {
  icon: IconName;
  intro: string;
  /** Numéro de section dans les spécifications, ex : "5.2" */
  specRef: string;
  features: Feature[];
};

/**
 * Page de module non encore implémentée : présente l'objet du module
 * et la liste des fonctionnalités prévues par les spécifications.
 */
export function ModulePlaceholder({
  icon,
  intro,
  specRef,
  features,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4 rounded-xl border border-sc-border bg-white p-6 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sc-blue-light text-sc-blue">
          <Icon name={icon} size={22} />
        </div>
        <div>
          <p className="text-[13px] leading-relaxed text-gray-700">{intro}</p>
          <p className="mt-2 text-[12px] text-gray-500">
            Spécifications · §{specRef} — module à venir.
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-teal" />
          Fonctionnalités prévues
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
            >
              <h4 className="text-[13px] font-semibold text-sc-ink">
                {f.title}
              </h4>
              <p className="mt-1 text-[12px] leading-snug text-gray-500">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
