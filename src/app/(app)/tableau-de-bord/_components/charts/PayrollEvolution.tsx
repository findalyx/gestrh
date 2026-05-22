"use client";

import { Line } from "react-chartjs-2";
import { COMMON_FONT_FAMILY, SC_COLORS } from "./chart-setup";

type Item = { period: string; total: number };

const FCFA = new Intl.NumberFormat("fr-FR");

function formatPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
  }).format(new Date(y, m - 1, 1));
}

function compactFcfa(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Mds`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} K`;
  return String(n);
}

export function PayrollEvolution({ data }: { data: Item[] }) {
  return (
    <div className="h-[240px]">
      <Line
        data={{
          labels: data.map((d) => formatPeriod(d.period)),
          datasets: [
            {
              label: "Masse salariale nette",
              data: data.map((d) => d.total),
              borderColor: SC_COLORS.blue,
              backgroundColor: "rgba(51, 89, 164, 0.12)",
              fill: true,
              tension: 0.35,
              pointBackgroundColor: SC_COLORS.blue,
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2.5,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 24 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${FCFA.format(Number(ctx.parsed.y))} FCFA`,
              },
            },
            datalabels: {
              display: true,
              anchor: "end",
              align: "top",
              color: "#1a3066",
              font: { family: COMMON_FONT_FAMILY, weight: "bold", size: 10 },
              formatter: (v) => compactFcfa(Number(v) || 0),
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
            y: {
              display: false,
            },
          },
        }}
      />
    </div>
  );
}
