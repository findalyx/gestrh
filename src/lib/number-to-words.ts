/**
 * Conversion d'un entier en toutes lettres (français), pour les mentions
 * légales de montant (notes d'honoraires, contrats). Suffisant pour les
 * montants usuels (< 999 999 999).
 */
export function numberToWordsFr(n: number): string {
  n = Math.round(n);
  if (n === 0) return "zéro";
  if (n < 0) return `moins ${numberToWordsFr(-n)}`;

  const units = [
    "",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "dix-sept",
    "dix-huit",
    "dix-neuf",
  ];
  const tens = [
    "",
    "",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "soixante",
    "quatre-vingt",
    "quatre-vingt",
  ];

  function below100(num: number): string {
    if (num < 20) return units[num];
    const t = Math.floor(num / 10);
    const u = num % 10;
    if (t === 7 || t === 9) return `${tens[t]}-${units[10 + u]}`;
    if (u === 0) return tens[t] + (t === 8 ? "s" : "");
    if (u === 1 && t !== 8) return `${tens[t]} et un`;
    return `${tens[t]}-${units[u]}`;
  }

  function below1000(num: number): string {
    if (num < 100) return below100(num);
    const h = Math.floor(num / 100);
    const r = num % 100;
    const cent = h === 1 ? "cent" : `${units[h]} cent${r === 0 ? "s" : ""}`;
    return r === 0 ? cent : `${cent} ${below100(r)}`;
  }

  if (n < 1000) return below1000(n);

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    parts.push(millions === 1 ? "un million" : `${below1000(millions)} millions`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "mille" : `${below1000(thousands)} mille`);
  }
  if (rest > 0) parts.push(below1000(rest));
  return parts.join(" ");
}
