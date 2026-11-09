/**
 * Dossier d'exemple : les chiffres de la matrice FNPPR « calcul par revenu
 * cadastral » 2026 (exemple de novembre 2026 : deux communes, trois
 * exploitants), avec des noms et adresses fictifs.
 *
 * Sert de cas de référence aux tests automatiques et peut être chargé dans
 * l'onglet « Renseignements généraux » pour découvrir le calculateur.
 *
 * Écarts volontaires avec la matrice (erreurs de la matrice) :
 *  - commune A, exploitant C : la part intercommunale (−6,23 €) est vide dans
 *    la matrice et donc absente de son total ;
 *  - commune B, exploitant A : la matrice additionne les montants non arrondis
 *    (27,87 €) alors que ses lignes affichées font 26,47 + 1,41 = 27,88 € ;
 *  - la case « Autre » de la matrice, comptée à la fois en taxe et en
 *    déduction (elle s'y annule), n'est pas reprise.
 */

import {
  FORMAT_DOSSIER,
  VERSION_DOSSIER,
  coordonneesVides,
  type Bail,
  type Dossier,
} from "./dossier";

function bail(
  id: string,
  exploitantId: string,
  communeId: string,
  valeurs: Omit<Bail, "id" | "exploitantId" | "communeId" | "autreTaxe" | "autreDeduction">,
): Bail {
  return { id, exploitantId, communeId, autreTaxe: "", autreDeduction: "", ...valeurs };
}

export function dossierExemple(): Dossier {
  return {
    format: FORMAT_DOSSIER,
    version: VERSION_DOSSIER,
    annee: 2026,
    echeance: "2026-11-01",
    revalorisationRevenuCadastral: "0,8",
    tauxDegrevement: "30",
    bailleur: {
      ...coordonneesVides(),
      civilite: "Madame",
      nom: "PROPRIÉTAIRE",
      prenom: "Exemple",
      adresse: "1 chemin de l'Exemple",
      ville: "Commune A",
    },
    communes: [
      {
        id: "commune-a",
        nom: "COMMUNE A",
        codePostal: "",
        tauxCommunal: "42,89",
        tauxIntercommunal: "3,35",
        tauxChambre: "15,24",
        tauxGemapi: "2,15",
        fraisRoleTaxesFoncieres: "4",
        fraisRoleChambre: "8",
        remembrementParHa: "",
        remembrementPartPreneur: "",
        syndicalesParHa: "",
        syndicalesPartPreneur: "",
      },
      {
        id: "commune-b",
        nom: "COMMUNE B",
        codePostal: "",
        tauxCommunal: "41,78",
        tauxIntercommunal: "3,25",
        tauxChambre: "15,1",
        tauxGemapi: "2,38",
        fraisRoleTaxesFoncieres: "3",
        fraisRoleChambre: "7",
        remembrementParHa: "",
        remembrementPartPreneur: "",
        syndicalesParHa: "",
        syndicalesPartPreneur: "",
      },
    ],
    exploitants: [
      { id: "exploitant-a", coordonnees: { ...coordonneesVides(), civilite: "Madame", nom: "EXPLOITANT A" } },
      { id: "exploitant-b", coordonnees: { ...coordonneesVides(), civilite: "Monsieur", nom: "EXPLOITANT B" } },
      { id: "exploitant-c", coordonnees: { ...coordonneesVides(), civilite: "Messieurs", nom: "EXPLOITANT C" } },
    ],
    baux: [
      bail("bail-aa", "exploitant-a", "commune-a", {
        surface: "15,23", fermagePrecedent: "1729,42", revenuCadastralPrecedent: "719",
        tauxBail: "40", tauxBailGemapi: "20", acompteVerse: "864,71",
        degrevement: "12", secheresse: "50", nombreAcomptes: "1",
      }),
      bail("bail-ba", "exploitant-a", "commune-b", {
        surface: "7,16", fermagePrecedent: "732,45", revenuCadastralPrecedent: "325",
        tauxBail: "30", tauxBailGemapi: "25", acompteVerse: "200",
        degrevement: "35", secheresse: "40", nombreAcomptes: "1",
      }),
      bail("bail-ab", "exploitant-b", "commune-a", {
        surface: "31,894", fermagePrecedent: "3325", revenuCadastralPrecedent: "1640",
        tauxBail: "20", tauxBailGemapi: "4", acompteVerse: "100",
        degrevement: "25", secheresse: "80", nombreAcomptes: "0",
      }),
      bail("bail-bb", "exploitant-b", "commune-b", {
        surface: "12,45", fermagePrecedent: "1350", revenuCadastralPrecedent: "603",
        tauxBail: "20", tauxBailGemapi: "0", acompteVerse: "0",
        degrevement: "17,5", secheresse: "26", nombreAcomptes: "0",
      }),
      bail("bail-ac", "exploitant-c", "commune-a", {
        surface: "37,45", fermagePrecedent: "3762", revenuCadastralPrecedent: "1846",
        tauxBail: "20", tauxBailGemapi: "30", acompteVerse: "200",
        degrevement: "6", secheresse: "60", nombreAcomptes: "1",
      }),
      bail("bail-bc", "exploitant-c", "commune-b", {
        surface: "24,16", fermagePrecedent: "2808", revenuCadastralPrecedent: "1259",
        tauxBail: "40", tauxBailGemapi: "50", acompteVerse: "400",
        degrevement: "6", secheresse: "52", nombreAcomptes: "1",
      }),
    ],
    lieuCourrier: "Commune A",
    dateCourrier: "", // date du jour
  };
}
