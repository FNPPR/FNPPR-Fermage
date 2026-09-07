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
  totalImputePreneur,
  totalMontant,
  type Assiette,
  type ModeAssiette,
  type MethodeTaxe,
  type ResultatTaxe,
} from "./taxeFonciere";
import { parseNombre } from "./format";

export interface LigneUI {
  id: string;
  libelle: string;
  methode: MethodeTaxe;
  /** Le mode de calcul de l'assiette initialement proposé pour cette ligne. */
  modeAssiette: ModeAssiette;
  /** L'assiette « revenu cadastral » de cette taxe bénéficie-t-elle du
   * dégrèvement de 30 % ? (oui pour TFNB et GEMAPI, non pour la chambre
   * d'agriculture). */
  assietteDegrevee: boolean;
  note?: string;
  aideMontantAppele: string;
  aidePartExploitee: string;
  aideTauxImposition: string;
  // Champs de saisie (tous en texte, convertis à l'usage)
  montantAppele: string;
  partExploitant: string; // %
  revenuCadastral: string;
  tauxImposition: string; // %
  tauxHectare: string;
  surfaceLouee: string;
  tauxBail: string; // %
  fraisDeRole: string; // %
}

export const LIBELLES_MODE: Record<ModeAssiette, string> = {
  montantGlobal: "Montant global de l'avis + % de surface",
  revenuCadastral: "Revenu cadastral propre à l'exploitant",
  hectare: "Taux à l'hectare × surface louée",
};

export const LIGNES_INITIALES: LigneUI[] = [
  {
    id: "commune",
    libelle: "TFNB – part communale",
    methode: "tfnb",
    modeAssiette: "montantGlobal",
    assietteDegrevee: true,
    aideMontantAppele:
      "Imposition de la Commune : revenu cadastral dégrevé (−30 %) × taux communal (bas de colonne « Commune / Propriétés non bâties »)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée au taux communal",
    aideTauxImposition: "Taux communal (bas de colonne « Commune »)",
    montantAppele: "200",
    partExploitant: "100",
    revenuCadastral: "",
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
    modeAssiette: "montantGlobal",
    assietteDegrevee: true,
    aideMontantAppele:
      "Imposition de l'Intercommunalité : revenu cadastral dégrevé (−30 %) × taux intercommunal (bas de colonne « Intercommunalité / Propriétés non bâties »)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée au taux intercommunal",
    aideTauxImposition: "Taux intercommunal (bas de colonne « Intercommunalité »)",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
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
    modeAssiette: "montantGlobal",
    assietteDegrevee: false,
    note:
      "Le taux de 50 % ne résulte pas d'une clause du bail : c'est une disposition d'ordre public du Code général des impôts (art. 1509), non négociable entre les parties.",
    aideMontantAppele:
      "Imposition de la Chambre d'agriculture : revenu cadastral NON dégrevé × taux de chambre d'agriculture (bas de colonne « Chambre d'agriculture / Propriétés non bâties »)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée au taux de chambre d'agriculture",
    aideTauxImposition:
      "Taux de chambre d'agriculture (bas de colonne « Chambre d'agriculture »)",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "50",
    fraisDeRole: "8",
  },
  {
    id: "gemapi",
    libelle: "Taxe GEMAPI",
    methode: "tfnb",
    modeAssiette: "montantGlobal",
    assietteDegrevee: true,
    note:
      "Taxe additionnelle à la TFNB, assise sur la même base et bénéficiant du même dégrèvement de 30 % : sa répartition suit donc la même formule de reconstruction que la TFNB (et non la formule « simple » des autres taxes annexes). Vérifiez d'abord que le bail comporte bien une clause de remboursement de la taxe GEMAPI avant d'en imputer une part au preneur.",
    aideMontantAppele:
      "Imposition Taxe GEMAPI : revenu cadastral dégrevé (−30 %) × taux Taxe GEMAPI (bas de colonne « Taxe GEMAPI / Propriétés non bâties »)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée à la taxe GEMAPI",
    aideTauxImposition: "Taux Taxe GEMAPI (bas de colonne « Taxe GEMAPI »)",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
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
    assietteDegrevee: false,
    note:
      "Frais de rôle à vérifier : ils ne s'appliquent pas systématiquement à cette taxe — reportez-vous à l'avis et au protocole départemental de partage.",
    aideMontantAppele:
      "Imposition Taxe de remembrement : taux à l'hectare × surface louée, suivant le partage contractuellement défini (protocole départemental)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée à la taxe de remembrement",
    aideTauxImposition: "Taux à l'hectare fixé par le protocole départemental",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "0",
    surfaceLouee: "0",
    tauxBail: "0",
    fraisDeRole: "0",
  },
  {
    id: "syndicales",
    libelle: "Taxes syndicales / de marais",
    methode: "simple",
    modeAssiette: "hectare",
    assietteDegrevee: false,
    note:
      "Perçue par une association syndicale de propriétaires (marais, drainage, irrigation…) : le remboursement par le preneur dépend d'une clause expresse du bail, à vérifier au cas par cas.",
    aideMontantAppele:
      "Imposition de l'association syndicale (marais, drainage…) : taux ou cotisation à l'hectare × surface louée",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée par l'association syndicale",
    aideTauxImposition: "Taux ou cotisation à l'hectare de l'association syndicale",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "0",
    surfaceLouee: "0",
    tauxBail: "0",
    fraisDeRole: "0",
  },
];

/** Construit l'assiette à calculer à partir des champs saisis pour une ligne. */
export function assietteDeLaLigne(l: LigneUI): Assiette {
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
        revenuCadastral: parseNombre(l.revenuCadastral),
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

export type CalculTaxe =
  | { erreur: string }
  | {
      resultats: { ligne: LigneUI; res: ResultatTaxe }[];
      totalPreneur: number;
      totalGeneral: number;
    };

/**
 * Calcule la répartition preneur/bailleur de l'ensemble des lignes de taxes,
 * à partir des paramètres réglementaires saisis (dégrèvement, coefficient).
 */
export function calculerToutesLesLignes(
  lignes: LigneUI[],
  tauxDegrevementPct: string,
  coefficientStr: string,
): CalculTaxe {
  const params = {
    tauxDegrevement: parseNombre(tauxDegrevementPct) / 100,
    coefficientCorrecteur: parseNombre(coefficientStr),
  };
  if (
    !Number.isFinite(params.tauxDegrevement) ||
    !Number.isFinite(params.coefficientCorrecteur)
  ) {
    return { erreur: "Paramètres réglementaires invalides." };
  }
  try {
    const resultats = lignes.map((l) => {
      const res = calculerLigneTaxe(
        assietteDeLaLigne(l),
        {
          tauxBail: parseNombre(l.tauxBail) / 100,
          fraisDeRole: parseNombre(l.fraisDeRole) / 100,
        },
        l.methode,
        params,
      );
      return { ligne: l, res };
    });
    return {
      resultats,
      totalPreneur: totalImputePreneur(resultats.map((r) => r.res)),
      totalGeneral: totalMontant(resultats.map((r) => r.res)),
    };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
  }
}
