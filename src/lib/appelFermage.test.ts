import { describe, it, expect } from "vitest";
import { calculerAppelFermage } from "./appelFermage";

describe("calculerAppelFermage", () => {
  it("reproduit l'exemple d'appel de fermage du 2ème semestre", () => {
    // Fermage 25 1722,25 * 123,06/122,55 = 1729,42 €
    // Déduction acompte 1er Sm 25 = 861,13 €  →  Total fermage = 868,29 €
    // Pnb. Aubin rc 25 940 = 23,65 € ; Fgfdl = 5,63 €  →  Total charges = 29,28 €
    // Total de l'échéance = 897,57 €
    const r = calculerAppelFermage({
      loyerInitial: 1722.25,
      anneeDepart: 2024,
      anneeArrivee: 2025,
      acompte: 861.13,
      charges: [
        { id: "pnb", libelle: "Pnb. Aubin rc 25 940", montant: 23.65 },
        { id: "fgfdl", libelle: "Fgfdl", montant: 5.63 },
      ],
    });

    expect(r.revalorisation.loyer).toBeCloseTo(1729.42, 2);
    expect(r.totalFermage).toBeCloseTo(868.29, 2);
    expect(r.totalCharges).toBeCloseTo(29.28, 2);
    expect(r.totalEcheance).toBeCloseTo(897.57, 2);
  });

  it("fonctionne sans acompte ni charges (appel annuel simple)", () => {
    const r = calculerAppelFermage({
      loyerInitial: 1000,
      anneeDepart: 2025,
      anneeArrivee: 2026,
      acompte: 0,
      charges: [],
    });
    expect(r.totalFermage).toBe(r.revalorisation.loyer);
    expect(r.totalCharges).toBe(0);
    expect(r.totalEcheance).toBe(r.revalorisation.loyer);
  });

  it("rejette un acompte négatif", () => {
    expect(() =>
      calculerAppelFermage({
        loyerInitial: 1000,
        anneeDepart: 2025,
        anneeArrivee: 2026,
        acompte: -1,
        charges: [],
      }),
    ).toThrow();
  });

  it("rejette une ligne de charge au montant non numérique", () => {
    expect(() =>
      calculerAppelFermage({
        loyerInitial: 1000,
        anneeDepart: 2025,
        anneeArrivee: 2026,
        acompte: 0,
        charges: [{ id: "x", libelle: "Ligne", montant: NaN }],
      }),
    ).toThrow();
  });

  it("propage une erreur si l'année n'a pas d'indice connu", () => {
    expect(() =>
      calculerAppelFermage({
        loyerInitial: 1000,
        anneeDepart: 1900,
        anneeArrivee: 2026,
        acompte: 0,
        charges: [],
      }),
    ).toThrow();
  });
});
