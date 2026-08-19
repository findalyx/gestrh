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

/** % dérivé calculé depuis deux réponses (numérateur / dénominateur). */
function derivedValue(
  m: EsgMetric,
  answers: EsgReportData["answers"],
): number | null {
  if (!m.derived) return null;
  const num = Number.parseFloat(
    (answers[m.derived.num]?.value || "").replace(",", "."),
  );
  const den = Number.parseFloat(
    (answers[m.derived.den]?.value || "").replace(",", "."),
  );
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

/** "2026-Q2" → "Q2" */
function quarterTag(period: string): string {
  const m = period.match(/Q(\d)/);
  return m ? `Q${m[1]}` : period;
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
  ws.getCell("E4").value = current.label;
  ws.getCell("F4").value = "Comments";
  ws.getCell("K4").value = "Comments";
  hist.forEach((h, i) => {
    ws.getCell(`${HIST_COLS[i]}3`).value = quarterTag(h.period);
    ws.getCell(`${HIST_COLS[i]}4`).value = h.label;
  });

  // Lignes d'indicateurs
  for (const m of ESG_METRICS) {
    const row = m.row;

    // Trimestre courant (E) + commentaire (F)
    if (m.derived) {
      ws.getCell(`E${row}`).value = derivedValue(m, current.answers);
    } else {
      const a = current.answers[m.key];
      ws.getCell(`E${row}`).value = cellValue(m, a?.value ?? "");
      if (a?.comment) ws.getCell(`F${row}`).value = a.comment;
    }

    // Trimestres antérieurs (G/H/I/J)
    hist.forEach((h, i) => {
      const col = HIST_COLS[i];
      ws.getCell(`${col}${row}`).value = m.derived
        ? derivedValue(m, h.answers)
        : cellValue(m, h.answers[m.key]?.value ?? "");
    });

    // Commentaire (K) = celui du dernier trimestre historique (colonne J)
    const jReport = hist[3];
    if (jReport && !m.derived && jReport.answers[m.key]?.comment) {
      ws.getCell(`K${row}`).value = jReport.answers[m.key].comment;
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
