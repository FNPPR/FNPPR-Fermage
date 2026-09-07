/** Helpers de formatage pour l'affichage (euros, pourcentages, indices). */

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nombreFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formate un montant en euros : 1234.5 -> "1 234,50 €". */
export function formaterEuros(valeur: number): string {
  return euroFormatter.format(valeur);
}

/** Formate un nombre avec 2 décimales : 123.456 -> "123,46". */
export function formaterNombre(valeur: number): string {
  return nombreFormatter.format(valeur);
}

/** Formate une variation en pourcentage avec signe : 5.23 -> "+5,23 %". */
export function formaterPourcentage(valeur: number): string {
  const signe = valeur > 0 ? "+" : "";
  return `${signe}${nombreFormatter.format(valeur)} %`;
}

/** Convertit une saisie texte (virgule ou point décimal) en nombre. */
export function parseNombre(saisie: string): number {
  return Number(saisie.replace(",", ".").trim());
}
