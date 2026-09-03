/**
 * Répartition de la taxe foncière (et taxes annexes) entre le preneur et le
 * bailleur d'un bail rural — d'après le tableau FNPPR « Taxes annexes au bail
 * rural », intégrant la réforme du dégrèvement de TFNB de 2025.
 *
 * Principe (art. L415-3 du Code rural et de la pêche maritime) :
 *  - La taxe foncière est due par le BAILLEUR (propriétaire), qui la paie à
 *    l'administration.
 *  - Le bail peut prévoir que le PRENEUR (exploitant) en rembourse une part.
 *  - Depuis 2006, les terres agricoles bénéficient d'un dégrèvement permanent
 *    sur la part communale et intercommunale de la taxe foncière sur les
 *    propriétés non bâties (TFNB), au profit du preneur. La loi n°2025-127 du
 *    14/02/2025 porte ce dégrèvement de 20 % à 30 %.
 *
 * ---------------------------------------------------------------------------
 * 1. L'ASSIETTE : deux façons de retrouver le montant de taxe qui concerne la
 *    surface effectivement donnée à bail.
 * ---------------------------------------------------------------------------
 *
 * a) « montantGlobal » — méthode par défaut, la plus simple : on part du
 *    montant total appelé sur l'avis d'imposition (pour la totalité de la
 *    parcelle/propriété) et on applique le pourcentage de surface louée.
 *
 *      montantTotal = montantAppele × partExploitant
 *
 *    ⚠ Cette méthode n'est fiable que si le bailleur ne loue qu'à UN seul
 *    exploitant, ou si tous les exploitants partagent l'avis exactement au
 *    prorata de leur surface. Dès qu'il y a PLUSIEURS exploitants sur un même
 *    avis d'imposition, la répartition au pourcentage de surface peut
 *    s'écarter sensiblement des revenus cadastraux réels de chacun (parcelles
 *    de valeurs très différentes). Dans ce cas, préférer le mode
 *    « revenuCadastral » ci-dessous.
 *
 * b) « revenuCadastral » — méthode recommandée en présence de plusieurs
 *    exploitants : on part du revenu cadastral propre à l'exploitant
 *    concerné (visible sur son propre relevé de propriété / extrait de
 *    matrice cadastrale, et à réactualiser chaque année via
 *    `revaloriserRevenuCadastral`), et on lui applique directement le taux
 *    voté (bas de la colonne correspondante sur l'avis : Commune,
 *    Intercommunalité, Chambre d'agriculture, Taxe GEMAPI…).
 *
 *      montantTotal = revenuCadastral × (1 − tauxDégrèvement si applicable)
 *                      × tauxImposition
 *
 *    Le dégrèvement de 30 % s'applique à l'assiette pour la TFNB (parts
 *    communale et intercommunale) et pour la taxe GEMAPI, mais PAS pour les
 *    frais de chambre d'agriculture (assiette non dégrevée).
 *
 * c) « hectare » — pour les taxes assises directement sur la surface (ex.
 *    taxe de remembrement, taxes syndicales / de marais) : taux à l'hectare
 *    fixé par le protocole départemental × surface effectivement louée.
 *
 *      montantTotal = tauxHectare × surfaceLouee
 *
 * ---------------------------------------------------------------------------
 * 2. LA RÉPARTITION : une fois l'assiette (montantTotal) connue, deux
 *    méthodes de calcul du montant imputé au preneur.
 * ---------------------------------------------------------------------------
 *
 *  - « tfnb »   : parts communale et intercommunale de la TFNB (réforme 2025).
 *       imputé = Montant total × (Taux du bail − Taux de dégrèvement)
 *                × Coefficient correcteur
 *                × (1 + frais de rôle SI Taux du bail > Taux de dégrèvement)
 *       Résultat négatif = réduction du fermage en faveur du preneur ;
 *       positif = remboursement du preneur au bailleur.
 *  - « simple » : autres taxes (chambre d'agriculture, GEMAPI, remembrement,
 *       taxes syndicales / de marais…), non concernées par la formule de
 *       dégrèvement ci-dessus (même si leur assiette peut, elle, être
 *       dégrevée — voir mode « revenuCadastral »).
 *       imputé = Montant total × Taux du bail × (1 + frais de rôle)
 *
 * Pour la chambre d'agriculture, le taux de 50 % ne résulte pas d'une clause
 * du bail mais d'une disposition d'ordre public du Code général des impôts
 * (CGI, art. 1509) : il ne peut pas être négocié entre les parties.
 */

import { arrondir } from "./fermage";

/** Paramètres réglementaires du dégrèvement de TFNB. */
export interface ParametresDegrevement {
  /** Taux de dégrèvement au profit du preneur (fraction, ex. 0,30 = 30 %). */
  tauxDegrevement: number;
  /** Coefficient correcteur reconstituant la taxe théorique (ex. 1,43). */
  coefficientCorrecteur: number;
}

/** Valeurs en vigueur depuis la loi n°2025-127 du 14/02/2025. */
export const PARAMS_DEGREVEMENT_2025: ParametresDegrevement = {
  tauxDegrevement: 0.3,
  coefficientCorrecteur: 1.43,
};

/** Valeurs antérieures à 2025 (pour mémoire). */
export const PARAMS_DEGREVEMENT_AVANT_2025: ParametresDegrevement = {
  tauxDegrevement: 0.2,
  coefficientCorrecteur: 1.25,
};

export type MethodeTaxe = "tfnb" | "simple";

// ---------------------------------------------------------------------------
// Assiette : montant de taxe concernant la surface louée
// ---------------------------------------------------------------------------

export type ModeAssiette = "montantGlobal" | "revenuCadastral" | "hectare";

export interface AssietteMontantGlobal {
  mode: "montantGlobal";
  /** Montant de la taxe appelé sur l'avis d'imposition, pour la totalité de
   * la propriété (€). */
  montantAppele: number;
  /** Part de la parcelle effectivement louée/exploitée (fraction 0..1). */
  partExploitant: number;
}

export interface AssietteRevenuCadastral {
  mode: "revenuCadastral";
  /** Revenu cadastral propre à l'exploitant concerné, non dégrevé, actualisé
   * (€). Voir `revaloriserRevenuCadastral`. */
  revenuCadastral: number;
  /** Taux voté de l'imposition concernée (fraction, ex. 0,18 = 18 %). */
  tauxImposition: number;
  /** L'assiette de cette taxe bénéficie-t-elle du dégrèvement de 30 % (TFNB,
   * GEMAPI) ? false pour la chambre d'agriculture (assiette non dégrevée). */
  assietteDegrevee: boolean;
}

export interface AssietteHectare {
  mode: "hectare";
  /** Taux à l'hectare fixé par le protocole départemental (€/ha). */
  tauxHectare: number;
  /** Surface effectivement louée (ha). */
  surfaceLouee: number;
}

export type Assiette =
  | AssietteMontantGlobal
  | AssietteRevenuCadastral
  | AssietteHectare;

function verifierFini(valeurs: number[], message: string) {
  for (const v of valeurs) {
    if (!Number.isFinite(v)) {
      throw new Error(message);
    }
  }
}

/**
 * Calcule l'assiette (montant de taxe concernant la surface/l'exploitant
 * louée) à partir de l'un des trois modes de saisie disponibles.
 * @throws si les valeurs sont invalides.
 */
export function calculerAssiette(
  assiette: Assiette,
  params: ParametresDegrevement = PARAMS_DEGREVEMENT_2025,
): number {
  switch (assiette.mode) {
    case "montantGlobal": {
      const { montantAppele, partExploitant } = assiette;
      verifierFini(
        [montantAppele, partExploitant],
        "Toutes les valeurs doivent être numériques.",
      );
      if (montantAppele < 0) {
        throw new Error("Le montant appelé doit être positif.");
      }
      return arrondir(montantAppele * partExploitant, 2);
    }
    case "revenuCadastral": {
      const { revenuCadastral, tauxImposition, assietteDegrevee } = assiette;
      verifierFini(
        [revenuCadastral, tauxImposition],
        "Toutes les valeurs doivent être numériques.",
      );
      if (revenuCadastral < 0) {
        throw new Error("Le revenu cadastral doit être positif.");
      }
      const base = assietteDegrevee
        ? revenuCadastral * (1 - params.tauxDegrevement)
        : revenuCadastral;
      return arrondir(base * tauxImposition, 2);
    }
    case "hectare": {
      const { tauxHectare, surfaceLouee } = assiette;
      verifierFini(
        [tauxHectare, surfaceLouee],
        "Toutes les valeurs doivent être numériques.",
      );
      if (tauxHectare < 0 || surfaceLouee < 0) {
        throw new Error("Le taux à l'hectare et la surface doivent être positifs.");
      }
      return arrondir(tauxHectare * surfaceLouee, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// Répartition preneur / bailleur
// ---------------------------------------------------------------------------

export interface SaisieRepartition {
  /** Taux contractuel de remboursement prévu au bail (fraction 0..1). */
  tauxBail: number;
  /** Frais de rôle (fraction, ex. 0,03 = 3 %). */
  fraisDeRole: number;
}

export interface ResultatTaxe {
  /** Assiette pour la surface/l'exploitant concerné. */
  montantTotal: number;
  /** Montant imputé au preneur (négatif possible en méthode « tfnb »). */
  imputePreneur: number;
  /** Montant restant à la charge du bailleur = total − imputé au preneur. */
  resteBailleur: number;
}

/**
 * Calcule la répartition d'une taxe entre preneur et bailleur.
 * @throws si les valeurs sont invalides.
 */
export function calculerLigneTaxe(
  assiette: Assiette,
  repartition: SaisieRepartition,
  methode: MethodeTaxe,
  params: ParametresDegrevement = PARAMS_DEGREVEMENT_2025,
): ResultatTaxe {
  const { tauxBail, fraisDeRole } = repartition;
  verifierFini(
    [tauxBail, fraisDeRole],
    "Toutes les valeurs doivent être numériques.",
  );

  const montantTotal = calculerAssiette(assiette, params);

  let imputePreneur: number;
  if (methode === "tfnb") {
    const majoration = tauxBail > params.tauxDegrevement ? fraisDeRole : 0;
    imputePreneur = arrondir(
      montantTotal *
        (tauxBail - params.tauxDegrevement) *
        params.coefficientCorrecteur *
        (1 + majoration),
      2,
    );
  } else {
    imputePreneur = arrondir(montantTotal * tauxBail * (1 + fraisDeRole), 2);
  }

  return {
    montantTotal,
    imputePreneur,
    resteBailleur: arrondir(montantTotal - imputePreneur, 2),
  };
}

/** Somme des montants imputés au preneur sur plusieurs lignes de taxe. */
export function totalImputePreneur(resultats: ResultatTaxe[]): number {
  return arrondir(
    resultats.reduce((s, r) => s + r.imputePreneur, 0),
    2,
  );
}

/** Somme des montants totaux (toutes taxes, surface louée). */
export function totalMontant(resultats: ResultatTaxe[]): number {
  return arrondir(
    resultats.reduce((s, r) => s + r.montantTotal, 0),
    2,
  );
}

// ---------------------------------------------------------------------------
// Revalorisation annuelle d'un revenu cadastral
// ---------------------------------------------------------------------------

export interface ResultatRevalorisationCadastrale {
  revenuCadastralBase: number;
  tauxEvolutionAnnuel: number;
  nombreAnnees: number;
  /** Revenu cadastral actualisé (non arrondi). */
  revenuCadastralExact: number;
  /** Revenu cadastral actualisé, arrondi à 2 décimales. */
  revenuCadastral: number;
}

/**
 * Actualise un revenu cadastral connu pour une année de référence en lui
 * appliquant, chaque année, le taux d'évolution forfaitaire des bases
 * locatives voté en loi de finances (valeur variable d'une année sur
 * l'autre : à renseigner par l'utilisateur, l'administration ne publiant pas
 * de série longue exploitable automatiquement).
 *
 *   revenu actualisé = revenu de référence × (1 + taux)^(nombre d'années)
 *
 * @throws si les valeurs sont invalides.
 */
export function revaloriserRevenuCadastral(
  revenuCadastralBase: number,
  tauxEvolutionAnnuel: number,
  nombreAnnees: number,
): ResultatRevalorisationCadastrale {
  verifierFini(
    [revenuCadastralBase, tauxEvolutionAnnuel, nombreAnnees],
    "Toutes les valeurs doivent être numériques.",
  );
  if (revenuCadastralBase < 0) {
    throw new Error("Le revenu cadastral de référence doit être positif.");
  }
  if (nombreAnnees < 0) {
    throw new Error("Le nombre d'années doit être positif ou nul.");
  }

  const revenuCadastralExact =
    revenuCadastralBase * Math.pow(1 + tauxEvolutionAnnuel, nombreAnnees);

  return {
    revenuCadastralBase,
    tauxEvolutionAnnuel,
    nombreAnnees,
    revenuCadastralExact,
    revenuCadastral: arrondir(revenuCadastralExact, 2),
  };
}
