import "server-only";

import path from "node:path";
import { promises as fs } from "node:fs";
import ExcelJS from "exceljs";
import { ESG_METRICS, type EsgMetric } from "./registry";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/app/(app)/esg/_lib/esg-template.xlsx",
);

export type EsgReportData = {
  period: string;
  label: string;
  answers: Record<string, { value: string; comment: string }>;
};

/** Convertit une réponse en valeur de cellule selon le type de l'indicateur. */
function cellValue(m: EsgMetric, raw: string): string | number | null {
  const v = (raw ?? "").trim();
  if (v === "") return null;
  if (m.type === "number" || m.type === "percent") {
    const n = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  if (m.type === "boolean") {
    if (v === "true") return "True";
    if (v === "false") return "False";
    return v;
  }
  return v;
}

function parsePct(v: string | undefined): number | null {
  const n = Number.parseFloat((v || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** % dérivé calculé depuis deux réponses (numérateur / dénominateur). */
function derivedValue(
  m: EsgMetric,
  answers: EsgReportData["answers"],
): number | null {
  if (!m.derived) return null;
  const num = parsePct(answers[m.derived.num]?.value);
  const den = parsePct(answers[m.derived.den]?.value);
  if (num == null || den == null || den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

/**
 * Écrit la valeur d'un indicateur dans une cellule.
 * Les % sont écrits en FRACTION (0.476) avec format Excel « 0.0% » pour un
 * affichage cohérent (« 47,6 % »), quel que soit le format d'origine du modèle.
 */
function writeCell(
  ws: ExcelJS.Worksheet,
  addr: string,
  m: EsgMetric,
  answers: EsgReportData["answers"],
): void {
  const cell = ws.getCell(addr);
  if (m.type === "percent") {
    const pct = m.derived ? derivedValue(m, answers) : parsePct(answers[m.key]?.value);
    if (pct == null) {
      cell.value = null;
    } else {
      cell.value = pct / 100;
      cell.numFmt = "0.0%";
    }
    return;
  }
  cell.value = cellValue(m, answers[m.key]?.value ?? "");
}

/** "2026-Q2" → "Q2" */
function quarterTag(period: string): string {
  const m = period.match(/Q(\d)/);
  return m ? `Q${m[1]}` : period;
}

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-Q2" → "April - June 2026" (en-tête anglais pour l'export). */
function quarterLabelEn(period: string): string {
  const m = period.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return period;
  const start = (Number(m[2]) - 1) * 3;
  return `${MONTHS_EN[start]} - ${MONTHS_EN[start + 2]} ${m[1]}`;
}

const HIST_COLS = ["G", "H", "I", "J"] as const;

/**
 * Construit le classeur Excel au format Admaius : colonne E = trimestre courant
 * (+ commentaires en F), colonnes G/H/I/J = jusqu'à 4 trimestres antérieurs.
 */
export async function buildEsgExport(
  current: EsgReportData,
  history: EsgReportData[],
): Promise<Buffer> {
  const templateBuf = await fs.readFile(TEMPLATE_PATH);
  const wb = new ExcelJS.Workbook();
  // Cast : incompatibilité de types Buffer entre @types/node et exceljs
  // (le chargement accepte bien un Buffer Node à l'exécution).
  await wb.xlsx.load(templateBuf as never);
  const ws = wb.getWorksheet("Quarterly data");
  if (!ws) throw new Error("Feuille « Quarterly data » introuvable.");

  const hist = history.slice(0, 4);

  // En-têtes de trimestres
  ws.getCell("E3").value = quarterTag(current.period);
  ws.getCell("E4").value = quarterLabelEn(current.period);
  ws.getCell("F4").value = "Comments";
  ws.getCell("K4").value = "Comments";
  hist.forEach((h, i) => {
    ws.getCell(`${HIST_COLS[i]}3`).value = quarterTag(h.period);
    ws.getCell(`${HIST_COLS[i]}4`).value = quarterLabelEn(h.period);
  });

  // Lignes d'indicateurs
  for (const m of ESG_METRICS) {
    const row = m.row;

    // Trimestre courant (E) + commentaire (F)
    writeCell(ws, `E${row}`, m, current.answers);
    if (!m.derived) {
      const c = current.answers[m.key]?.comment;
      if (c) ws.getCell(`F${row}`).value = c;
    }

    // Trimestres antérieurs (G/H/I/J)
    hist.forEach((h, i) => {
      writeCell(ws, `${HIST_COLS[i]}${row}`, m, h.answers);
    });

    // Commentaire (K) = celui du dernier trimestre historique (colonne J)
    const jReport = hist[3];
    if (jReport && !m.derived) {
      const c = jReport.answers[m.key]?.comment;
      if (c) ws.getCell(`K${row}`).value = c;
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
