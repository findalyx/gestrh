"use client";

import { Doughnut } from "react-chartjs-2";
import { COMMON_FONT_FAMILY } from "./chart-setup";

// Couleurs nettement distinctes pour bien séparer les deux sexes.
const MEN_COLOR = "#2f6fd0"; // bleu
const WOMEN_COLOR = "#e0559b"; // rose/magenta

export function GenderDonut({ men, women }: { men: number; women: number }) {
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
              backgroundColor: [MEN_COLOR, WOMEN_COLOR],
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
                  return `${ctx.label} : ${v} agent${v > 1 ? "s" : ""} (${pct} %)`;
                },
              },
            },
            datalabels: {
              display: (ctx) => {
                const v = Number(ctx.dataset.data[ctx.dataIndex]) || 0;
                return total > 0 && v / total >= 0.05;
              },
              color: "#ffffff",
              font: {
                family: COMMON_FONT_FAMILY,
                weight: "bold",
                size: 13,
              },
              // Affiche « 31 · 58% » sur chaque part
              formatter: (value) => {
                const v = Number(value) || 0;
                if (total === 0) return "";
                return `${v}\n${((v / total) * 100).toFixed(0)}%`;
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
          agents
        </div>
      </div>
    </div>
  );
}
