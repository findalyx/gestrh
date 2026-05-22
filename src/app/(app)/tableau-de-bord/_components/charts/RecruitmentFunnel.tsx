"use client";

import { Bar } from "react-chartjs-2";
import { COMMON_FONT_FAMILY, SC_COLORS } from "./chart-setup";

type Item = { stage: string; count: number };

const COLORS = [
  SC_COLORS.blue,
  SC_COLORS.teal,
  SC_COLORS.warning,
  SC_COLORS.purple,
  SC_COLORS.green,
];

export function RecruitmentFunnel({ data }: { data: Item[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="h-[240px]">
      <Bar
        data={{
          labels: data.map((d) => d.stage),
          datasets: [
            {
              label: "Candidats",
              data: data.map((d) => d.count),
              backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]),
              borderRadius: 6,
              maxBarThickness: 32,
            },
          ],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 28 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = Number(ctx.parsed.x) || 0;
                  const pct = max > 0 ? ((v / max) * 100).toFixed(0) : "0";
                  return `${v} candidat(s) · ${pct} % du sommet`;
                },
              },
            },
            datalabels: {
              display: true,
              anchor: "end",
              align: "end",
              color: "#1a3066",
              font: { family: COMMON_FONT_FAMILY, weight: "bold", size: 11 },
              formatter: (v) => (Number(v) > 0 ? String(v) : ""),
            },
          },
          scales: {
            x: {
              display: false,
              beginAtZero: true,
            },
            y: {
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
