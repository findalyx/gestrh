"use client";

import { Doughnut } from "react-chartjs-2";
import { COMMON_FONT_FAMILY, SC_COLORS } from "./chart-setup";

export function CategoryDonut({
  per,
  pats,
  prestataire = 0,
}: {
  per: number;
  pats: number;
  prestataire?: number;
}) {
  const total = per + pats + prestataire;
  return (
    <div className="relative h-[220px]">
      <Doughnut
        data={{
          labels: ["PER", "PATS", "Prestataires"],
          datasets: [
            {
              data: [per, pats, prestataire],
              backgroundColor: [
                SC_COLORS.blue,
                SC_COLORS.purple,
                SC_COLORS.warning,
              ],
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
                font: { family: COMMON_FONT_FAMILY, size: 12 },
                padding: 12,
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
                return total > 0 && (v / total) >= 0.05; // masque les parts < 5 %
              },
              color: "#ffffff",
              font: {
                family: COMMON_FONT_FAMILY,
                weight: "bold",
                size: 13,
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
      {total > 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
          <div className="font-serif text-2xl font-bold text-sc-blue-darker">
            {total}
          </div>
          <div className="text-[10.5px] uppercase tracking-wider text-gray-500">
            agents
          </div>
        </div>
      )}
    </div>
  );
}
