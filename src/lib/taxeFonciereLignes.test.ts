import { describe, it, expect } from "vitest";
import {
  calculerToutesLesLignes,
  LIGNES_INITIALES,
  formuleMontantTotal,
} from "./taxeFonciereLignes";
import { calculerLigneTaxe } from "./taxeFonciere";

describe("calculerToutesLesLignes", () => {
  it("calcule toutes les lignes initiales sans erreur", () => {
    const r = calculerToutesLesLignes(LIGNES_INITIALES, "30", "1.43");
    expect("erreur" in r).toBe(false);
    if (!("erreur" in r)) {
      expect(r.resultats).toHaveLength(LIGNES_INITIALES.length);
      // total = somme des lignes individuelles
      const somme = r.resultats.reduce((s, x) => s + x.res.imputePreneur, 0);
      expect(r.totalPreneur).toBeCloseTo(somme, 2);
    }
  });

  it("rejette des paramètres réglementaires non numériques", () => {
    const r = calculerToutesLesLignes(LIGNES_INITIALES, "abc", "1.43");
    expect("erreur" in r).toBe(true);
  });

  it("répercute une erreur de saisie sur une ligne", () => {
    const lignes = LIGNES_INITIALES.map((l) =>
      l.id === "commune" ? { ...l, montantAppele: "-1" } : l,
    );
    const r = calculerToutesLesLignes(lignes, "30", "1.43");
    expect("erreur" in r).toBe(true);
  });
});

describe("Taxe GEMAPI — réforme 2025 : formule « simple » sur assiette dégrevée", () => {
  it("la ligne GEMAPI par défaut suit la méthode « simple », pas « tfnb »", () => {
    const gemapi = LIGNES_INITIALES.find((l) => l.id === "gemapi");
    expect(gemapi?.methode).toBe("simple");
    expect(gemapi?.assietteDegrevee).toBe(true);
  });

  it("imputé au preneur = revenu cadastral × 70 % × taux du bail × (1 + frais de rôle), sans coefficient correcteur", () => {
    // Revenu cadastral 1000, taux voté 10 % → assiette = 1000 × 0,70 × 0,10 = 70
    // Imputé = 70 × 0,40 × 1,03 = 28,84 (formule « simple », pas de
    // soustraction du taux de dégrèvement ni de coefficient correcteur).
    const r = calculerLigneTaxe(
      {
        mode: "revenuCadastral",
        revenuCadastral: 1000,
        tauxImposition: 0.1,
        assietteDegrevee: true,
      },
      { tauxBail: 0.4, fraisDeRole: 0.03 },
      "simple",
    );
    expect(r.montantTotal).toBe(70);
    expect(r.imputePreneur).toBeCloseTo(28.84, 2);
  });
});

describe("formuleMontantTotal", () => {
  it("décrit le mode montantGlobal", () => {
    const ligne = LIGNES_INITIALES.find((l) => l.id === "commune")!;
    expect(formuleMontantTotal(ligne)).toMatch(/Montant appelé × Part exploitée/);
  });

  it("décrit le mode revenuCadastral dégrevé (GEMAPI)", () => {
    const ligne = {
      ...LIGNES_INITIALES.find((l) => l.id === "gemapi")!,
      modeAssiette: "revenuCadastral" as const,
    };
    expect(formuleMontantTotal(ligne)).toMatch(/1 − Taux de dégrèvement/);
  });

  it("décrit le mode revenuCadastral non dégrevé (chambre d'agriculture)", () => {
    const ligne = {
      ...LIGNES_INITIALES.find((l) => l.id === "chambre")!,
      modeAssiette: "revenuCadastral" as const,
    };
    expect(formuleMontantTotal(ligne)).toMatch(/non dégrevé/);
  });
});
