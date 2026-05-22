"use client";

import { Doughnut } from "react-chartjs-2";
import { COMMON_FONT_FAMILY, SC_COLORS } from "./chart-setup";

const FCFA = new Intl.NumberFormat("fr-FR");

function compactFcfa(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} Mds`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} K`;
  return String(n);
}

export function PayrollByGenderDonut({
  men,
  women,
}: {
  men: number;
  women: number;
}) {
  const total = men + women;
  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[12.5px] text-gray-400">
        Aucune donnée
      </div>
    );
  }
  return (
    <div className="relative h-[220px]">
      <Doughnut
        data={{
          labels: ["Hommes", "Femmes"],
          datasets: [
            {
              data: [men, women],
              backgroundColor: [SC_COLORS.blue, SC_COLORS.purple],
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
                  return `${ctx.label} : ${FCFA.format(v)} FCFA (${pct} %)`;
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
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <div className="font-serif text-xl font-bold text-sc-blue-darker">
          {compactFcfa(total)}
        </div>
        <div className="text-[10.5px] uppercase tracking-wider text-gray-500">
          FCFA total
        </div>
      </div>
    </div>
  );
}
