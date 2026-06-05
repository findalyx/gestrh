"use client";

import { Fragment, useRef, useState, type MouseEvent } from "react";

export type HeatmapCellData = {
  dateISO: string;
  present: number;
  absent: number;
  total: number;
  rate: number; // 0..1
  absentNames: string[];
};

export type HeatmapRow = {
  service: string;
  cells: HeatmapCellData[];
};

const WEEKDAY_LABEL: Record<number, string> = {
  1: "L",
  2: "M",
  3: "M",
  4: "J",
  5: "V",
};

const HEAT_LEVELS = [
  "bg-sc-blue-bg",
  "bg-sc-teal-light",
  "bg-sc-teal-light",
  "bg-sc-teal",
  "bg-sc-teal-dark",
  "bg-sc-blue-darker",
];

function rateToLevel(rate: number): number {
  if (rate >= 0.97) return 5;
  if (rate >= 0.92) return 4;
  if (rate >= 0.85) return 3;
  if (rate >= 0.75) return 2;
  if (rate >= 0.6) return 1;
  return 0;
}

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

type Hovered = {
  cell: HeatmapCellData;
  service: string;
  rect: { left: number; top: number; width: number; height: number };
};

export function HeatmapGrid({
  rows,
  daysISO,
}: {
  rows: HeatmapRow[];
  daysISO: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<Hovered | null>(null);

  function onCellEnter(
    e: MouseEvent<HTMLDivElement>,
    cell: HeatmapCellData,
    service: string,
  ) {
    const target = e.currentTarget;
    const container = containerRef.current;
    if (!container) return;
    const cellRect = target.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    setHovered({
      cell,
      service,
      rect: {
        left: cellRect.left - contRect.left,
        top: cellRect.top - contRect.top,
        width: cellRect.width,
        height: cellRect.height,
      },
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-gray-400">
        Aucun service avec des agents actifs.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="grid w-full items-center gap-x-1 gap-y-1.5"
        style={{
          gridTemplateColumns: `max-content repeat(${daysISO.length}, minmax(0, 1fr))`,
        }}
      >
        {rows.map((row, ri) => (
          <Fragment key={ri}>
            <div className="pr-3 text-right text-[11.5px] text-gray-700 whitespace-nowrap">
              {row.service}
            </div>
            {row.cells.map((c, ci) => {
              const cls = HEAT_LEVELS[rateToLevel(c.rate)];
              return (
                <div
                  key={ci}
                  onMouseEnter={(e) => onCellEnter(e, c, row.service)}
                  onMouseLeave={() => setHovered(null)}
                  className={`aspect-square w-full cursor-pointer rounded-[3px] transition-transform duration-150 ease-out hover:scale-[1.4] hover:shadow-md ${cls}`}
                />
              );
            })}
          </Fragment>
        ))}

        {/* Étiquettes des jours en bas */}
        <div />
        {daysISO.map((iso, i) => (
          <div key={i} className="text-center text-[10px] text-gray-400">
            {WEEKDAY_LABEL[new Date(iso).getDay()]}
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
        <span>Faible présence</span>
        {HEAT_LEVELS.map((cls, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded ${cls}`} />
        ))}
        <span>Forte présence</span>
      </div>

      {/* Popup d'information */}
      {hovered && <HeatmapTooltip hovered={hovered} totalCols={daysISO.length} />}
    </div>
  );
}

function HeatmapTooltip({
  hovered,
  totalCols,
}: {
  hovered: Hovered;
  totalCols: number;
}) {
  const { cell, service, rect } = hovered;
  const pct = Math.round(cell.rate * 100);

  // Largeur de la popup, on aligne à droite si on est en bout de ligne
  const tooltipWidth = 220;
  // Décale vers la gauche si pas assez d'espace à droite
  const cellWithGap = rect.width + 4;
  const colIndex = Math.round((rect.left - 100) / cellWithGap); // approximatif
  const alignRight = colIndex > totalCols - 7;

  const left = alignRight
    ? rect.left + rect.width - tooltipWidth
    : rect.left;

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        top: rect.top + rect.height + 8,
        left: Math.max(0, left),
        width: tooltipWidth,
      }}
    >
      <div className="rounded-lg border border-sc-border bg-white p-3 text-[12px] shadow-[0_8px_24px_rgba(51,89,164,0.15)]">
        <p className="font-medium text-sc-blue-darker">{service}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {formatLongDate(cell.dateISO)}
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="font-serif text-base font-bold text-sc-blue-darker">
            {pct}%
          </p>
          <p className="text-[11px] text-gray-600">
            <span className="font-semibold">{cell.present}</span>/{cell.total} présents
          </p>
        </div>
        {cell.absent > 0 ? (
          <div className="mt-2 border-t border-sc-border pt-2">
            <p className="text-[10.5px] uppercase tracking-wider text-gray-500">
              Absent{cell.absent > 1 ? "s" : ""} ({cell.absent})
            </p>
            <ul className="mt-0.5 space-y-0.5 text-[11px] text-gray-700">
              {cell.absentNames.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
              {cell.absent > cell.absentNames.length && (
                <li className="text-gray-400">
                  + {cell.absent - cell.absentNames.length} autre(s)
                </li>
              )}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-[10.5px] text-sc-green-dark">
            ✓ Aucune absence
          </p>
        )}
      </div>
    </div>
  );
}
