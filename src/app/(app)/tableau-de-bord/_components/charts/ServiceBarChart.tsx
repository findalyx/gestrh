"use client";

import { Bar } from "react-chartjs-2";
import { COMMON_FONT_FAMILY, SERVICE_PALETTE } from "./chart-setup";

type Item = { service: string; count: number };

export function ServiceBarChart({ data }: { data: Item[] }) {
  return (
    <div className="h-[260px]">
      <Bar
        data={{
          labels: data.map((d) => d.service),
          datasets: [
            {
              label: "Effectif",
              data: data.map((d) => d.count),
              backgroundColor: data.map(
                (_, i) => SERVICE_PALETTE[i % SERVICE_PALETTE.length],
              ),
              borderRadius: 6,
              maxBarThickness: 36,
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
                label: (ctx) => `${ctx.parsed.x} agent(s)`,
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
                font: { family: COMMON_FONT_FAMILY, size: 12 },
                color: "#1a2332",
              },
            },
          },
        }}
      />
    </div>
  );
}
