/** Helpers de formatage pour l'affichage (euros, pourcentages, indices). */

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Euros avec toutes les décimales utiles (2 au minimum, 6 au plus). */
const euroPrecisFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const nombreFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Nombre avec toutes les décimales utiles (0 au minimum, 6 au plus). */
const nombrePrecisFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

/** Espace insécable (typographie française : « 30 % », « 12 ha »). */
const INSECABLE = " ";

/**
 * Supprime le bruit de la représentation binaire d'un nombre décimal
 * (ex. 0,4389 × 100 = 43,890000000000001 en machine → 43,89).
 */
function nettoyer(valeur: number): number {
  return Number(valeur.toPrecision(12));
}

/** Formate un montant en euros : 1234.5 -> "1 234,50 €". */
export function formaterEuros(valeur: number): string {
  return euroFormatter.format(valeur);
}

/**
 * Formate un montant en euros SANS l'arrondir au centime, pour reproduire
 * fidèlement une valeur saisie dans le détail des calculs :
 * 947.52 -> "947,52 €", 1860.768 -> "1 860,768 €".
 */
export function formaterEurosPrecis(valeur: number): string {
  return euroPrecisFormatter.format(nettoyer(valeur));
}

/** Formate un nombre avec 2 décimales : 123.456 -> "123,46". */
export function formaterNombre(valeur: number): string {
  return nombreFormatter.format(valeur);
}

/**
 * Formate un nombre avec toutes ses décimales utiles (sans arrondi au
 * centime) : 14.2423 -> "14,2423", 8 -> "8".
 */
export function formaterNombrePrecis(valeur: number): string {
  return nombrePrecisFormatter.format(nettoyer(valeur));
}

/**
 * Formate un taux exprimé en fraction en pourcentage, avec toutes ses
 * décimales utiles : 0.4389 -> "43,89 %", 0.3 -> "30 %", 0.008 -> "0,8 %".
 */
export function formaterTaux(fraction: number): string {
  return `${nombrePrecisFormatter.format(nettoyer(fraction * 100))}${INSECABLE}%`;
}

/** Formate une variation en pourcentage avec signe : 5.23 -> "+5,23 %". */
export function formaterPourcentage(valeur: number): string {
  const signe = valeur > 0 ? "+" : "";
  return `${signe}${nombreFormatter.format(valeur)} %`;
}

/**
 * Convertit une saisie texte en nombre. Accepte la virgule ou le point
 * décimal, les espaces (y compris insécables) utilisés comme séparateurs de
 * milliers, et un symbole « € » ou « % » recopié depuis un avis d'imposition :
 * « 1 640 », « 43,89 % » et « 1 785,35 € » sont compris. Une saisie vide vaut
 * 0 ; une saisie incompréhensible donne NaN (signalée comme erreur, jamais
 * convertie silencieusement en une autre valeur).
 */
export function parseNombre(saisie: string): number {
  const nettoyee = saisie
    .replace(/[\s  ]/g, "")
    .replace(/[€%]/g, "")
    .replace(",", ".");
  return Number(nettoyee);
}
