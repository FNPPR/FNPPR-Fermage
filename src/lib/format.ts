/** Helpers de formatage pour l'affichage (euros, pourcentages, indices). */

import { arrondir } from "./fermage";

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Euros avec toutes les décimales utiles (2 au minimum, 9 au plus). */
const euroPrecisFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 9,
});

const nombreFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Nombre avec toutes les décimales utiles (0 au minimum, 9 au plus). */
const nombrePrecisFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 9,
});

/** Espace insécable (typographie française : « 30 % », « 12 ha »). */
const INSECABLE = " ";

/** Signe moins typographique (U+2212), plus lisible que le trait d'union. */
export const MOINS = "−";

/**
 * Supprime le bruit de la représentation binaire d'un nombre décimal
 * (ex. 0,4389 × 100 = 43,890000000000001 en machine → 43,89). Un zéro
 * négatif devient 0.
 */
function nettoyer(valeur: number): number {
  const v = Number(valeur.toPrecision(12));
  return v === 0 ? 0 : v;
}

/**
 * Finitions typographiques : signe moins « − » pour les nombres négatifs, et
 * espace insécable ordinaire comme séparateur de milliers (l'espace fine
 * insécable produite par le navigateur manque à certaines polices et
 * disparaît alors à l'impression : « 14150,18 € »).
 */
function signe(texte: string): string {
  return texte.replace(/^-/, MOINS).replace(/\u202f/g, INSECABLE);
}

/**
 * Formate un montant en euros, arrondi au centime comme les calculs
 * (arrondi commercial) : 1234.5 -> "1 234,50 €", -41.59 -> "−41,59 €".
 * Un montant qui s'arrondit à zéro s'affiche « 0,00 € », jamais « −0,00 € ».
 */
export function formaterEuros(valeur: number): string {
  return signe(euroFormatter.format(arrondir(valeur, 2)));
}

/**
 * Formate un montant en euros SANS l'arrondir au centime, pour reproduire
 * fidèlement une valeur saisie dans le détail des calculs :
 * 947.52 -> "947,52 €", 1860.768 -> "1 860,768 €".
 */
export function formaterEurosPrecis(valeur: number): string {
  return signe(euroPrecisFormatter.format(nettoyer(valeur)));
}

/** Formate un nombre avec 2 décimales : 123.456 -> "123,46". */
export function formaterNombre(valeur: number): string {
  return signe(nombreFormatter.format(arrondir(valeur, 2)));
}

/**
 * Formate un nombre avec toutes ses décimales utiles (sans arrondi au
 * centime) : 14.2423 -> "14,2423", 8 -> "8", 31.89412 -> "31,89412".
 */
export function formaterNombrePrecis(valeur: number): string {
  return signe(nombrePrecisFormatter.format(nettoyer(valeur)));
}

/**
 * Formate un taux exprimé en fraction en pourcentage, avec toutes ses
 * décimales utiles : 0.4389 -> "43,89 %", 0.3 -> "30 %", 0.008 -> "0,8 %".
 */
export function formaterTaux(fraction: number): string {
  return `${signe(nombrePrecisFormatter.format(nettoyer(fraction * 100)))}${INSECABLE}%`;
}

/** Formate une variation en pourcentage avec signe : 5.23 -> "+5,23 %". */
export function formaterPourcentage(valeur: number): string {
  const v = arrondir(valeur, 2);
  const plus = v > 0 ? "+" : "";
  return `${plus}${signe(nombreFormatter.format(v))} %`;
}

/**
 * Convertit une saisie texte en nombre. Accepte la virgule ou le point
 * décimal, les espaces (y compris insécables) utilisés comme séparateurs de
 * milliers, et un symbole « € » ou « % » recopié depuis un avis d'imposition :
 * « 1 640 », « 43,89 % » et « 1 785,35 € » sont compris. Une saisie vide vaut
 * 0 ; une saisie incompréhensible donne NaN (signalée comme erreur, jamais
 * convertie silencieusement en une autre valeur) : lettres, séparateurs
 * multiples (« 1.234,56 »), notation scientifique ou hexadécimale.
 */
export function parseNombre(saisie: string): number {
  const nettoyee = saisie
    .replace(/[\s  ]/g, "")
    .replace(/[€%]/g, "")
    .replace(/^[−–]/, "-")
    .replace(",", ".");
  if (nettoyee === "") return 0;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(nettoyee)) return Number.NaN;
  return Number(nettoyee);
}

/** Vrai pour une saisie vide (blancs, « € » ou « % » seuls compris). */
export function saisieVide(saisie: string): boolean {
  return saisie.replace(/[\s  €%]/g, "") === "";
}
