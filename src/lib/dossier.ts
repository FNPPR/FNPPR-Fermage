/**
 * Dossier d'un propriétaire bailleur : ses communes (chacune avec son avis de
 * taxes foncières et ses taux votés), ses exploitants (preneurs) et ses baux.
 *
 * Un bail = les terres louées à UN exploitant dans UNE commune. Un même
 * exploitant peut donc avoir plusieurs baux (un par commune), et une commune
 * plusieurs exploitants — sur le modèle de la matrice FNPPR « calcul par
 * revenu cadastral » (feuilles COMMUNE 1, COMMUNE 2… et RECAP).
 *
 * Toutes les valeurs saisies sont conservées telles que tapées (texte) et
 * converties en nombres au moment du calcul (voir `calculDossier.ts`), comme
 * dans le reste du calculateur : une saisie en cours (« 12, ») ne doit pas
 * être réécrite sous les doigts de l'utilisateur.
 */

import { ANNEE_MAX, ANNEE_MIN } from "../data/indices";

export const FORMAT_DOSSIER = "fnppr-fermage-dossier";
export const VERSION_DOSSIER = 1;

export interface Coordonnees {
  /** Formule d'adresse : « Madame », « Monsieur », « M. et Mme », « Messieurs »… */
  civilite: string;
  nom: string;
  prenom: string;
  /** Adresse (une ou plusieurs lignes), sans le code postal ni la commune. */
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
}

export interface Commune {
  id: string;
  nom: string;
  codePostal: string;
  /** Taux votés (%), bas de colonne « Propriétés non bâties » de l'avis. */
  tauxCommunal: string;
  tauxIntercommunal: string;
  tauxChambre: string;
  tauxGemapi: string;
  /** Frais de rôle (%) des taxes foncières (parts communale et
   * intercommunale) et de la taxe GEMAPI. */
  fraisRoleTaxesFoncieres: string;
  /** Frais de rôle (%) de la taxe pour frais de chambre d'agriculture. */
  fraisRoleChambre: string;
  /** Taxe de remembrement : montant à l'hectare (€/ha) et part du preneur (%). */
  remembrementParHa: string;
  remembrementPartPreneur: string;
  /** Taxes syndicales / de marais : montant à l'hectare (€/ha) et part du preneur (%). */
  syndicalesParHa: string;
  syndicalesPartPreneur: string;
}

export interface Exploitant {
  id: string;
  coordonnees: Coordonnees;
}

/** Les terres louées à un exploitant dans une commune. */
export interface Bail {
  id: string;
  exploitantId: string;
  communeId: string;
  /** Surface louée (ha). */
  surface: string;
  /** Fermage de l'année précédente (€), réévalué par l'indice. */
  fermagePrecedent: string;
  /** Revenu cadastral de l'année précédente (€), propre à cet exploitant :
   * relevé de propriété, NON minoré de 30 %. */
  revenuCadastralPrecedent: string;
  /** Part des taxes foncières remboursée par le preneur, prévue au bail (%). */
  tauxBail: string;
  /** Part de la taxe GEMAPI remboursée par le preneur, prévue au bail (%). */
  tauxBailGemapi: string;
  /** Acompte déjà versé sur le fermage de l'année (€). */
  acompteVerse: string;
  /** Dégrèvement obtenu par le bailleur, à reverser au preneur (€). */
  degrevement: string;
  /** Indemnité sécheresse à reverser au preneur (€). */
  secheresse: string;
  /** Autre somme à la charge du preneur, ajoutée aux taxes (€). */
  autreTaxe: string;
  /** Autre somme en faveur du preneur, déduite (€). */
  autreDeduction: string;
  /** Nombre d'acomptes à prévoir pour l'année suivante, avant l'échéance. */
  nombreAcomptes: string;
}

export interface Dossier {
  format: typeof FORMAT_DOSSIER;
  version: number;
  /** Année de calcul : le fermage de l'année précédente est réévalué par le
   * rapport des indices (année ÷ année précédente). */
  annee: number;
  /** Date d'échéance du fermage (AAAA-MM-JJ). */
  echeance: string;
  /** Coefficient de revalorisation des revenus cadastraux de l'année (%) :
   * 0,8 % pour 2026. */
  revalorisationRevenuCadastral: string;
  /** Taux de dégrèvement de la TFNB au profit du preneur (%) : 30 % depuis 2025. */
  tauxDegrevement: string;
  bailleur: Coordonnees;
  communes: Commune[];
  exploitants: Exploitant[];
  baux: Bail[];
  /** Lieu et date (AAAA-MM-JJ) des appels de fermage. */
  lieuCourrier: string;
  dateCourrier: string;
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

let compteur = 0;
/** Identifiant unique, stable dans un fichier enregistré puis rouvert. */
export function nouvelIdentifiant(prefixe: string): string {
  compteur += 1;
  return `${prefixe}-${Date.now().toString(36)}-${compteur.toString(36)}`;
}

export function coordonneesVides(): Coordonnees {
  return {
    civilite: "",
    nom: "",
    prenom: "",
    adresse: "",
    codePostal: "",
    ville: "",
    telephone: "",
    email: "",
  };
}

export function nouvelleCommune(id = nouvelIdentifiant("commune")): Commune {
  return {
    id,
    nom: "",
    codePostal: "",
    tauxCommunal: "",
    tauxIntercommunal: "",
    tauxChambre: "",
    tauxGemapi: "",
    fraisRoleTaxesFoncieres: "3",
    fraisRoleChambre: "8",
    remembrementParHa: "",
    remembrementPartPreneur: "",
    syndicalesParHa: "",
    syndicalesPartPreneur: "",
  };
}

export function nouvelExploitant(id = nouvelIdentifiant("exploitant")): Exploitant {
  return { id, coordonnees: coordonneesVides() };
}

export function nouveauBail(
  exploitantId: string,
  communeId: string,
  id = nouvelIdentifiant("bail"),
): Bail {
  return {
    id,
    exploitantId,
    communeId,
    surface: "",
    fermagePrecedent: "",
    revenuCadastralPrecedent: "",
    tauxBail: "20",
    tauxBailGemapi: "0",
    acompteVerse: "",
    degrevement: "",
    secheresse: "",
    autreTaxe: "",
    autreDeduction: "",
    nombreAcomptes: "",
  };
}

/** Échéance par défaut : le 1er novembre de l'année de calcul. */
function echeanceParDefaut(annee: number): string {
  return `${annee}-11-01`;
}

export function nouveauDossier(annee = ANNEE_MAX): Dossier {
  return {
    format: FORMAT_DOSSIER,
    version: VERSION_DOSSIER,
    annee,
    echeance: echeanceParDefaut(annee),
    revalorisationRevenuCadastral: "0,8",
    tauxDegrevement: "30",
    bailleur: coordonneesVides(),
    communes: [],
    exploitants: [],
    baux: [],
    lieuCourrier: "",
    dateCourrier: "",
  };
}

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

/** « MOREAU Aline » ; « Exploitant 2 » tant que rien n'est saisi. */
export function nomAffiche(c: Coordonnees, parDefaut: string): string {
  const texte = [c.nom.trim(), c.prenom.trim()].filter(Boolean).join(" ");
  return texte || parDefaut;
}

export function nomCommune(commune: Commune, rang: number): string {
  return commune.nom.trim() || `Commune ${rang + 1}`;
}

export function nomExploitant(exploitant: Exploitant, rang: number): string {
  return nomAffiche(exploitant.coordonnees, `Exploitant ${rang + 1}`);
}

// ---------------------------------------------------------------------------
// Lecture d'un dossier enregistré (fichier ou mémoire du navigateur)
// ---------------------------------------------------------------------------

function texte(v: unknown, parDefaut = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return parDefaut;
}

function objet(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function lireCoordonnees(v: unknown): Coordonnees {
  const o = objet(v);
  const base = coordonneesVides();
  for (const cle of Object.keys(base) as (keyof Coordonnees)[]) {
    base[cle] = texte(o[cle]);
  }
  return base;
}

function lireCommune(v: unknown): Commune {
  const o = objet(v);
  const base = nouvelleCommune(texte(o.id) || nouvelIdentifiant("commune"));
  for (const cle of Object.keys(base) as (keyof Commune)[]) {
    if (cle === "id") continue;
    if (cle in o) base[cle] = texte(o[cle]);
  }
  return base;
}

function lireExploitant(v: unknown): Exploitant {
  const o = objet(v);
  return {
    id: texte(o.id) || nouvelIdentifiant("exploitant"),
    coordonnees: lireCoordonnees(o.coordonnees),
  };
}

function lireBail(v: unknown): Bail {
  const o = objet(v);
  const base = nouveauBail(
    texte(o.exploitantId),
    texte(o.communeId),
    texte(o.id) || nouvelIdentifiant("bail"),
  );
  for (const cle of Object.keys(base) as (keyof Bail)[]) {
    if (cle === "id" || cle === "exploitantId" || cle === "communeId") continue;
    if (cle in o) base[cle] = texte(o[cle]);
  }
  return base;
}

/**
 * Reconstruit un dossier complet et cohérent à partir de données lues dans un
 * fichier ou dans la mémoire du navigateur : champs manquants complétés,
 * valeurs inattendues ignorées, baux orphelins (commune ou exploitant
 * supprimé) retirés.
 * @throws si les données ne sont pas un dossier du calculateur.
 */
export function lireDossier(donnees: unknown): Dossier {
  const o = objet(donnees);
  if (o.format !== FORMAT_DOSSIER) {
    throw new Error(
      "Ce fichier n'est pas un dossier du calculateur de fermage.",
    );
  }
  const anneeLue = Number(o.annee);
  const annee =
    Number.isInteger(anneeLue) && anneeLue > ANNEE_MIN && anneeLue <= ANNEE_MAX
      ? anneeLue
      : ANNEE_MAX;
  const communes = Array.isArray(o.communes) ? o.communes.map(lireCommune) : [];
  const exploitants = Array.isArray(o.exploitants)
    ? o.exploitants.map(lireExploitant)
    : [];
  const idsCommunes = new Set(communes.map((c) => c.id));
  const idsExploitants = new Set(exploitants.map((e) => e.id));
  const baux = (Array.isArray(o.baux) ? o.baux.map(lireBail) : []).filter(
    (b) => idsCommunes.has(b.communeId) && idsExploitants.has(b.exploitantId),
  );
  return {
    format: FORMAT_DOSSIER,
    version: VERSION_DOSSIER,
    annee,
    echeance: texte(o.echeance) || echeanceParDefaut(annee),
    revalorisationRevenuCadastral: texte(o.revalorisationRevenuCadastral, "0,8"),
    tauxDegrevement: texte(o.tauxDegrevement, "30"),
    bailleur: lireCoordonnees(o.bailleur),
    communes,
    exploitants,
    baux,
    lieuCourrier: texte(o.lieuCourrier),
    dateCourrier: texte(o.dateCourrier),
  };
}

/** Texte du fichier d'un dossier (JSON lisible). */
export function exporterDossier(dossier: Dossier): string {
  return JSON.stringify(dossier, null, 2);
}

/** Nom de fichier proposé à l'enregistrement : « dossier-fermages-joly-2026.json ». */
export function nomFichierDossier(dossier: Dossier): string {
  const nom = nomAffiche(dossier.bailleur, "proprietaire")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `dossier-fermages-${nom || "proprietaire"}-${dossier.annee}.json`;
}
