/**
 * Bibliothèque de calcul des fermages.
 *
 * Toutes les fonctions sont pures (aucun effet de bord) afin d'être facilement
 * testables. Les montants sont manipulés en euros sous forme de nombres ; le
 * formatage (€, %) est réalisé dans la couche d'affichage.
 */

import { indicePourAnnee } from "../data/indices";

/** Arrondit un nombre à `decimales` chiffres après la virgule. */
export function arrondir(valeur: number, decimales = 2): number {
  const facteur = 10 ** decimales;
  return Math.round((valeur + Number.EPSILON) * facteur) / facteur;
}

// ---------------------------------------------------------------------------
// 1. Réévaluation (indexation) d'un fermage selon l'indice national
// ---------------------------------------------------------------------------

export interface ResultatRevalorisation {
  loyerInitial: number;
  anneeDepart: number;
  anneeArrivee: number;
  indiceDepart: number;
  indiceArrivee: number;
  /** Loyer réévalué non arrondi (utile pour les calculs en chaîne). */
  loyerExact: number;
  /** Loyer réévalué arrondi à 2 décimales (montant à retenir). */
  loyer: number;
  /** Variation totale entre les deux années, en pourcentage. */
  variationPct: number;
}

/**
 * Réévalue un fermage en appliquant le rapport entre l'indice de l'année
 * d'arrivée et celui de l'année de départ :
 *
 *   nouveau loyer = loyer initial × (indice arrivée / indice départ)
 *
 * @throws si l'une des années n'a pas d'indice connu, si le loyer est négatif,
 *         ou si l'indice de départ est nul.
 */
export function revaloriserFermage(
  loyerInitial: number,
  anneeDepart: number,
  anneeArrivee: number,
): ResultatRevalorisation {
  if (!Number.isFinite(loyerInitial) || loyerInitial < 0) {
    throw new Error("Le loyer initial doit être un montant positif.");
  }

  const indiceDepart = indicePourAnnee(anneeDepart);
  const indiceArrivee = indicePourAnnee(anneeArrivee);

  if (indiceDepart === undefined) {
    throw new Error(`Aucun indice connu pour l'année ${anneeDepart}.`);
  }
  if (indiceArrivee === undefined) {
    throw new Error(`Aucun indice connu pour l'année ${anneeArrivee}.`);
  }
  if (indiceDepart === 0) {
    throw new Error("L'indice de l'année de départ ne peut pas être nul.");
  }

  const loyerExact = (loyerInitial * indiceArrivee) / indiceDepart;
  const variationPct = (indiceArrivee / indiceDepart - 1) * 100;

  return {
    loyerInitial,
    anneeDepart,
    anneeArrivee,
    indiceDepart,
    indiceArrivee,
    loyerExact,
    loyer: arrondir(loyerExact, 2),
    variationPct: arrondir(variationPct, 2),
  };
}

// ---------------------------------------------------------------------------
// 2. Historique de réévaluation, année par année
// ---------------------------------------------------------------------------

export interface LigneHistorique {
  annee: number;
  indice: number;
  /** Variation de l'indice par rapport à l'année précédente, en %. */
  variationAnnuellePct: number | null;
  /** Loyer réévalué pour cette année (arrondi à 2 décimales). */
  loyer: number;
}

/**
 * Construit l'historique de réévaluation d'un fermage, année par année, depuis
 * l'année de départ jusqu'à l'année d'arrivée (incluses).
 *
 * Chaque loyer est calculé directement depuis le loyer de référence afin
 * d'éviter l'accumulation d'arrondis successifs.
 */
export function historiqueRevalorisation(
  loyerInitial: number,
  anneeDepart: number,
  anneeArrivee: number,
): LigneHistorique[] {
  if (anneeArrivee < anneeDepart) {
    throw new Error(
      "L'année d'arrivée doit être postérieure ou égale à l'année de départ.",
    );
  }

  const lignes: LigneHistorique[] = [];
  let loyerPrecedent: number | null = null;

  for (let annee = anneeDepart; annee <= anneeArrivee; annee++) {
    const indice = indicePourAnnee(annee);
    if (indice === undefined) {
      throw new Error(`Aucun indice connu pour l'année ${annee}.`);
    }

    const { loyer } = revaloriserFermage(loyerInitial, anneeDepart, annee);
    const variationAnnuellePct =
      loyerPrecedent === null || loyerPrecedent === 0
        ? null
        : arrondir((loyer / loyerPrecedent - 1) * 100, 2);

    lignes.push({ annee, indice, variationAnnuellePct, loyer });
    loyerPrecedent = loyer;
  }

  return lignes;
}

// ---------------------------------------------------------------------------
// 3. Contrôle des bornes préfectorales (minima / maxima par hectare)
// ---------------------------------------------------------------------------

export type Conformite = "inferieur" | "conforme" | "superieur";

export interface ResultatBornes {
  surfaceHa: number;
  minParHa: number;
  maxParHa: number;
  /** Borne basse de la fourchette pour la surface (€). */
  minTotal: number;
  /** Borne haute de la fourchette pour la surface (€). */
  maxTotal: number;
  /** Loyer proposé soumis au contrôle (€). */
  loyerPropose: number;
  /** Loyer proposé ramené à l'hectare (€/ha). */
  loyerProposeParHa: number;
  /** Position du loyer proposé par rapport à la fourchette. */
  conformite: Conformite;
}

/**
 * Vérifie qu'un loyer proposé respecte la fourchette fixée par l'arrêté
 * préfectoral, exprimée en euros par hectare (minimum et maximum), pour une
 * surface donnée.
 *
 * @throws si les valeurs sont invalides ou si le minimum dépasse le maximum.
 */
export function controleBornesPrefectorales(
  surfaceHa: number,
  minParHa: number,
  maxParHa: number,
  loyerPropose: number,
): ResultatBornes {
  if (!Number.isFinite(surfaceHa) || surfaceHa <= 0) {
    throw new Error("La surface doit être strictement positive.");
  }
  if (
    !Number.isFinite(minParHa) ||
    !Number.isFinite(maxParHa) ||
    minParHa < 0 ||
    maxParHa < 0
  ) {
    throw new Error("Les bornes par hectare doivent être positives.");
  }
  if (minParHa > maxParHa) {
    throw new Error(
      "Le minimum par hectare ne peut pas dépasser le maximum par hectare.",
    );
  }
  if (!Number.isFinite(loyerPropose) || loyerPropose < 0) {
    throw new Error("Le loyer proposé doit être un montant positif.");
  }

  const minTotal = arrondir(minParHa * surfaceHa, 2);
  const maxTotal = arrondir(maxParHa * surfaceHa, 2);
  const loyerProposeParHa = arrondir(loyerPropose / surfaceHa, 2);

  let conformite: Conformite;
  if (loyerPropose < minTotal) {
    conformite = "inferieur";
  } else if (loyerPropose > maxTotal) {
    conformite = "superieur";
  } else {
    conformite = "conforme";
  }

  return {
    surfaceHa,
    minParHa,
    maxParHa,
    minTotal,
    maxTotal,
    loyerPropose,
    loyerProposeParHa,
    conformite,
  };
}
