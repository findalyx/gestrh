"use client";

import { Doughnut } from "react-chartjs-2";
import { COMMON_FONT_FAMILY, SC_COLORS } from "./chart-setup";

type Item = { status: string; count: number };

const STATUS_COLOR: Record<string, string> = {
  PLANIFIEE: SC_COLORS.gray,
  EN_COURS: SC_COLORS.blue,
  TERMINEE: SC_COLORS.green,
  EN_RETARD: SC_COLORS.danger,
};

const STATUS_LABEL: Record<string, string> = {
  PLANIFIEE: "Planifiée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  EN_RETARD: "En retard",
};

export function EvaluationByStatus({ data }: { data: Item[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[12.5px] text-gray-400">
        Aucune évaluation à afficher
      </div>
    );
  }
  return (
    <div className="relative h-[220px]">
      <Doughnut
        data={{
          labels: data.map((d) => STATUS_LABEL[d.status] ?? d.status),
          datasets: [
            {
              data: data.map((d) => d.count),
              backgroundColor: data.map(
                (d) => STATUS_COLOR[d.status] ?? SC_COLORS.gray,
              ),
              borderColor: "#ffffff",
              borderWidth: 3,
              hoverOffset: 8,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "65%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                font: { family: COMMON_FONT_FAMILY, size: 11 },
                padding: 10,
                usePointStyle: true,
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = Number(ctx.parsed) || 0;
                  const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                  return `${ctx.label} : ${v} (${pct} %)`;
                },
              },
            },
            datalabels: {
              display: (ctx) => {
                const v = Number(ctx.dataset.data[ctx.dataIndex]) || 0;
                return total > 0 && (v / total) >= 0.05;
              },
              color: "#ffffff",
              font: {
                family: COMMON_FONT_FAMILY,
                weight: "bold",
                size: 12,
              },
              formatter: (value) => {
                const v = Number(value) || 0;
                if (total === 0) return "";
                return `${((v / total) * 100).toFixed(0)}%`;
              },
            },
          },
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <div className="font-serif text-2xl font-bold text-sc-blue-darker">
          {total}
        </div>
        <div className="text-[10.5px] uppercase tracking-wider text-gray-500">
          campagne
        </div>
      </div>
    </div>
  );
}
