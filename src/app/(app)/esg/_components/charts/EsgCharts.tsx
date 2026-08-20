"use client";

import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  COMMON_FONT_FAMILY,
  SC_COLORS,
} from "@/app/(app)/tableau-de-bord/_components/charts/chart-setup";

const NUM = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(0)} K`;
  return NUM.format(n);
}

/**
 * Courbe compacte d'un indicateur sur les derniers trimestres. Les trimestres
 * non renseignés laissent un trou (spanGaps) plutôt qu'un zéro trompeur.
 */
export function EsgSparkLine({
  labels,
  values,
  color = "blue",
  unit,
}: {
  labels: string[];
  values: (number | null)[];
  color?: "blue" | "green" | "teal" | "purple";
  unit?: string;
}) {
  const stroke = {
    blue: SC_COLORS.blue,
    green: SC_COLORS.green,
    teal: SC_COLORS.teal,
    purple: SC_COLORS.purple,
  }[color];
  const fill = {
    blue: "rgba(51, 89, 164, 0.12)",
    green: "rgba(122, 185, 41, 0.14)",
    teal: "rgba(40, 181, 190, 0.14)",
    purple: "rgba(85, 69, 150, 0.12)",
  }[color];

  return (
    <div className="h-[130px]">
      <Line
        data={{
          labels,
          datasets: [
            {
              data: values,
              borderColor: stroke,
              backgroundColor: fill,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: stroke,
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2.5,
              spanGaps: true,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 20 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  `${NUM.format(Number(ctx.parsed.y))}${unit ? ` ${unit}` : ""}`,
              },
            },
            datalabels: {
              display: true,
              anchor: "end",
              align: "top",
              color: SC_COLORS.blueDarker,
              font: { family: COMMON_FONT_FAMILY, weight: "bold", size: 10 },
              formatter: (v) => (v == null ? "" : compact(Number(v))),
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                font: { family: COMMON_FONT_FAMILY, size: 10 },
                color: "#64748b",
              },
            },
            y: { display: false },
          },
        }}
      />
    </div>
  );
}

/** Barres horizontales des indicateurs de diversité (échelle 0-100 %). */
export function EsgDiversityBars({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  return (
    <div className="h-[200px]">
      <Bar
        data={{
          labels: items.map((i) => i.label),
          datasets: [
            {
              data: items.map((i) => i.value),
              backgroundColor: [
                SC_COLORS.blue,
                SC_COLORS.teal,
                SC_COLORS.purple,
                SC_COLORS.green,
                SC_COLORS.warning,
              ].slice(0, items.length),
              borderRadius: 6,
              barThickness: 18,
            },
          ],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 34 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => `${NUM.format(Number(ctx.parsed.x))} %` },
            },
            datalabels: {
              display: true,
              anchor: "end",
              align: "right",
              color: SC_COLORS.blueDarker,
              font: { family: COMMON_FONT_FAMILY, weight: "bold", size: 11 },
              formatter: (v) => `${NUM.format(Number(v) || 0)} %`,
            },
          },
          scales: {
            x: {
              min: 0,
              max: 100,
              grid: { color: "#eef2f7" },
              border: { display: false },
              ticks: {
                stepSize: 25,
                font: { family: COMMON_FONT_FAMILY, size: 10 },
                color: "#94a3b8",
                callback: (v) => `${v}%`,
              },
            },
            y: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                font: { family: COMMON_FONT_FAMILY, size: 11 },
                color: "#475569",
              },
            },
          },
        }}
      />
    </div>
  );
}

/** Répartition femmes / hommes de l'effectif (pourcentages en blanc). */
export function EsgGenderDonut({
  women,
  men,
}: {
  women: number;
  men: number;
}) {
  const total = women + men;
  return (
    <div className="h-[190px]">
      <Doughnut
        data={{
          labels: ["Femmes", "Hommes"],
          datasets: [
            {
              data: [women, men],
              backgroundColor: [SC_COLORS.purple, SC_COLORS.blue],
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "58%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 10,
                font: { family: COMMON_FONT_FAMILY, size: 11 },
                color: "#475569",
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label} : ${NUM.format(Number(ctx.parsed))}`,
              },
            },
            datalabels: {
              display: true,
              color: "#fff",
              font: { family: COMMON_FONT_FAMILY, weight: "bold", size: 13 },
              formatter: (v) => {
                const n = Number(v) || 0;
                if (total === 0) return "";
                return `${Math.round((n / total) * 100)}%`;
              },
            },
          },
        }}
      />
    </div>
  );
}
