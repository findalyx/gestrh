/**
 * Lecture des bulletins de paie SCIMD (PDF multi-pages, une page par agent).
 *
 * La lecture s'appuie sur la POSITION des textes dans la page, pas sur le texte
 * aplati. Le bulletin est un tableau à colonnes (Nbre · Base · Taux · Gain ·
 * Retenue salariale · Taux · Retenue patronale) et, une fois aplati, deux
 * montants voisins deviennent indissociables : « Total cotisation 642 524
 * 146 107 » ne peut pas être recoupé de façon fiable, puisque l'espace sert à
 * la fois de séparateur de milliers et de séparateur de colonnes.
 * En regroupant les fragments par ligne (même ordonnée) et en les triant par
 * abscisse, chaque cellule redevient une valeur distincte.
 */

export type ParsedPayslip = {
  page: number;
  matricule: string | null;
  name: string | null;
  period: string | null; // "YYYY-MM"
  brut: number | null;
  net: number | null;
  cotisation: number | null; // cotisations salariales (part employé)
  patronale: number | null; // charges patronales (part employeur)
  transport: number | null; // indemnité de transport (exonérée, hors brut)
};

const MONTHS: Record<string, string> = {
  janvier: "01",
  février: "02",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  août: "08",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  décembre: "12",
  decembre: "12",
};

/** Indemnité de transport plausible : en deçà, c'est un nombre de jours. */
const MIN_TRANSPORT = 1000;

type Cell = { x: number; text: string };
type Row = { y: number; cells: Cell[]; text: string };

/** Fragment de texte d'un PDF, tel que fourni par pdf.js. */
type TextItem = { str?: string; transform?: number[] };

/**
 * Un nombre francais de bulletin (« 1 737 445 », « 866,667 », « -17 700 »)
 * → entier, decimales ignorees. Le signe negatif compte : un impôt regularise
 * a la baisse rend la retenue salariale negative, et le total avec elle.
 */
function toAmount(s: string): number | null {
  const clean = s.trim();
  if (!/^[-−]?\d[\d\s  ]*(?:[.,]\d+)?$/.test(clean)) return null;
  const negative = /^[-−]/.test(clean);
  const integerPart = clean.split(/[.,]/)[0].replace(/[^0-9]/g, "");
  if (!integerPart) return null;
  const value = Number.parseInt(integerPart, 10);
  return negative ? -value : value;
}

/** Montants de la ligne, de gauche à droite (une cellule = un montant). */
function amountsOf(row: Row): number[] {
  const out: number[] = [];
  for (const c of row.cells) {
    const v = toAmount(c.text);
    if (v !== null) out.push(v);
  }
  return out;
}

/**
 * Regroupe les fragments d'une page en lignes : même ordonnée à ~2 points près
 * (les libellés et les montants d'une même ligne sont légèrement décalés), puis
 * tri de chaque ligne par abscisse.
 */
function buildRows(items: TextItem[]): Row[] {
  const raw = items
    .map((it) => ({
      text: (it.str ?? "").trim(),
      x: it.transform?.[4] ?? 0,
      y: it.transform?.[5] ?? 0,
    }))
    .filter((i) => i.text !== "");

  raw.sort((a, b) => b.y - a.y);

  const rows: Row[] = [];
  for (const item of raw) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= 2);
    if (row) {
      row.cells.push({ x: item.x, text: item.text });
    } else {
      rows.push({ y: item.y, cells: [{ x: item.x, text: item.text }], text: "" });
    }
  }
  for (const r of rows) {
    r.cells.sort((a, b) => a.x - b.x);
    r.text = r.cells.map((c) => c.text).join(" ");
  }
  return rows;
}

function findRow(rows: Row[], re: RegExp): Row | undefined {
  return rows.find((r) => re.test(r.text));
}

function parsePeriod(text: string): string | null {
  const m = text.match(
    /\b(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i,
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  return month ? `${m[2]}-${month}` : null;
}

export function parsePayslipRows(rows: Row[], page: number): ParsedPayslip {
  const fullText = rows.map((r) => r.text).join("\n");

  // Total Brut : dernier montant de la ligne.
  const brutRow = findRow(rows, /Total\s*Brut/i);
  const brutAmounts = brutRow ? amountsOf(brutRow) : [];
  const brut = brutAmounts.length > 0 ? brutAmounts[brutAmounts.length - 1] : null;

  // « NET A PAYER » partage sa ligne avec les totaux du mois : on ne retient que
  // le montant situé à DROITE du libellé.
  const netRow = findRow(rows, /NET\s*A?\s*PAYER/i);
  let net: number | null = null;
  if (netRow) {
    const labelX = netRow.cells.find((c) => /NET\s*A?\s*PAYER/i.test(c.text))?.x ?? 0;
    const after = netRow.cells
      .filter((c) => c.x > labelX)
      .map((c) => toAmount(c.text))
      .filter((v): v is number => v !== null);
    net = after.length > 0 ? after[0] : null;
  }

  // « Total cotisation » : deux colonnes de retenues, la salariale puis la
  // patronale. On prend les deux derniers montants de la ligne.
  const cotisRow = findRow(rows, /Total\s*cotisations?/i);
  const cotisAmounts = cotisRow ? amountsOf(cotisRow) : [];
  const cotisation =
    cotisAmounts.length >= 2
      ? cotisAmounts[cotisAmounts.length - 2]
      : cotisAmounts.length === 1
        ? cotisAmounts[0]
        : null;
  const patronale =
    cotisAmounts.length >= 2 ? cotisAmounts[cotisAmounts.length - 1] : null;

  // Indemnité de transport : ligne « Indemnité de transport », colonnes
  // Nbre · Base · Gain → le gain est le dernier montant.
  const transportRow = findRow(rows, /transport/i);
  const transportAmounts = transportRow ? amountsOf(transportRow) : [];
  const lastTransport =
    transportAmounts.length > 0
      ? transportAmounts[transportAmounts.length - 1]
      : null;
  const transport =
    lastTransport !== null && lastTransport >= MIN_TRANSPORT ? lastTransport : null;

  const mat = fullText.match(/\bS(\d{3,5})\b/);
  const nm = fullText.match(/\b(?:Mme|Mlle|Mr|M)\b\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿ '\-]{2,30})/);

  return {
    page,
    matricule: mat ? mat[1] : null,
    name: nm ? nm[1].replace(/\s+/g, " ").trim() : null,
    period: parsePeriod(fullText),
    brut,
    net,
    cotisation,
    patronale,
    transport,
  };
}

export async function parsePayslips(buffer: Buffer): Promise<ParsedPayslip[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const out: ParsedPayslip[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out.push(parsePayslipRows(buildRows(content.items as TextItem[]), i));
  }
  return out;
}

/** Réservé aux tests : construit les lignes depuis les fragments bruts. */
export { buildRows };
