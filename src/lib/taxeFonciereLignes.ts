/**
 * Modèle des lignes de taxes de l'onglet « Répartition des taxes foncières et
 * assimilées » (TFNB communale/intercommunale, chambre d'agriculture, taxe
 * GEMAPI, remembrement, taxes syndicales) et calcul agrégé de leur
 * répartition preneur/bailleur.
 *
 * Extrait de `components/TaxeFonciere.tsx` pour être réutilisable ailleurs
 * (notamment par l'onglet « Appel de fermage », qui reprend automatiquement
 * ces lignes dans son décompte).
 */

import {
  calculerLigneTaxe,
  detaillerLigneTaxe,
  totalImputePreneur,
  totalMontant,
  type Assiette,
  type DetailLigneTaxe,
  type ModeAssiette,
  type MethodeTaxe,
  type ParametresDegrevement,
  type ResultatTaxe,
} from "./taxeFonciere";
import { formaterEuros, parseNombre } from "./format";

export interface LigneUI {
  id: string;
  libelle: string;
  methode: MethodeTaxe;
  /** Le mode de calcul de l'assiette retenu pour cette ligne. */
  modeAssiette: ModeAssiette;
  /** Les modes de calcul de l'assiette pertinents pour cette taxe. */
  modesPossibles: ModeAssiette[];
  /** L'assiette « revenu cadastral » de cette taxe bénéficie-t-elle du
   * dégrèvement de 30 % ? (oui pour TFNB et GEMAPI, non pour la chambre
   * d'agriculture). */
  assietteDegrevee: boolean;
  /** Part du preneur fixée par la loi (en %), non modifiable : remplace le
   * taux du bail (chambre d'agriculture : 50 %). */
  tauxBailLegal?: string;
  note?: string;
  aideMontantAppele: string;
  aidePartExploitee: string;
  aideTauxImposition: string;
  // Champs de saisie (tous en texte, convertis à l'usage). Le revenu
  // cadastral de l'exploitant, commun à toutes les lignes, est saisi une
  // seule fois (voir `SaisieTaxes`).
  montantAppele: string;
  partExploitant: string; // %
  tauxImposition: string; // %
  tauxHectare: string;
  surfaceLouee: string;
  tauxBail: string; // %
  fraisDeRole: string; // %
}

export const LIBELLES_MODE: Record<ModeAssiette, string> = {
  revenuCadastral: "Revenu cadastral de l'exploitant × taux voté (méthode rigoureuse)",
  montantGlobal: "Montant global de l'avis × % de surface (approximation)",
  hectare: "Taux à l'hectare × surface louée",
};

const MODES_TAXE_FONCIERE: ModeAssiette[] = ["revenuCadastral", "montantGlobal"];
const MODES_TAXE_SURFACE: ModeAssiette[] = ["hectare", "montantGlobal"];

export const LIGNES_INITIALES: LigneUI[] = [
  {
    id: "commune",
    libelle: "TFNB – part communale",
    methode: "tfnb",
    modeAssiette: "revenuCadastral",
    modesPossibles: MODES_TAXE_FONCIERE,
    assietteDegrevee: true,
    aideMontantAppele:
      "Imposition de la Commune : revenu cadastral dégrevé (−30 %) × taux communal (bas de colonne « Commune / Propriétés non bâties »)",
    aidePartExploitee:
      "Pourcentage de surface donnée à bail sur la surface totale imposée au taux communal",
    aideTauxImposition:
      "Taux communal : bas de colonne « Commune / Propriétés non bâties » de l'avis",
    montantAppele: "",
    partExploitant: "100",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "20",
    fraisDeRole: "3",
  },
  {
    id: "interco",
    libelle: "TFNB – part intercommunale",
    methode: "tfnb",
    modeAssiette: "revenuCadastral",
    modesPossibles: MODES_TAXE_FONCIERE,
    assietteDegrevee: true,
    aideMontantAppele:
      "Imposition de l'Intercommunalité : revenu cadastral dégrevé (−30 %) × taux intercommunal (bas de colonne « Intercommunalité / Propriétés non bâties »)",
    aidePartExploitee:
      "Pourcentage de surface donnée à bail sur la surface totale imposée au taux intercommunal",
    aideTauxImposition:
      "Taux intercommunal : bas de colonne « Intercommunalité / Propriétés non bâties » de l'avis",
    montantAppele: "",
    partExploitant: "100",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "20",
    fraisDeRole: "3",
  },
  {
    id: "chambre",
    libelle: "Frais de chambre d'agriculture",
    methode: "simple",
    modeAssiette: "revenuCadastral",
    modesPossibles: MODES_TAXE_FONCIERE,
    assietteDegrevee: false,
    tauxBailLegal: "50",
    note:
      "Le taux de 50 % ne résulte pas d'une clause du bail : c'est une disposition d'ordre public (art. 1604 du Code général des impôts et art. L514-1 du Code rural et de la pêche maritime), non négociable entre les parties.",
    aideMontantAppele:
      "Imposition de la Chambre d'agriculture : revenu cadastral NON dégrevé × taux de chambre d'agriculture (bas de colonne « Chambre d'agriculture / Propriétés non bâties »)",
    aidePartExploitee:
      "Pourcentage de surface donnée à bail sur la surface totale imposée au taux de chambre d'agriculture",
    aideTauxImposition:
      "Taux de chambre d'agriculture : bas de colonne « Chambre d'agriculture / Propriétés non bâties » de l'avis",
    montantAppele: "",
    partExploitant: "100",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "50",
    fraisDeRole: "8",
  },
  {
    id: "gemapi",
    libelle: "Taxe GEMAPI",
    methode: "simple",
    modeAssiette: "revenuCadastral",
    modesPossibles: MODES_TAXE_FONCIERE,
    assietteDegrevee: true,
    note:
      "Vérification préalable indispensable : la taxe GEMAPI étant une imposition récente, les baux anciens ne prévoient pas nécessairement son remboursement. Assurez-vous que votre bail comporte bien une clause en ce sens avant d'en imputer une part au preneur ; à défaut, laissez le taux du bail à 0 %. Pour le calcul : l'administration fiscale calcule la taxe GEMAPI sur une base déjà réduite à 70 % (même dégrèvement que la TFNB), l'assiette est donc dégrevée comme pour la TFNB. En revanche, la taxe GEMAPI n'a pas le caractère d'une taxe foncière : sa répartition ne suit PAS la formule de la TFNB (pas de soustraction du taux de dégrèvement), mais la formule « simple » des autres taxes annexes.",
    aideMontantAppele:
      "Imposition Taxe GEMAPI : revenu cadastral dégrevé (−30 %) × taux Taxe GEMAPI (bas de colonne « Taxe GEMAPI / Propriétés non bâties »)",
    aidePartExploitee:
      "Pourcentage de surface donnée à bail sur la surface totale imposée à la taxe GEMAPI",
    aideTauxImposition:
      "Taux Taxe GEMAPI : bas de colonne « Taxe GEMAPI / Propriétés non bâties » de l'avis",
    montantAppele: "",
    partExploitant: "100",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "0",
    fraisDeRole: "3",
  },
  {
    id: "remembrement",
    libelle: "Taxe de remembrement",
    methode: "simple",
    modeAssiette: "hectare",
    modesPossibles: MODES_TAXE_SURFACE,
    assietteDegrevee: false,
    note:
      "Frais de rôle à vérifier : ils ne s'appliquent pas systématiquement à cette taxe — reportez-vous à l'avis et au protocole départemental de partage.",
    aideMontantAppele:
      "Imposition Taxe de remembrement : taux à l'hectare × surface louée, suivant le partage contractuellement défini (protocole départemental)",
    aidePartExploitee:
      "Pourcentage de surface donnée à bail sur la surface totale imposée à la taxe de remembrement",
    aideTauxImposition: "Taux à l'hectare fixé par le protocole départemental",
    montantAppele: "",
    partExploitant: "100",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "0",
    fraisDeRole: "0",
  },
  {
    id: "syndicales",
    libelle: "Taxes syndicales / de marais",
    methode: "simple",
    modeAssiette: "hectare",
    modesPossibles: MODES_TAXE_SURFACE,
    assietteDegrevee: false,
    note:
      "Perçue par une association syndicale de propriétaires (marais, drainage, irrigation…) : le remboursement par le preneur dépend d'une clause expresse du bail, à vérifier au cas par cas.",
    aideMontantAppele:
      "Imposition de l'association syndicale (marais, drainage…) : taux ou cotisation à l'hectare × surface louée",
    aidePartExploitee:
      "Pourcentage de surface donnée à bail sur la surface totale imposée par l'association syndicale",
    aideTauxImposition: "Taux ou cotisation à l'hectare de l'association syndicale",
    montantAppele: "",
    partExploitant: "100",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "0",
    fraisDeRole: "0",
  },
];

/** Taux de répartition effectivement appliqué : part légale ou taux du bail (en %). */
export function tauxBailEffectif(l: LigneUI): string {
  return l.tauxBailLegal ?? l.tauxBail;
}

/** Construit l'assiette à calculer à partir des champs saisis pour une ligne. */
export function assietteDeLaLigne(l: LigneUI, revenuCadastral: number): Assiette {
  switch (l.modeAssiette) {
    case "montantGlobal":
      return {
        mode: "montantGlobal",
        montantAppele: parseNombre(l.montantAppele),
        partExploitant: parseNombre(l.partExploitant) / 100,
      };
    case "revenuCadastral":
      return {
        mode: "revenuCadastral",
        revenuCadastral,
        tauxImposition: parseNombre(l.tauxImposition) / 100,
        assietteDegrevee: l.assietteDegrevee,
      };
    case "hectare":
      return {
        mode: "hectare",
        tauxHectare: parseNombre(l.tauxHectare),
        surfaceLouee: parseNombre(l.surfaceLouee),
      };
  }
}

/** Ce que saisit l'utilisateur dans l'onglet (hors lignes). */
export interface SaisieTaxes {
  lignes: LigneUI[];
  /** Taux de dégrèvement de la TFNB, en % (ex. "30"). */
  tauxDegrevement: string;
  /** Revenu cadastral de l'exploitant (€), commun à toutes les lignes
   * calculées selon la méthode du revenu cadastral. */
  revenuCadastral: string;
}

export interface ResultatLigne {
  ligne: LigneUI;
  res: ResultatTaxe;
  detail: DetailLigneTaxe;
}

export type CalculTaxe =
  | { erreur: string }
  | {
      params: ParametresDegrevement;
      /** Revenu cadastral de l'exploitant retenu (€). */
      revenuCadastral: number;
      resultats: ResultatLigne[];
      totalPreneur: number;
      totalGeneral: number;
    };

/** Paramètres communs à toutes les lignes, une fois les saisies vérifiées. */
export type ParametresTaxes =
  | { erreur: string }
  | { params: ParametresDegrevement; revenuCadastral: number };

/** Lit et vérifie le taux de dégrèvement et le revenu cadastral saisis. */
export function lireParametresTaxes(saisie: SaisieTaxes): ParametresTaxes {
  const tauxDegrevement = parseNombre(saisie.tauxDegrevement) / 100;
  if (
    !Number.isFinite(tauxDegrevement) ||
    tauxDegrevement < 0 ||
    tauxDegrevement >= 1
  ) {
    return {
      erreur:
        "Taux de dégrèvement invalide : saisissez un pourcentage entre 0 et 100 (30 depuis 2025).",
    };
  }
  const revenuCadastral = parseNombre(saisie.revenuCadastral);
  const utiliseRevenuCadastral = saisie.lignes.some(
    (l) => l.modeAssiette === "revenuCadastral",
  );
  if (
    utiliseRevenuCadastral &&
    (!Number.isFinite(revenuCadastral) || revenuCadastral < 0)
  ) {
    return {
      erreur:
        "Revenu cadastral de l'exploitant invalide : saisissez un montant en euros (ex. 947,52).",
    };
  }
  return { params: { tauxDegrevement }, revenuCadastral };
}

/** Résultat du calcul d'une seule ligne : montants et détail, ou erreur de saisie. */
export type CalculLigne =
  | { erreur: string }
  | { res: ResultatTaxe; detail: DetailLigneTaxe };

/**
 * Calcule une ligne de taxe. Une erreur de saisie ne concerne que cette
 * ligne : l'onglet peut continuer d'afficher ses champs pour la corriger.
 */
export function calculerUneLigne(
  l: LigneUI,
  params: ParametresDegrevement,
  revenuCadastral: number,
): CalculLigne {
  try {
    const assiette = assietteDeLaLigne(l, revenuCadastral);
    const repartition = {
      tauxBail: parseNombre(tauxBailEffectif(l)) / 100,
      fraisDeRole: parseNombre(l.fraisDeRole) / 100,
    };
    return {
      res: calculerLigneTaxe(assiette, repartition, l.methode, params),
      detail: detaillerLigneTaxe(assiette, repartition, l.methode, params, {
        libelleTauxBail: l.tauxBailLegal ? "Part légale" : "Taux du bail",
      }),
    };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
  }
}

/**
 * Calcule la répartition preneur/bailleur de l'ensemble des lignes de taxes.
 * En cas d'erreur de saisie, le message indique la ligne concernée.
 */
export function calculerToutesLesLignes(saisie: SaisieTaxes): CalculTaxe {
  const parametres = lireParametresTaxes(saisie);
  if ("erreur" in parametres) return parametres;
  const { params, revenuCadastral } = parametres;

  const resultats: ResultatLigne[] = [];
  for (const l of saisie.lignes) {
    const calcul = calculerUneLigne(l, params, revenuCadastral);
    if ("erreur" in calcul) {
      return { erreur: `${l.libelle} — ${calcul.erreur}` };
    }
    resultats.push({ ligne: l, ...calcul });
  }

  return {
    params,
    revenuCadastral,
    resultats,
    totalPreneur: totalImputePreneur(resultats.map((r) => r.res)),
    totalGeneral: totalMontant(resultats.map((r) => r.res)),
  };
}

/** Une ligne a-t-elle un montant (à montrer dans le détail et dans l'appel) ? */
export function ligneRenseignee({ res }: ResultatLigne): boolean {
  return res.montantTotal !== 0 || res.imputePreneur !== 0;
}

/**
 * Écrit l'addition des montants imputés au preneur, ligne par ligne, telle
 * qu'elle figure au détail des calculs : « −41,59 € − 3,08 € + 76,80 € =
 * 32,13 € ». Le total est la somme des montants arrondis des lignes.
 */
export function additionTotalPreneur(
  resultats: ResultatLigne[],
  totalPreneur: number,
): string {
  const termes = resultats
    .map((r) => r.res.imputePreneur)
    .filter((m) => m !== 0);
  if (termes.length === 0) return `${formaterEuros(0)}`;
  const texte = termes
    .map((m, i) => {
      const valeur = formaterEuros(Math.abs(m));
      if (i === 0) return m < 0 ? `−${valeur}` : valeur;
      return m < 0 ? ` − ${valeur}` : ` + ${valeur}`;
    })
    .join("");
  return termes.length === 1 ? texte : `${texte} = ${formaterEuros(totalPreneur)}`;
}
