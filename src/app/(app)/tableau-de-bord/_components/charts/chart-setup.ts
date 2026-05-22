"use client";

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

// Enregistrement unique des composants Chart.js utilisés dans le dashboard.
// Importé par chaque composant de graphique pour garantir l'initialisation.
ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  ChartDataLabels,
);

// Plugin chartjs-plugin-datalabels : on l'enregistre globalement mais on
// l'active uniquement sur les graphiques qui en ont besoin (via `plugins.datalabels`).
ChartJS.defaults.set("plugins.datalabels", {
  display: false,
});

// Palette officielle St Christopher (cf. globals.css)
export const SC_COLORS = {
  blue: "#3359a4",
  blueDark: "#244280",
  blueDarker: "#1a3066",
  blueLight: "#e8eef8",
  purple: "#554596",
  purpleLight: "#edeaf5",
  green: "#7ab929",
  greenDark: "#5e8f1f",
  greenLight: "#ecf6dc",
  teal: "#28b5be",
  tealDark: "#1f8f96",
  tealLight: "#dcf4f6",
  warning: "#e6a817",
  danger: "#d9534f",
  gray: "#94a3b8",
  grayLight: "#e2e8f0",
} as const;

export const SERVICE_PALETTE = [
  SC_COLORS.blue,
  SC_COLORS.purple,
  SC_COLORS.green,
  SC_COLORS.teal,
  SC_COLORS.blueDarker,
  SC_COLORS.warning,
  SC_COLORS.danger,
  SC_COLORS.gray,
];

export const COMMON_FONT_FAMILY =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
