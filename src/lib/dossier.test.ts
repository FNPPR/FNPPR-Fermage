import { describe, it, expect } from "vitest";
import {
  FORMAT_DOSSIER,
  exporterDossier,
  lireDossier,
  nomFichierDossier,
  nouveauDossier,
} from "./dossier";
import { dossierExemple } from "./exempleDossier";
import { ANNEE_MAX } from "../data/indices";

describe("enregistrement et lecture d'un dossier", () => {
  it("un dossier enregistré puis rouvert est identique", () => {
    const d = dossierExemple();
    expect(lireDossier(JSON.parse(exporterDossier(d)))).toEqual(d);
  });

  it("refuse un fichier qui n'est pas un dossier du calculateur", () => {
    expect(() => lireDossier({ nom: "autre chose" })).toThrow(/n'est pas un dossier/);
    expect(() => lireDossier(null)).toThrow();
    expect(() => lireDossier([1, 2])).toThrow();
  });

  it("complète les champs manquants et ignore les valeurs inattendues", () => {
    const d = lireDossier({
      format: FORMAT_DOSSIER,
      annee: 1990,
      bailleur: { nom: "X", prenom: 42, inconnu: "?" },
      communes: [{ id: "c1", tauxCommunal: 40 }],
      exploitants: [{ id: "e1" }],
      baux: [{ id: "b1", exploitantId: "e1", communeId: "c1", surface: "3,5" }],
    });
    expect(d.annee).toBe(ANNEE_MAX);
    expect(d.bailleur.nom).toBe("X");
    expect(d.bailleur.prenom).toBe("42");
    expect(d.bailleur).not.toHaveProperty("inconnu");
    expect(d.communes[0].tauxCommunal).toBe("40");
    expect(d.communes[0].fraisRoleTaxesFoncieres).toBe("3");
    expect(d.communes[0].fraisRoleChambre).toBe("8");
    expect(d.baux[0].surface).toBe("3,5");
    expect(d.baux[0].tauxBail).toBe("20");
    expect(d.tauxDegrevement).toBe("30");
  });

  it("retire les baux dont la commune ou l'exploitant n'existe plus", () => {
    const d = lireDossier({
      format: FORMAT_DOSSIER,
      communes: [{ id: "c1" }],
      exploitants: [{ id: "e1" }],
      baux: [
        { id: "ok", exploitantId: "e1", communeId: "c1" },
        { id: "sans-commune", exploitantId: "e1", communeId: "c9" },
        { id: "sans-exploitant", exploitantId: "e9", communeId: "c1" },
      ],
    });
    expect(d.baux.map((b) => b.id)).toEqual(["ok"]);
  });

  it("nouveau dossier : année la plus récente, échéance au 1er novembre, 30 % et 0,8 %", () => {
    const d = nouveauDossier();
    expect(d.annee).toBe(ANNEE_MAX);
    expect(d.echeance).toBe(`${ANNEE_MAX}-11-01`);
    expect(d.tauxDegrevement).toBe("30");
    expect(d.revalorisationRevenuCadastral).toBe("0,8");
  });

  it("nom de fichier lisible, sans accents ni espaces", () => {
    expect(nomFichierDossier(dossierExemple())).toBe("dossier-fermages-proprietaire-exemple-2026.json");
    expect(nomFichierDossier(nouveauDossier(2026))).toBe("dossier-fermages-proprietaire-2026.json");
  });
});
