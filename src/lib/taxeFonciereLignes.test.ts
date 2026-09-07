import { describe, it, expect } from "vitest";
import {
  calculerToutesLesLignes,
  LIGNES_INITIALES,
} from "./taxeFonciereLignes";

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
