/**
 * Répartition de la taxe foncière (et taxes annexes) entre le preneur et le
 * bailleur d'un bail rural — d'après le tableau FNPPR « Taxes annexes au bail
 * rural » et la matrice FNPPR « calcul par revenu cadastral » (méthode
 * rigoureuse), intégrant la réforme du dégrèvement de TFNB de 2025.
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
 * 1. L'ASSIETTE : le montant de taxe qui concerne la surface donnée à bail.
 * ---------------------------------------------------------------------------
 *
 * a) « revenuCadastral » — méthode de référence (« méthode rigoureuse » de la
 *    matrice FNPPR), indispensable dès que plusieurs exploitants se partagent
 *    un même avis d'imposition : on part du revenu cadastral propre à
 *    l'exploitant (relevé de propriété, NON minoré de 30 %, actualisé chaque
 *    année via `revaloriserRevenuCadastral`) et du taux voté (bas de la
 *    colonne correspondante sur l'avis : Commune, Intercommunalité, Chambre
 *    d'agriculture, Taxe GEMAPI…).
 *
 *      montantTotal = revenuCadastral × (1 − tauxDégrèvement si applicable)
 *                      × tauxVoté
 *
 *    Le dégrèvement de 30 % s'applique à l'assiette pour la TFNB (parts
 *    communale et intercommunale) et pour la taxe GEMAPI, mais PAS pour les
 *    frais de chambre d'agriculture (assiette non dégrevée).
 *
 * b) « montantGlobal » — approximation, fiable seulement pour un exploitant
 *    unique : montant appelé sur l'avis × pourcentage de surface louée. Dès
 *    que plusieurs exploitants partagent l'avis, la répartition au prorata de
 *    la surface peut s'écarter sensiblement de leurs revenus cadastraux
 *    réels (parcelles de valeurs différentes).
 *
 *      montantTotal = montantAppele × partExploitant
 *
 * c) « hectare » — pour les taxes assises directement sur la surface (taxe
 *    de remembrement, taxes syndicales / de marais) : taux à l'hectare × surface.
 *
 *      montantTotal = tauxHectare × surfaceLouee
 *
 * ---------------------------------------------------------------------------
 * 2. LA RÉPARTITION entre preneur et bailleur.
 * ---------------------------------------------------------------------------
 *
 *  - « tfnb » : parts communale et intercommunale de la TFNB UNIQUEMENT.
 *       imputé = Taxe théorique × (Taux du bail − Taux de dégrèvement)
 *                × (1 + frais de rôle SI Taux du bail > Taux de dégrèvement)
 *     où la taxe théorique (avant dégrèvement) est :
 *       - en mode revenu cadastral : revenu cadastral × taux voté, calculée
 *         directement (exactement comme la matrice FNPPR) ;
 *       - en mode montant global : montant appelé × part ÷ (1 − dégrèvement).
 *         Le facteur 1 ÷ (1 − 30 %) ≈ 1,4286 est le « coefficient correcteur »,
 *         arrondi à 1,43 dans les tableaux papier ; il est ici calculé
 *         exactement à partir du taux de dégrèvement, ce qui supprime l'écart
 *         de 0,1 % de la valeur arrondie et toute incohérence entre les deux
 *         paramètres.
 *     Résultat négatif = réduction du fermage en faveur du preneur ;
 *     positif = remboursement du preneur au bailleur.
 *
 *  - « simple » : toutes les autres taxes (chambre d'agriculture, taxe
 *     GEMAPI, remembrement, taxes syndicales / de marais).
 *       imputé = Montant total × Taux du bail × (1 + frais de rôle)
 *
 *     ⚠ La taxe GEMAPI suit la formule « simple », PAS la formule « tfnb ».
 *     L'administration la calcule sur une base déjà réduite à 70 % (même
 *     dégrèvement que la TFNB) : son assiette est donc dégrevée
 *     (`assietteDegrevee: true`). Mais n'ayant pas le caractère d'une taxe
 *     foncière, elle ne bénéficie pas du mécanisme de dégrèvement en faveur du
 *     preneur lors de la RÉPARTITION (ni soustraction du taux de dégrèvement,
 *     ni coefficient correcteur).
 *
 * Chambre d'agriculture : la moitié de la taxe est remboursée par le preneur
 * en vertu de l'art. 1604 du Code général des impôts et de l'art. L514-1 du
 * Code rural et de la pêche maritime — disposition d'ordre public, qui ne
 * résulte pas du bail et ne peut pas être modifiée par les parties.
 *
 * ---------------------------------------------------------------------------
 * 3. LES ARRONDIS
 * ---------------------------------------------------------------------------
 *
 * Tous les calculs sont menés SANS arrondi intermédiaire ; seuls les montants
 * retenus (montant total, imputé au preneur) sont arrondis au centime, selon
 * l'arrondi commercial d'Excel (voir `arrondir`). Les totaux sont la somme
 * des montants arrondis des lignes, pour que le décompte adressé au preneur
 * soit toujours égal à la somme des lignes qu'il contient.
 */

import { arrondir } from "./fermage";
import {
  formaterEurosPrecis,
  formaterNombrePrecis,
  formaterTaux,
} from "./format";

/** Paramètres réglementaires du dégrèvement de TFNB. */
export interface ParametresDegrevement {
  /** Taux de dégrèvement au profit du preneur (fraction, ex. 0,30 = 30 %). */
  tauxDegrevement: number;
}

/** Valeur en vigueur depuis la loi n°2025-127 du 14/02/2025. */
export const PARAMS_DEGREVEMENT_2025: ParametresDegrevement = {
  tauxDegrevement: 0.3,
};

/** Valeur antérieure à 2025 (pour mémoire). */
export const PARAMS_DEGREVEMENT_AVANT_2025: ParametresDegrevement = {
  tauxDegrevement: 0.2,
};

function verifierTauxDegrevement(tauxDegrevement: number) {
  if (
    !Number.isFinite(tauxDegrevement) ||
    tauxDegrevement < 0 ||
    tauxDegrevement >= 1
  ) {
    throw new Error(
      "Le taux de dégrèvement doit être compris entre 0 et 100 % (exclu).",
    );
  }
}

/**
 * Coefficient correcteur reconstituant la taxe théorique (avant dégrèvement)
 * à partir du montant appelé : 1 ÷ (1 − taux de dégrèvement). Vaut 1,25 pour
 * un dégrèvement de 20 % et 1,428571… (≈ 1,43) pour 30 %.
 */
export function coefficientCorrecteur(tauxDegrevement: number): number {
  verifierTauxDegrevement(tauxDegrevement);
  return 1 / (1 - tauxDegrevement);
}

export type MethodeTaxe = "tfnb" | "simple";

// ---------------------------------------------------------------------------
// Assiette : montant de taxe concernant la surface louée
// ---------------------------------------------------------------------------

export type ModeAssiette = "revenuCadastral" | "montantGlobal" | "hectare";

export interface AssietteMontantGlobal {
  mode: "montantGlobal";
  /** Montant de la taxe appelé sur l'avis d'imposition, pour la totalité de
   * la propriété (€). */
  montantAppele: number;
  /** Part de la surface imposée effectivement donnée à bail (fraction 0..1). */
  partExploitant: number;
}

export interface AssietteRevenuCadastral {
  mode: "revenuCadastral";
  /** Revenu cadastral propre à l'exploitant concerné, non dégrevé, actualisé
   * (€). Voir `revaloriserRevenuCadastral`. */
  revenuCadastral: number;
  /** Taux voté de l'imposition concernée (fraction, ex. 0,4389 = 43,89 %). */
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

function verifierFini(valeurs: number[]) {
  for (const v of valeurs) {
    if (!Number.isFinite(v)) {
      throw new Error(
        "Une valeur saisie n'est pas un nombre (chiffres uniquement, virgule ou point décimal).",
      );
    }
  }
}

/** Valeurs exactes (non arrondies) de l'assiette d'une taxe. */
interface ValeursAssiette {
  /** Montant de la taxe pour la surface louée (ce que paie le bailleur). */
  montantTotal: number;
  /** Taxe théorique avant dégrèvement (utilisée par la méthode « tfnb »). */
  taxeTheorique: number;
}

function evaluerAssiette(
  assiette: Assiette,
  params: ParametresDegrevement,
): ValeursAssiette {
  verifierTauxDegrevement(params.tauxDegrevement);
  const resteApresDegrevement = 1 - params.tauxDegrevement;

  switch (assiette.mode) {
    case "montantGlobal": {
      const { montantAppele, partExploitant } = assiette;
      verifierFini([montantAppele, partExploitant]);
      if (montantAppele < 0) {
        throw new Error("Le montant appelé doit être positif.");
      }
      if (partExploitant < 0 || partExploitant > 1) {
        throw new Error("La part exploitée doit être comprise entre 0 et 100 %.");
      }
      const montant = montantAppele * partExploitant;
      return {
        montantTotal: montant,
        taxeTheorique: montant / resteApresDegrevement,
      };
    }
    case "revenuCadastral": {
      const { revenuCadastral, tauxImposition, assietteDegrevee } = assiette;
      verifierFini([revenuCadastral, tauxImposition]);
      if (revenuCadastral < 0) {
        throw new Error("Le revenu cadastral doit être positif.");
      }
      if (tauxImposition < 0) {
        throw new Error("Le taux voté doit être positif.");
      }
      const taxeTheorique = revenuCadastral * tauxImposition;
      return {
        montantTotal: assietteDegrevee
          ? revenuCadastral * resteApresDegrevement * tauxImposition
          : taxeTheorique,
        taxeTheorique,
      };
    }
    case "hectare": {
      const { tauxHectare, surfaceLouee } = assiette;
      verifierFini([tauxHectare, surfaceLouee]);
      if (tauxHectare < 0 || surfaceLouee < 0) {
        throw new Error("Le taux à l'hectare et la surface doivent être positifs.");
      }
      const montant = tauxHectare * surfaceLouee;
      return {
        montantTotal: montant,
        taxeTheorique: montant / resteApresDegrevement,
      };
    }
  }
}

/**
 * Calcule l'assiette (montant de taxe concernant la surface louée), arrondie
 * au centime, à partir de l'un des trois modes de saisie disponibles.
 * @throws si les valeurs sont invalides.
 */
export function calculerAssiette(
  assiette: Assiette,
  params: ParametresDegrevement = PARAMS_DEGREVEMENT_2025,
): number {
  return arrondir(evaluerAssiette(assiette, params).montantTotal, 2);
}

// ---------------------------------------------------------------------------
// Répartition preneur / bailleur
// ---------------------------------------------------------------------------

export interface SaisieRepartition {
  /** Taux de remboursement prévu au bail, ou fixé par la loi (fraction 0..1). */
  tauxBail: number;
  /** Frais de rôle (fraction, ex. 0,03 = 3 %). */
  fraisDeRole: number;
}

export interface ResultatTaxe {
  /** Montant de la taxe pour la surface louée, arrondi au centime. */
  montantTotal: number;
  /** Montant imputé au preneur, arrondi au centime (négatif possible en
   * méthode « tfnb » : réduction de fermage). */
  imputePreneur: number;
  /** Montant restant à la charge du bailleur = total − imputé au preneur. */
  resteBailleur: number;
}

function verifierRepartition({ tauxBail, fraisDeRole }: SaisieRepartition) {
  verifierFini([tauxBail, fraisDeRole]);
  if (tauxBail < 0 || tauxBail > 1) {
    throw new Error("Le taux du bail doit être compris entre 0 et 100 %.");
  }
  if (fraisDeRole < 0) {
    throw new Error("Les frais de rôle doivent être positifs.");
  }
}

/** Les frais de rôle s'appliquent-ils ? (TFNB : seulement au-delà du dégrèvement.) */
function fraisDeRoleAppliques(
  methode: MethodeTaxe,
  { tauxBail, fraisDeRole }: SaisieRepartition,
  params: ParametresDegrevement,
): boolean {
  if (fraisDeRole === 0) return false;
  return methode === "tfnb" ? tauxBail > params.tauxDegrevement : true;
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
  verifierRepartition(repartition);
  const { montantTotal, taxeTheorique } = evaluerAssiette(assiette, params);
  const majoration = fraisDeRoleAppliques(methode, repartition, params)
    ? 1 + repartition.fraisDeRole
    : 1;

  const impute =
    methode === "tfnb"
      ? taxeTheorique * (repartition.tauxBail - params.tauxDegrevement) * majoration
      : montantTotal * repartition.tauxBail * majoration;

  const montantTotalArrondi = arrondir(montantTotal, 2);
  const imputePreneur = arrondir(impute, 2);
  return {
    montantTotal: montantTotalArrondi,
    imputePreneur,
    resteBailleur: arrondir(montantTotalArrondi - imputePreneur, 2),
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
// Détail chiffré du calcul (vérification et démonstration à l'adhérent)
// ---------------------------------------------------------------------------

export interface EtapeCalcul {
  /** Ce que calcule l'étape (ex. « Imputé au preneur »). */
  libelle: string;
  /** La formule en toutes lettres. */
  formule: string;
  /** La même formule avec les valeurs saisies, sans arrondi. */
  calcul: string;
  /** Le résultat, arrondi au centime. */
  resultat: number;
}

export interface DetailLigneTaxe {
  etapes: EtapeCalcul[];
  /** Explications complémentaires (signe du résultat, frais de rôle…). */
  remarques: string[];
}

export interface OptionsDetail {
  /** Nom du taux de répartition : « Taux du bail » par défaut, « Part
   * légale » pour la chambre d'agriculture. */
  libelleTauxBail?: string;
}

/**
 * Décrit, étape par étape, le calcul d'une ligne de taxe avec les valeurs
 * réellement saisies. Chaque calcul part directement des valeurs saisies
 * (jamais d'un résultat intermédiaire arrondi) : refait à la calculatrice
 * puis arrondi au centime, il redonne exactement le montant affiché.
 * @throws si les valeurs sont invalides.
 */
export function detaillerLigneTaxe(
  assiette: Assiette,
  repartition: SaisieRepartition,
  methode: MethodeTaxe,
  params: ParametresDegrevement = PARAMS_DEGREVEMENT_2025,
  options: OptionsDetail = {},
): DetailLigneTaxe {
  const res = calculerLigneTaxe(assiette, repartition, methode, params);
  const libelleTaux = options.libelleTauxBail ?? "Taux du bail";
  const { tauxBail, fraisDeRole } = repartition;
  const d = params.tauxDegrevement;
  const unMoinsD = `(1 − ${formaterTaux(d)})`;

  // Montant total (assiette pour la surface louée)
  let baseFormule: string;
  let baseCalcul: string;
  switch (assiette.mode) {
    case "montantGlobal":
      baseFormule = "Montant appelé × Part exploitée";
      baseCalcul = `${formaterEurosPrecis(assiette.montantAppele)} × ${formaterTaux(assiette.partExploitant)}`;
      break;
    case "revenuCadastral":
      baseFormule = assiette.assietteDegrevee
        ? "Revenu cadastral × (1 − Dégrèvement) × Taux voté"
        : "Revenu cadastral × Taux voté";
      baseCalcul = assiette.assietteDegrevee
        ? `${formaterEurosPrecis(assiette.revenuCadastral)} × ${unMoinsD} × ${formaterTaux(assiette.tauxImposition)}`
        : `${formaterEurosPrecis(assiette.revenuCadastral)} × ${formaterTaux(assiette.tauxImposition)}`;
      break;
    case "hectare":
      baseFormule = "Taux à l'hectare × Surface louée";
      baseCalcul = `${formaterEurosPrecis(assiette.tauxHectare)}/ha × ${formaterNombrePrecis(assiette.surfaceLouee)} ha`;
      break;
  }

  const etapes: EtapeCalcul[] = [
    {
      libelle: "Montant total (surface louée)",
      formule: baseFormule,
      calcul: baseCalcul,
      resultat: res.montantTotal,
    },
  ];
  const remarques: string[] = [];
  const avecRole = fraisDeRoleAppliques(methode, repartition, params);
  const roleFormule = avecRole ? " × (1 + Frais de rôle)" : "";
  const roleCalcul = avecRole ? ` × (1 + ${formaterTaux(fraisDeRole)})` : "";

  if (methode === "tfnb") {
    let theoFormule: string;
    let theoCalcul: string;
    if (assiette.mode === "revenuCadastral") {
      theoFormule = "Revenu cadastral × Taux voté";
      theoCalcul = `${formaterEurosPrecis(assiette.revenuCadastral)} × ${formaterTaux(assiette.tauxImposition)}`;
    } else {
      theoFormule = `${baseFormule} ÷ (1 − Dégrèvement)`;
      theoCalcul = `${baseCalcul} ÷ ${unMoinsD}`;
      remarques.push(
        `La division par ${unMoinsD} (coefficient correcteur ≈ ${formaterNombrePrecis(
          Number(coefficientCorrecteur(d).toFixed(4)),
        )}) reconstitue la taxe avant dégrèvement à partir du montant appelé.`,
      );
    }
    etapes.push({
      libelle: "Imputé au preneur",
      formule: `${theoFormule} × (${libelleTaux} − Dégrèvement)${roleFormule}`,
      calcul: `${theoCalcul} × (${formaterTaux(tauxBail)} − ${formaterTaux(d)})${roleCalcul}`,
      resultat: res.imputePreneur,
    });
    if (tauxBail < d) {
      remarques.push(
        "Taux du bail inférieur au dégrèvement : le montant est négatif et vient en déduction du fermage, en faveur du preneur.",
      );
    } else if (tauxBail === d) {
      remarques.push(
        "Taux du bail égal au dégrèvement : aucun versement réciproque.",
      );
    }
    if (!avecRole && fraisDeRole > 0) {
      remarques.push(
        "Frais de rôle non appliqués : ils ne s'ajoutent que lorsque le taux du bail dépasse le dégrèvement.",
      );
    }
  } else {
    etapes.push({
      libelle: "Imputé au preneur",
      formule: `${baseFormule} × ${libelleTaux}${roleFormule}`,
      calcul: `${baseCalcul} × ${formaterTaux(tauxBail)}${roleCalcul}`,
      resultat: res.imputePreneur,
    });
    if (tauxBail === 0) {
      remarques.push(`${libelleTaux} à 0 % : rien n'est imputé au preneur.`);
    }
  }

  return { etapes, remarques };
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
 * l'autre : à renseigner par l'utilisateur).
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
  verifierFini([revenuCadastralBase, tauxEvolutionAnnuel, nombreAnnees]);
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
