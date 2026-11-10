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
  type Coordonnees,
  type Dossier,
  type Exploitant,
  nomCommune,
  nomExploitant,
} from "./dossier";
import { arrondir, revaloriserFermage } from "./fermage";
import { formaterNombrePrecis, parseNombre, saisieVide } from "./format";
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
  /** Saisie concernée : nom du champ dans le dossier, la commune ou le bail. */
  champ?: string;
  /** Saisie obligatoire laissée vide. */
  manquant?: boolean;
  communeId?: string;
  exploitantId?: string;
  bailId?: string;
}

export interface ResultatDossier {
  /** Bailleur et échéance du dossier, repris tels quels pour les documents. */
  bailleur: Coordonnees;
  echeance: string;
  annee: number;
  anneePrecedente: number;
  indicePrecedent: number | null;
  indice: number | null;
  /** Rapport des indices (année ÷ année précédente), non arrondi. */
  coefficientFermage: number | null;
  /** Dégrèvement de la TFNB (fraction) et revalorisation des revenus cadastraux (fraction). */
  tauxDegrevement: number;
  revalorisation: number;
  /**
   * Vrai quand la fiche ne contient aucune erreur. Dans le cas contraire,
   * aucun résultat n'est fourni (baux, groupes et totaux vides) : un document
   * ne peut jamais être établi à partir d'une fiche incomplète ou erronée.
   */
  sansErreur: boolean;
  /** Nombre de terres louées saisies dans la fiche, calculées ou non. */
  bauxSaisis: number;
  /** Baux calculés, par exploitant puis par commune (vide si la fiche contient une erreur). */
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

/** Clés des saisies (champs texte) d'un objet du dossier. */
type Saisie<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T] & string;

interface OptionsLecture {
  min?: number;
  max?: number;
  entier?: boolean;
  /** Saisie obligatoire : une case vide est une erreur. Sinon, vide = 0. */
  requis?: boolean;
  /** Précision ajoutée au message d'une saisie obligatoire vide. */
  siVide?: string;
}

interface Lecteur<T> {
  /** Lit une saisie numérique. Enregistre une erreur et renvoie NaN si elle est invalide. */
  nombre(cle: Saisie<T>, libelle: string, options?: OptionsLecture): number;
  enErreur(): boolean;
}

type Contexte = Omit<Probleme, "gravite" | "message" | "champ" | "manquant">;

function lecteur<T>(objet: T, problemes: Probleme[], contexte: Contexte): Lecteur<T> {
  let erreur = false;
  const signaler = (champ: string, message: string, manquant = false): number => {
    erreur = true;
    problemes.push({ gravite: "erreur", message, champ, ...(manquant ? { manquant } : {}), ...contexte });
    return Number.NaN;
  };
  return {
    nombre(cle, libelle, { min = 0, max, entier = false, requis = false, siVide } = {}) {
      const saisie = String(objet[cle] ?? "");
      if (saisieVide(saisie)) {
        return requis
          ? signaler(cle, `${libelle} à renseigner${siVide ? ` (${siVide})` : ""}.`, true)
          : 0;
      }
      const v = parseNombre(saisie);
      if (!Number.isFinite(v)) {
        return signaler(cle, `${libelle} : « ${saisie.trim()} » n'est pas un nombre.`);
      }
      if (v < min) {
        return signaler(
          cle,
          min === 0
            ? `${libelle} : la valeur ne peut pas être négative.`
            : `${libelle} : la valeur doit être au moins ${formaterNombrePrecis(min)}.`,
        );
      }
      if (max !== undefined && v > max) {
        return signaler(
          cle,
          `${libelle} : la valeur doit être comprise entre ${formaterNombrePrecis(min)} et ${formaterNombrePrecis(max)}.`,
        );
      }
      if (entier && !Number.isInteger(v)) {
        return signaler(cle, `${libelle} : un nombre entier est attendu.`);
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

/**
 * Taux votés et frais de rôle sont obligatoires (0 doit être saisi
 * explicitement) ; remembrement et taxes syndicales sont facultatifs, mais
 * la part du preneur devient obligatoire dès qu'un montant à l'hectare est
 * saisi.
 */
function lireCommune(
  c: Commune,
  rang: number,
  problemes: Probleme[],
): ParametresCommune | null {
  const l = lecteur(c, problemes, { ou: ouCommune(c, rang), communeId: c.id });
  const pct = (cle: Saisie<Commune>, libelle: string, options: OptionsLecture = {}) =>
    l.nombre(cle, libelle, options) / 100;
  const communal = pct("tauxCommunal", "Taux communal", { requis: true });
  const intercommunal = pct("tauxIntercommunal", "Taux intercommunal", {
    requis: true,
    siVide: "0 s'il n'y en a pas",
  });
  const chambre = pct("tauxChambre", "Taux de la chambre d'agriculture", { requis: true });
  const gemapi = pct("tauxGemapi", "Taux GEMAPI", { requis: true, siVide: "0 s'il n'y en a pas" });
  const roleTF = pct("fraisRoleTaxesFoncieres", "Frais de rôle des taxes foncières et GEMAPI", {
    requis: true,
  });
  const roleChambre = pct("fraisRoleChambre", "Frais de rôle de la chambre d'agriculture", {
    requis: true,
  });
  const remembrementParHa = l.nombre("remembrementParHa", "Remembrement (€/ha)");
  const remembrementPart = pct("remembrementPartPreneur", "Part du preneur (remembrement)", {
    max: 100,
    requis: remembrementParHa > 0,
  });
  const syndicalesParHa = l.nombre("syndicalesParHa", "Taxes syndicales (€/ha)");
  const syndicalesPart = pct("syndicalesPartPreneur", "Part du preneur (taxes syndicales)", {
    max: 100,
    requis: syndicalesParHa > 0,
  });
  if (l.enErreur()) return null;
  return {
    communal,
    intercommunal,
    chambre,
    gemapi,
    roleTF,
    roleChambre,
    remembrementParHa,
    remembrementPart,
    syndicalesParHa,
    syndicalesPart,
  };
}

/** Saisies numériques d'un bail, lues et contrôlées. */
interface SaisiesBail {
  surface: number;
  fermagePrecedent: number;
  rcPrecedent: number;
  tauxBail: number;
  tauxBailGemapi: number;
  acompte: number;
  degrevement: number;
  secheresse: number;
  autreDeduction: number;
  autreTaxe: number;
  nombreAcomptes: number;
}

/**
 * Surface, fermage et revenu cadastral de l'an dernier, taux du bail sont
 * obligatoires ; acompte, dégrèvement, indemnité sécheresse, autre taxe,
 * autre déduction et nombre d'acomptes valent 0 s'ils sont laissés vides.
 */
function lireBail(
  bail: Bail,
  contexte: Contexte,
  annee: number,
  problemes: Probleme[],
): SaisiesBail | null {
  const l = lecteur(bail, problemes, contexte);
  const s: SaisiesBail = {
    surface: l.nombre("surface", "Surface louée", { requis: true }),
    fermagePrecedent: l.nombre("fermagePrecedent", `Fermage ${annee - 1}`, { requis: true }),
    rcPrecedent: l.nombre("revenuCadastralPrecedent", `Revenu cadastral ${annee - 1}`, {
      requis: true,
    }),
    tauxBail:
      l.nombre("tauxBail", "Taux du bail (taxes foncières)", { max: 100, requis: true }) / 100,
    tauxBailGemapi:
      l.nombre("tauxBailGemapi", "Taux du bail (GEMAPI)", {
        max: 100,
        requis: true,
        siVide: "0 si le bail ne prévoit rien",
      }) / 100,
    acompte: l.nombre("acompteVerse", "Acompte déjà versé"),
    degrevement: l.nombre("degrevement", "Dégrèvement"),
    secheresse: l.nombre("secheresse", "Indemnité sécheresse"),
    autreDeduction: l.nombre("autreDeduction", "Autre déduction"),
    autreTaxe: l.nombre("autreTaxe", "Autre taxe"),
    nombreAcomptes: l.nombre("nombreAcomptes", `Acomptes à prévoir en ${annee + 1}`, {
      entier: true,
    }),
  };
  if (l.enErreur()) return null;

  const avertir = (champ: Saisie<Bail>, message: string) =>
    problemes.push({ gravite: "avertissement", message, champ, ...contexte });
  if (s.surface === 0) {
    avertir(
      "surface",
      "Surface louée égale à 0 : fermage à l'hectare non calculé, remembrement et taxes syndicales à 0.",
    );
  }
  if (s.fermagePrecedent === 0) {
    avertir("fermagePrecedent", `Fermage ${annee - 1} égal à 0 : le fermage ${annee} sera nul.`);
  }
  if (s.rcPrecedent === 0) {
    avertir(
      "revenuCadastralPrecedent",
      `Revenu cadastral ${annee - 1} égal à 0 : taxes foncières, chambre d'agriculture et GEMAPI à 0.`,
    );
  }
  return s;
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
  s: SaisiesBail,
  pc: ParametresCommune,
  annee: number,
  revalorisation: number,
  params: ParametresDegrevement,
): ResultatBail {
  const {
    surface,
    fermagePrecedent,
    rcPrecedent,
    tauxBail,
    tauxBailGemapi,
    acompte,
    degrevement,
    secheresse,
    autreTaxe,
    autreDeduction,
    nombreAcomptes,
  } = s;

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
    // Fermages de l'an dernier tels qu'affichés (au centime), même saisis avec plus de décimales.
    fermagePrecedent: s((b) => arrondir(b.fermagePrecedent, 2)),
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

  const ouAnnee = "Année de calcul";
  const lg = lecteur(dossier, problemes, { ou: ouAnnee });
  const revalorisation =
    lg.nombre("revalorisationRevenuCadastral", "Revalorisation des revenus cadastraux", {
      min: -100,
      requis: true,
    }) / 100;
  const tauxDegrevement =
    lg.nombre("tauxDegrevement", "Dégrèvement de la TFNB", { max: 99.99, requis: true }) / 100;
  if (indice === null || indicePrecedent === null) {
    problemes.push({
      gravite: "erreur",
      ou: ouAnnee,
      message: `Indice des fermages inconnu pour ${indice === null ? annee : anneePrecedente}.`,
    });
  }

  const resultat: ResultatDossier = {
    bailleur: dossier.bailleur,
    echeance: dossier.echeance,
    annee,
    anneePrecedente,
    indicePrecedent,
    indice,
    coefficientFermage:
      indice !== null && indicePrecedent ? indice / indicePrecedent : null,
    tauxDegrevement,
    revalorisation,
    sansErreur: false,
    bauxSaisis: 0,
    baux: [],
    parExploitant: [],
    parCommune: [],
    totaux: totaliser([]),
    problemes,
  };
  // Toutes les saisies sont contrôlées, même si les paramètres de l'année
  // sont en erreur, pour signaler toutes les corrections d'un coup.
  const calculPossible = !lg.enErreur() && indice !== null && indicePrecedent !== null;

  const params: ParametresDegrevement = { tauxDegrevement };
  const parametresCommunes = new Map<string, ParametresCommune | null>();
  dossier.communes.forEach((c, rang) => {
    parametresCommunes.set(c.id, lireCommune(c, rang, problemes));
  });

  const baux: ResultatBail[] = [];
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
        resultat.bauxSaisis += 1;
        const contexte: Contexte = {
          ou: `${nomExploitant(exploitant, rangExploitant)} – ${nomCommune(commune, rangCommune)}`,
          bailId: bail.id,
          exploitantId: exploitant.id,
          communeId: commune.id,
        };
        const saisies = lireBail(bail, contexte, annee, problemes);
        const pc = parametresCommunes.get(commune.id);
        if (!saisies || !pc || !calculPossible) continue;
        baux.push(
          calculerBail(
            bail,
            exploitant,
            rangExploitant,
            commune,
            rangCommune,
            saisies,
            pc,
            annee,
            revalorisation,
            params,
          ),
        );
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

  // Une seule erreur dans la fiche, et aucun résultat n'est fourni : un appel
  // regroupant plusieurs communes ne doit jamais omettre silencieusement des
  // terres en erreur, et rien d'incomplet ne doit pouvoir être imprimé.
  resultat.sansErreur = !problemes.some((p) => p.gravite === "erreur");
  if (!resultat.sansErreur) return resultat;

  resultat.baux = baux;
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
