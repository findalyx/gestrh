"use client";

import { Bar } from "react-chartjs-2";
import { COMMON_FONT_FAMILY, SC_COLORS } from "./chart-setup";

type Bucket = { range: string; men: number; women: number };

/**
 * Pyramide des âges : barres horizontales, hommes à droite (positif),
 * femmes à gauche (négatif).
 */
export function AgePyramidChart({ buckets }: { buckets: Bucket[] }) {
  return (
    <div className="h-[260px]">
      <Bar
        data={{
          labels: buckets.map((b) => b.range),
          datasets: [
            {
              label: "Femmes",
              data: buckets.map((b) => -b.women),
              backgroundColor: SC_COLORS.purple,
              borderRadius: 4,
              maxBarThickness: 24,
            },
            {
              label: "Hommes",
              data: buckets.map((b) => b.men),
              backgroundColor: SC_COLORS.blue,
              borderRadius: 4,
              maxBarThickness: 24,
            },
          ],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
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
                  const v = Math.abs(Number(ctx.parsed.x) || 0);
                  return `${ctx.dataset.label} : ${v}`;
                },
              },
            },
            datalabels: {
              display: (ctx) => Math.abs(Number(ctx.dataset.data[ctx.dataIndex]) || 0) > 0,
              color: "#ffffff",
              font: { family: COMMON_FONT_FAMILY, weight: "bold", size: 10 },
              anchor: "center",
              align: "center",
              formatter: (v) => {
                const abs = Math.abs(Number(v) || 0);
                return abs > 0 ? String(abs) : "";
              },
            },
          },
          scales: {
            x: {
              display: false,
              stacked: true,
            },
            y: {
              stacked: true,
              grid: { display: false },
              border: { display: false },
              ticks: {
                font: { family: COMMON_FONT_FAMILY, size: 11 },
                color: "#1a2332",
              },
            },
          },
        }}
      />
    </div>
  );
}
