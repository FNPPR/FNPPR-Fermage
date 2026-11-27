/** Dates en toutes lettres, à la française. */

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « 2026-11-01 » → « 1er novembre 2026 » ; texte non reconnu rendu tel quel. */
export function dateEnLettres(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  const jour = Number(m[3]);
  const mois = MOIS[Number(m[2]) - 1];
  if (!mois || jour < 1 || jour > 31) return iso.trim();
  return `${jour === 1 ? "1er" : jour} ${mois} ${m[1]}`;
}

/** Date au format AAAA-MM-JJ (heure locale) ; par défaut, celle du jour. */
export function aujourdhuiIso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
