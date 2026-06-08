import "server-only";

/**
 * Extraction des données d'un PDF de bulletins de paie (1 page = 1 bulletin).
 * Format SCIMD / Saint Christopher's Iba Mar Diop (texte sélectionnable).
 *
 * Utilise `unpdf` (build pdfjs adapté au serverless — pas de worker/canvas),
 * importé dynamiquement pour ne pas alourdir le rendu de la page.
 */

export type ParsedPayslip = {
  page: number;
  matricule: string | null; // sans le préfixe « S »
  name: string | null;
  period: string | null; // YYYY-MM
  brut: number | null;
  net: number | null;
  cotisation: number | null; // cotisations salariales (1er montant après « Total cotisation »)
};

const MONTHS: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  février: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  août: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
  décembre: "12",
};

function toInt(s: string | undefined | null): number | null {
  if (!s) return null;
  const digits = s.replace(/[^0-9]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

/**
 * Reconstruit le PREMIER nombre français d'une suite « 14 048 46 463 » où
 * plusieurs montants se suivent sur la même ligne (cas du « Total cotisation »
 * qui aligne salarial puis patronal). On prend le 1er token puis les groupes
 * de 3 chiffres consécutifs, et on s'arrête au 1er token ≠ 3 chiffres (= début
 * du montant suivant). Évite de coller deux montants en un nombre géant.
 */
function firstAmount(s: string | undefined | null): number | null {
  if (!s) return null;
  const tokens = s.trim().split(/[\s   ]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  let acc = tokens[0];
  for (let i = 1; i < tokens.length; i++) {
    if (/^\d{3}$/.test(tokens[i])) acc += tokens[i];
    else break;
  }
  const digits = acc.replace(/[^0-9]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

function parsePeriod(text: string): string | null {
  const m = text.match(
    /\b(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i,
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  return month ? `${m[2]}-${month}` : null;
}

export function parsePayslipPage(text: string, page: number): ParsedPayslip {
  const mat = text.match(/\bS(\d{3,5})\b/);
  const net = text.match(/NET\s*A?\s*PAYER\s*([\d   ]+)/i);
  const brut = text.match(/Total\s*Brut\s*([\d   ]+)/i);
  // « Total cotisation(s) » : 1er montant = cotisations salariales (le 2e =
  // charges patronales). Donne la vraie retenue, qui peut différer de
  // (brut − net) à cause des indemnités non imposables (transport…).
  const cotis = text.match(/Total\s*cotisations?\s*([\d   ]+)/i);
  const nm = text.match(
    /\b(?:Mme|Mlle|Mr|M)\b\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿ '\-]{2,30})/,
  );
  return {
    page,
    matricule: mat ? mat[1] : null,
    name: nm ? nm[1].replace(/\s+/g, " ").trim() : null,
    period: parsePeriod(text),
    brut: toInt(brut?.[1]),
    net: toInt(net?.[1]),
    // 1er nombre uniquement (salarial), pas salarial+patronal collés.
    cotisation: firstAmount(cotis?.[1]),
  };
}

export async function parsePayslips(buffer: Buffer): Promise<ParsedPayslip[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.map((t, i) => parsePayslipPage(t ?? "", i + 1));
}
