/**
 * Calcul complet d'un dossier de propriétaire : pour chaque bail (un
 * exploitant dans une commune), fermage réévalué, revenu cadastral actualisé,
 * taxes imputées au preneur, déductions et reste dû ; puis totaux par
 * exploitant, par commune et pour la propriété.
 *
 * Règles (identiques à la matrice FNPPR « calcul par revenu cadastral »,
 * méthode rigoureuse, et à l'onglet taxes du calculateur) :
 *  - fermage = fermage de l'année précédente × indice de l'année ÷ indice de
 *    l'année précédente ;
 *  - revenu cadastral = revenu cadastral de l'année précédente (relevé de
 *    propriété) × (1 + revalorisation des bases), sans arrondi ;
 *  - TFNB, parts communale et intercommunale : revenu cadastral × taux voté ×
 *    (taux du bail − dégrèvement), majoré des frais de rôle seulement si le
 *    résultat est positif ;
 *  - chambre d'agriculture : revenu cadastral × taux voté × 50 % × (1 + frais
 *    de rôle), part légale non modifiable ;
 *  - GEMAPI : revenu cadastral × (1 − dégrèvement) × taux voté × taux du bail
 *    GEMAPI × (1 + frais de rôle des taxes foncières) ;
 *  - remembrement, taxes syndicales : montant à l'hectare × surface × part du
 *    preneur ;
 *  - reste dû = fermage + taxes − (acompte versé + dégrèvement + indemnité
 *    sécheresse + autre déduction).
 *
 * Arrondis : chaque montant retenu (fermage, chaque taxe) est arrondi au
 * centime ; les totaux sont la somme des montants arrondis, pour que chaque
 * appel de fermage soit toujours égal à la somme de ses lignes.
 */

import {
  type Bail,
  type Commune,
  type Dossier,
  type Exploitant,
  nomCommune,
  nomExploitant,
} from "./dossier";
import { arrondir, revaloriserFermage } from "./fermage";
import { parseNombre } from "./format";
import {
  calculerLigneTaxe,
  detaillerLigneTaxe,
  type Assiette,
  type DetailLigneTaxe,
  type MethodeTaxe,
  type ParametresDegrevement,
} from "./taxeFonciere";
import { indicePourAnnee } from "../data/indices";

export type IdTaxe =
  | "communale"
  | "intercommunale"
  | "chambre"
  | "gemapi"
  | "remembrement"
  | "syndicales"
  | "autre";

export const ORDRE_TAXES: IdTaxe[] = [
  "communale",
  "intercommunale",
  "chambre",
  "gemapi",
  "remembrement",
  "syndicales",
  "autre",
];

export const LIBELLES_TAXES: Record<IdTaxe, string> = {
  communale: "Taxe foncière – part communale",
  intercommunale: "Taxe foncière – part intercommunale",
  chambre: "Chambre d'agriculture",
  gemapi: "Taxe GEMAPI",
  remembrement: "Taxe de remembrement",
  syndicales: "Taxes syndicales / de marais",
  autre: "Autre taxe",
};

export type IdDeduction = "acompte" | "degrevement" | "secheresse" | "autre";

export const ORDRE_DEDUCTIONS: IdDeduction[] = [
  "acompte",
  "degrevement",
  "secheresse",
  "autre",
];

export const LIBELLES_DEDUCTIONS: Record<IdDeduction, string> = {
  acompte: "Acompte versé",
  degrevement: "Dégrèvement",
  secheresse: "Indemnité sécheresse",
  autre: "Autre déduction",
};

export interface LigneTaxe {
  id: IdTaxe;
  libelle: string;
  /** Montant de la taxe pour ces terres, payé par le bailleur (€, arrondi) ;
   * null pour une « autre taxe » saisie directement. */
  montantTotal: number | null;
  /** Part imputée au preneur (€, arrondie) ; négative = réduction de fermage. */
  impute: number;
  /** Formule et calcul chiffré ; null pour une « autre taxe ». */
  detail: DetailLigneTaxe | null;
}

export interface ResultatBail {
  bail: Bail;
  exploitant: Exploitant;
  rangExploitant: number;
  commune: Commune;
  rangCommune: number;
  surface: number;
  fermagePrecedent: number;
  /** Fermage de l'année, arrondi au centime. */
  fermage: number;
  revenuCadastralPrecedent: number;
  /** Revenu cadastral actualisé, non arrondi (comme la matrice). */
  revenuCadastral: number;
  /** Les sept lignes de taxes, dans l'ordre `ORDRE_TAXES` (montants nuls compris). */
  taxes: LigneTaxe[];
  totalTaxes: number;
  deductions: Record<IdDeduction, number>;
  totalDeductions: number;
  /** Fermage + taxes − déductions. */
  resteDu: number;
  nombreAcomptes: number;
  /** Montant de chaque acompte de l'année suivante : fermage ÷ (nombre + 1). */
  montantAcompte: number;
  fermageParHa: number | null;
  fermageEtTaxesParHa: number | null;
}

export interface Totaux {
  surface: number;
  fermagePrecedent: number;
  fermage: number;
  taxes: number;
  deductions: number;
  acomptes: number;
  degrevements: number;
  secheresse: number;
  autresDeductions: number;
  resteDu: number;
  /** Fermage moyen à l'hectare, sans puis avec les taxes ; null sans surface. */
  fermageParHa: number | null;
  fermageEtTaxesParHa: number | null;
}

export interface GroupeExploitant {
  exploitant: Exploitant;
  rang: number;
  baux: ResultatBail[];
  totaux: Totaux;
}

export interface GroupeCommune {
  commune: Commune;
  rang: number;
  baux: ResultatBail[];
  totaux: Totaux;
}

export interface Probleme {
  gravite: "erreur" | "avertissement";
  /** Où se trouve le problème, en clair : « Commune LE LOROUX », « DURAND Jérôme – LE LOROUX ». */
  ou: string;
  message: string;
  communeId?: string;
  exploitantId?: string;
  bailId?: string;
}

export interface ResultatDossier {
  annee: number;
  anneePrecedente: number;
  indicePrecedent: number | null;
  indice: number | null;
  /** Rapport des indices (année ÷ année précédente), non arrondi. */
  coefficientFermage: number | null;
  /** Dégrèvement de la TFNB (fraction) et revalorisation des revenus cadastraux (fraction). */
  tauxDegrevement: number;
  revalorisation: number;
  /** Baux calculés sans erreur, par exploitant puis par commune. */
  baux: ResultatBail[];
  parExploitant: GroupeExploitant[];
  parCommune: GroupeCommune[];
  totaux: Totaux;
  problemes: Probleme[];
}

// ---------------------------------------------------------------------------
// Lecture des saisies
// ---------------------------------------------------------------------------

/** « Commune LE LOROUX », ou « Commune 2 » tant que le nom n'est pas saisi. */
function ouCommune(c: Commune, rang: number): string {
  return c.nom.trim() ? `Commune ${c.nom.trim()}` : `Commune ${rang + 1}`;
}

interface Lecteur {
  /** Lit une saisie numérique ; vide = 0. Enregistre une erreur et renvoie NaN sinon. */
  nombre(
    saisie: string,
    libelle: string,
    options?: { min?: number; max?: number; entier?: boolean },
  ): number;
  enErreur(): boolean;
}

function lecteur(problemes: Probleme[], contexte: Omit<Probleme, "gravite" | "message">): Lecteur {
  let erreur = false;
  return {
    nombre(saisie, libelle, { min = 0, max, entier = false } = {}) {
      const v = parseNombre(saisie);
      let message: string | null = null;
      if (!Number.isFinite(v)) {
        message = `${libelle} : « ${saisie.trim()} » n'est pas un nombre.`;
      } else if (v < min) {
        message = `${libelle} : la valeur doit être positive.`;
      } else if (max !== undefined && v > max) {
        message = `${libelle} : la valeur doit être comprise entre ${min} et ${max}.`;
      } else if (entier && !Number.isInteger(v)) {
        message = `${libelle} : un nombre entier est attendu.`;
      }
      if (message) {
        erreur = true;
        problemes.push({ gravite: "erreur", message, ...contexte });
        return Number.NaN;
      }
      return v;
    },
    enErreur: () => erreur,
  };
}

interface ParametresCommune {
  communal: number;
  intercommunal: number;
  chambre: number;
  gemapi: number;
  roleTF: number;
  roleChambre: number;
  remembrementParHa: number;
  remembrementPart: number;
  syndicalesParHa: number;
  syndicalesPart: number;
}

function lireCommune(
  c: Commune,
  rang: number,
  problemes: Probleme[],
): ParametresCommune | null {
  const l = lecteur(problemes, { ou: ouCommune(c, rang), communeId: c.id });
  const pct = (s: string, libelle: string, max?: number) =>
    l.nombre(s, libelle, { max }) / 100;
  const p: ParametresCommune = {
    communal: pct(c.tauxCommunal, "Taux communal"),
    intercommunal: pct(c.tauxIntercommunal, "Taux intercommunal"),
    chambre: pct(c.tauxChambre, "Taux de chambre d'agriculture"),
    gemapi: pct(c.tauxGemapi, "Taux GEMAPI"),
    roleTF: pct(c.fraisRoleTaxesFoncieres, "Frais de rôle des taxes foncières"),
    roleChambre: pct(c.fraisRoleChambre, "Frais de rôle de la chambre d'agriculture"),
    remembrementParHa: l.nombre(c.remembrementParHa, "Remembrement (€/ha)"),
    remembrementPart: pct(c.remembrementPartPreneur, "Part du preneur (remembrement)", 100),
    syndicalesParHa: l.nombre(c.syndicalesParHa, "Taxes syndicales (€/ha)"),
    syndicalesPart: pct(c.syndicalesPartPreneur, "Part du preneur (taxes syndicales)", 100),
  };
  return l.enErreur() ? null : p;
}

// ---------------------------------------------------------------------------
// Calcul d'un bail
// ---------------------------------------------------------------------------

function ligneTaxe(
  id: IdTaxe,
  assiette: Assiette,
  tauxBail: number,
  fraisDeRole: number,
  methode: MethodeTaxe,
  params: ParametresDegrevement,
  libelleTauxBail: string,
): LigneTaxe {
  const repartition = { tauxBail, fraisDeRole };
  const res = calculerLigneTaxe(assiette, repartition, methode, params);
  return {
    id,
    libelle: LIBELLES_TAXES[id],
    montantTotal: res.montantTotal,
    impute: res.imputePreneur,
    detail: detaillerLigneTaxe(assiette, repartition, methode, params, {
      libelleTauxBail,
    }),
  };
}

function somme(valeurs: number[]): number {
  return arrondir(
    valeurs.reduce((s, v) => s + v, 0),
    2,
  );
}

function calculerBail(
  bail: Bail,
  exploitant: Exploitant,
  rangExploitant: number,
  commune: Commune,
  rangCommune: number,
  pc: ParametresCommune,
  annee: number,
  revalorisation: number,
  params: ParametresDegrevement,
  problemes: Probleme[],
): ResultatBail | null {
  const ou = `${nomExploitant(exploitant, rangExploitant)} – ${nomCommune(commune, rangCommune)}`;
  const contexte = { ou, bailId: bail.id, exploitantId: exploitant.id, communeId: commune.id };
  const l = lecteur(problemes, contexte);
  const surface = l.nombre(bail.surface, "Surface louée");
  const fermagePrecedent = l.nombre(bail.fermagePrecedent, "Fermage de l'an dernier");
  const rcPrecedent = l.nombre(bail.revenuCadastralPrecedent, "Revenu cadastral de l'an dernier");
  const tauxBail = l.nombre(bail.tauxBail, "Taux du bail (taxes foncières)", { max: 100 }) / 100;
  const tauxBailGemapi = l.nombre(bail.tauxBailGemapi, "Taux du bail (GEMAPI)", { max: 100 }) / 100;
  const acompte = l.nombre(bail.acompteVerse, "Acompte versé");
  const degrevement = l.nombre(bail.degrevement, "Dégrèvement");
  const secheresse = l.nombre(bail.secheresse, "Indemnité sécheresse");
  const autreTaxe = l.nombre(bail.autreTaxe, "Autre taxe");
  const autreDeduction = l.nombre(bail.autreDeduction, "Autre déduction");
  const nombreAcomptes = l.nombre(bail.nombreAcomptes, "Nombre d'acomptes", { entier: true });
  if (l.enErreur()) return null;

  if (rcPrecedent === 0) {
    problemes.push({
      gravite: "avertissement",
      message:
        "Revenu cadastral non renseigné : taxes foncières, chambre d'agriculture et GEMAPI à zéro.",
      ...contexte,
    });
  }
  if (fermagePrecedent === 0) {
    problemes.push({
      gravite: "avertissement",
      message: "Fermage de l'an dernier non renseigné.",
      ...contexte,
    });
  }

  const revalo = revaloriserFermage(fermagePrecedent, annee - 1, annee);
  const revenuCadastral = rcPrecedent * (1 + revalorisation);
  const rc = (taux: number, degrevee: boolean): Assiette => ({
    mode: "revenuCadastral",
    revenuCadastral,
    tauxImposition: taux,
    assietteDegrevee: degrevee,
  });

  const taxes: LigneTaxe[] = [
    ligneTaxe("communale", rc(pc.communal, true), tauxBail, pc.roleTF, "tfnb", params, "Taux du bail"),
    ligneTaxe("intercommunale", rc(pc.intercommunal, true), tauxBail, pc.roleTF, "tfnb", params, "Taux du bail"),
    ligneTaxe("chambre", rc(pc.chambre, false), 0.5, pc.roleChambre, "simple", params, "Part légale"),
    ligneTaxe("gemapi", rc(pc.gemapi, true), tauxBailGemapi, pc.roleTF, "simple", params, "Taux du bail GEMAPI"),
    ligneTaxe(
      "remembrement",
      { mode: "hectare", tauxHectare: pc.remembrementParHa, surfaceLouee: surface },
      pc.remembrementPart,
      0,
      "simple",
      params,
      "Part du preneur",
    ),
    ligneTaxe(
      "syndicales",
      { mode: "hectare", tauxHectare: pc.syndicalesParHa, surfaceLouee: surface },
      pc.syndicalesPart,
      0,
      "simple",
      params,
      "Part du preneur",
    ),
    {
      id: "autre",
      libelle: LIBELLES_TAXES.autre,
      montantTotal: null,
      impute: arrondir(autreTaxe, 2),
      detail: null,
    },
  ];

  const deductions: Record<IdDeduction, number> = {
    acompte: arrondir(acompte, 2),
    degrevement: arrondir(degrevement, 2),
    secheresse: arrondir(secheresse, 2),
    autre: arrondir(autreDeduction, 2),
  };
  const totalTaxes = somme(taxes.map((t) => t.impute));
  const totalDeductions = somme(Object.values(deductions));
  const fermage = revalo.loyer;

  return {
    bail,
    exploitant,
    rangExploitant,
    commune,
    rangCommune,
    surface,
    fermagePrecedent,
    fermage,
    revenuCadastralPrecedent: rcPrecedent,
    revenuCadastral,
    taxes,
    totalTaxes,
    deductions,
    totalDeductions,
    resteDu: arrondir(fermage + totalTaxes - totalDeductions, 2),
    nombreAcomptes,
    montantAcompte:
      nombreAcomptes > 0 ? arrondir(revalo.loyerExact / (nombreAcomptes + 1), 2) : 0,
    fermageParHa: surface > 0 ? fermage / surface : null,
    fermageEtTaxesParHa: surface > 0 ? (fermage + totalTaxes) / surface : null,
  };
}

// ---------------------------------------------------------------------------
// Totaux
// ---------------------------------------------------------------------------

export function totaliser(baux: ResultatBail[]): Totaux {
  const s = (f: (b: ResultatBail) => number) => somme(baux.map(f));
  const surface = baux.reduce((t, b) => t + b.surface, 0);
  const fermage = s((b) => b.fermage);
  const taxes = s((b) => b.totalTaxes);
  return {
    surface,
    fermagePrecedent: s((b) => b.fermagePrecedent),
    fermage,
    taxes,
    deductions: s((b) => b.totalDeductions),
    acomptes: s((b) => b.deductions.acompte),
    degrevements: s((b) => b.deductions.degrevement),
    secheresse: s((b) => b.deductions.secheresse),
    autresDeductions: s((b) => b.deductions.autre),
    resteDu: s((b) => b.resteDu),
    fermageParHa: surface > 0 ? fermage / surface : null,
    fermageEtTaxesParHa: surface > 0 ? (fermage + taxes) / surface : null,
  };
}

/** Somme d'une ligne de taxe sur plusieurs baux (ex. part communale d'un exploitant, toutes communes). */
export function totalTaxe(baux: ResultatBail[], id: IdTaxe): number {
  return somme(baux.map((b) => b.taxes.find((t) => t.id === id)?.impute ?? 0));
}

/** Les lignes de taxes non nulles pour au moins un des baux, dans l'ordre habituel. */
export function taxesUtiles(baux: ResultatBail[]): IdTaxe[] {
  return ORDRE_TAXES.filter((id) =>
    baux.some((b) => b.taxes.find((t) => t.id === id)?.impute !== 0),
  );
}

/** Les déductions non nulles pour au moins un des baux. */
export function deductionsUtiles(baux: ResultatBail[]): IdDeduction[] {
  return ORDRE_DEDUCTIONS.filter((id) => baux.some((b) => b.deductions[id] !== 0));
}

// ---------------------------------------------------------------------------
// Calcul du dossier
// ---------------------------------------------------------------------------

export function calculerDossier(dossier: Dossier): ResultatDossier {
  const problemes: Probleme[] = [];
  const annee = dossier.annee;
  const anneePrecedente = annee - 1;
  const indice = indicePourAnnee(annee) ?? null;
  const indicePrecedent = indicePourAnnee(anneePrecedente) ?? null;

  const lg = lecteur(problemes, { ou: "Paramètres de l'année" });
  const tauxDegrevement = lg.nombre(dossier.tauxDegrevement, "Taux de dégrèvement", { max: 99.99 }) / 100;
  const revalorisation =
    lg.nombre(dossier.revalorisationRevenuCadastral, "Revalorisation des revenus cadastraux", {
      min: -100,
    }) / 100;
  if (indice === null || indicePrecedent === null) {
    problemes.push({
      gravite: "erreur",
      ou: "Paramètres de l'année",
      message: `Indice des fermages inconnu pour ${indice === null ? annee : anneePrecedente}.`,
    });
  }

  const resultat: ResultatDossier = {
    annee,
    anneePrecedente,
    indicePrecedent,
    indice,
    coefficientFermage:
      indice !== null && indicePrecedent ? indice / indicePrecedent : null,
    tauxDegrevement,
    revalorisation,
    baux: [],
    parExploitant: [],
    parCommune: [],
    totaux: totaliser([]),
    problemes,
  };
  if (lg.enErreur() || indice === null || indicePrecedent === null) return resultat;

  const params: ParametresDegrevement = { tauxDegrevement };
  const parametresCommunes = new Map<string, ParametresCommune | null>();
  dossier.communes.forEach((c, rang) => {
    parametresCommunes.set(c.id, lireCommune(c, rang, problemes));
  });

  dossier.exploitants.forEach((exploitant, rangExploitant) => {
    const sesBaux = dossier.baux.filter((b) => b.exploitantId === exploitant.id);
    if (sesBaux.length === 0) {
      problemes.push({
        gravite: "avertissement",
        ou: nomExploitant(exploitant, rangExploitant),
        message: "Aucune terre louée n'est indiquée pour cet exploitant.",
        exploitantId: exploitant.id,
      });
    }
    // Baux dans l'ordre des communes du dossier.
    dossier.communes.forEach((commune, rangCommune) => {
      for (const bail of sesBaux.filter((b) => b.communeId === commune.id)) {
        const pc = parametresCommunes.get(commune.id);
        if (!pc) continue; // erreur déjà signalée sur la commune
        const r = calculerBail(
          bail,
          exploitant,
          rangExploitant,
          commune,
          rangCommune,
          pc,
          annee,
          revalorisation,
          params,
          problemes,
        );
        if (r) resultat.baux.push(r);
      }
    });
  });

  dossier.communes.forEach((commune, rang) => {
    if (!dossier.baux.some((b) => b.communeId === commune.id)) {
      problemes.push({
        gravite: "avertissement",
        ou: ouCommune(commune, rang),
        message: "Aucun exploitant ne loue de terres dans cette commune.",
        communeId: commune.id,
      });
    }
  });

  resultat.parExploitant = dossier.exploitants
    .map((exploitant, rang) => {
      const baux = resultat.baux.filter((b) => b.exploitant.id === exploitant.id);
      return { exploitant, rang, baux, totaux: totaliser(baux) };
    })
    .filter((g) => g.baux.length > 0);
  resultat.parCommune = dossier.communes
    .map((commune, rang) => {
      const baux = resultat.baux.filter((b) => b.commune.id === commune.id);
      return { commune, rang, baux, totaux: totaliser(baux) };
    })
    .filter((g) => g.baux.length > 0);
  resultat.totaux = totaliser(resultat.baux);
  return resultat;
}
