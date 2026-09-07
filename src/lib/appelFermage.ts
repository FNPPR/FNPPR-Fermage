/**
 * Composition d'un Appel de fermage (semestriel ou annuel) : combine la
 * réévaluation du loyer selon l'indice national des fermages (module
 * « Réévaluation ») et le total des impôts et taxes imputés au preneur
 * (module « Répartition des taxes foncières »), pour produire le décompte
 * final adressé au preneur — sur le modèle d'un courrier d'appel de fermage.
 */

import { arrondir, revaloriserFermage, type ResultatRevalorisation } from "./fermage";

/** Une ligne libre du bloc « Impôts & Taxes » (libellé + montant en euros). */
export interface LigneCharge {
  id: string;
  libelle: string;
  /** Montant à la charge du preneur pour cette ligne (€). */
  montant: number;
}

export interface SaisieAppelFermage {
  /** Loyer de référence (fermage de la période précédente), en euros. */
  loyerInitial: number;
  /** Année de l'indice de référence du loyer initial. */
  anneeDepart: number;
  /** Année de l'indice retenu pour la réévaluation. */
  anneeArrivee: number;
  /** Acompte déjà versé sur la période à déduire (0 si aucun). */
  acompte: number;
  /** Lignes d'impôts et taxes imputées au preneur. */
  charges: LigneCharge[];
}

export interface ResultatAppelFermage {
  revalorisation: ResultatRevalorisation;
  acompte: number;
  /** Fermage réévalué, diminué de l'acompte déjà versé. */
  totalFermage: number;
  charges: LigneCharge[];
  /** Somme des lignes d'impôts et taxes. */
  totalCharges: number;
  /** Montant total de l'échéance = fermage net + charges. */
  totalEcheance: number;
}

/**
 * Calcule le décompte d'un appel de fermage : réévaluation du loyer (voir
 * `revaloriserFermage`), déduction de l'acompte déjà versé, puis addition du
 * total des impôts et taxes imputés au preneur.
 *
 * @throws si le loyer, l'acompte ou l'une des années sont invalides, ou si
 *         une ligne de charge a un montant non numérique.
 */
export function calculerAppelFermage(
  saisie: SaisieAppelFermage,
): ResultatAppelFermage {
  const { loyerInitial, anneeDepart, anneeArrivee, acompte, charges } = saisie;

  if (!Number.isFinite(acompte) || acompte < 0) {
    throw new Error("L'acompte doit être un montant positif.");
  }
  for (const c of charges) {
    if (!Number.isFinite(c.montant)) {
      throw new Error("Toutes les lignes d'impôts et taxes doivent avoir un montant numérique.");
    }
  }

  const revalorisation = revaloriserFermage(loyerInitial, anneeDepart, anneeArrivee);
  const totalFermage = arrondir(revalorisation.loyer - acompte, 2);
  const totalCharges = arrondir(
    charges.reduce((s, c) => s + c.montant, 0),
    2,
  );
  const totalEcheance = arrondir(totalFermage + totalCharges, 2);

  return {
    revalorisation,
    acompte,
    totalFermage,
    charges,
    totalCharges,
    totalEcheance,
  };
}
