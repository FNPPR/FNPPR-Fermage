import { describe, it, expect } from "vitest";
import {
  arrondir,
  revaloriserFermage,
  historiqueRevalorisation,
  controleBornesPrefectorales,
} from "./fermage";
import { INDICES_FERMAGE } from "../data/indices";

describe("arrondir", () => {
  it("arrondit à 2 décimales par défaut", () => {
    expect(arrondir(1.005)).toBe(1.01);
    expect(arrondir(2.345)).toBe(2.35);
    expect(arrondir(10.004)).toBe(10);
  });

  it("respecte le nombre de décimales demandé", () => {
    expect(arrondir(1.23456, 3)).toBe(1.235);
    expect(arrondir(1.23456, 0)).toBe(1);
  });
});

describe("cohérence des indices officiels", () => {
  it("chaque variation correspond au rapport avec l'année précédente", () => {
    for (let i = 1; i < INDICES_FERMAGE.length; i++) {
      const prec = INDICES_FERMAGE[i - 1];
      const cur = INDICES_FERMAGE[i];
      const variationCalculee = arrondir((cur.valeur / prec.valeur - 1) * 100, 2);
      // tolérance de 0,02 point liée aux arrondis officiels indépendants
      // (l'indice et sa variation sont chacun arrondis au centième)
      expect(Math.abs(variationCalculee - (cur.variation ?? 0))).toBeLessThanOrEqual(
        0.02,
      );
    }
  });
});

describe("revaloriserFermage", () => {
  it("réévalue selon le rapport des indices (2023 -> 2024)", () => {
    // indice 2023 = 116,46 ; indice 2024 = 122,55
    const r = revaloriserFermage(1000, 2023, 2024);
    expect(r.indiceDepart).toBe(116.46);
    expect(r.indiceArrivee).toBe(122.55);
    expect(r.loyer).toBe(arrondir((1000 * 122.55) / 116.46, 2));
    expect(r.loyer).toBeCloseTo(1052.29, 2);
    expect(r.variationPct).toBeCloseTo(5.23, 2);
  });

  it("retourne le même montant pour deux années de même indice", () => {
    const r = revaloriserFermage(2500, 2014, 2014);
    expect(r.loyer).toBe(2500);
    expect(r.variationPct).toBe(0);
  });

  it("gère une baisse de l'indice (2016 -> 2018)", () => {
    const r = revaloriserFermage(800, 2016, 2018);
    expect(r.loyer).toBeLessThan(800);
  });

  it("rejette un loyer négatif", () => {
    expect(() => revaloriserFermage(-1, 2020, 2024)).toThrow();
  });

  it("rejette une année inconnue", () => {
    expect(() => revaloriserFermage(1000, 1990, 2024)).toThrow();
    expect(() => revaloriserFermage(1000, 2020, 2099)).toThrow();
  });
});

describe("historiqueRevalorisation", () => {
  it("produit une ligne par année, bornes incluses", () => {
    const lignes = historiqueRevalorisation(1000, 2020, 2024);
    expect(lignes).toHaveLength(5);
    expect(lignes[0].annee).toBe(2020);
    expect(lignes[4].annee).toBe(2024);
  });

  it("la première ligne a une variation annuelle nulle (null)", () => {
    const lignes = historiqueRevalorisation(1000, 2021, 2024);
    expect(lignes[0].variationAnnuellePct).toBeNull();
    expect(lignes[0].loyer).toBe(1000);
  });

  it("le loyer final correspond à la réévaluation directe", () => {
    const lignes = historiqueRevalorisation(1234.56, 2015, 2025);
    const direct = revaloriserFermage(1234.56, 2015, 2025);
    expect(lignes[lignes.length - 1].loyer).toBe(direct.loyer);
  });

  it("rejette une année d'arrivée antérieure à l'année de départ", () => {
    expect(() => historiqueRevalorisation(1000, 2024, 2020)).toThrow();
  });
});

describe("controleBornesPrefectorales", () => {
  it("détecte un loyer conforme", () => {
    const r = controleBornesPrefectorales(10, 100, 200, 1500);
    expect(r.minTotal).toBe(1000);
    expect(r.maxTotal).toBe(2000);
    expect(r.loyerProposeParHa).toBe(150);
    expect(r.conformite).toBe("conforme");
  });

  it("détecte un loyer inférieur au minimum", () => {
    const r = controleBornesPrefectorales(10, 100, 200, 900);
    expect(r.conformite).toBe("inferieur");
  });

  it("détecte un loyer supérieur au maximum", () => {
    const r = controleBornesPrefectorales(10, 100, 200, 2500);
    expect(r.conformite).toBe("superieur");
  });

  it("considère les bornes comme inclusives", () => {
    expect(controleBornesPrefectorales(10, 100, 200, 1000).conformite).toBe(
      "conforme",
    );
    expect(controleBornesPrefectorales(10, 100, 200, 2000).conformite).toBe(
      "conforme",
    );
  });

  it("rejette une surface nulle ou négative", () => {
    expect(() => controleBornesPrefectorales(0, 100, 200, 1000)).toThrow();
  });

  it("rejette un minimum supérieur au maximum", () => {
    expect(() => controleBornesPrefectorales(10, 300, 200, 1000)).toThrow();
  });
});
