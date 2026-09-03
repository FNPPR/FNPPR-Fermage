import { describe, it, expect } from "vitest";
import {
  calculerAssiette,
  calculerLigneTaxe,
  totalImputePreneur,
  revaloriserRevenuCadastral,
  PARAMS_DEGREVEMENT_2025,
  type Assiette,
} from "./taxeFonciere";

const assietteGlobale = (montantAppele: number, partExploitant: number): Assiette => ({
  mode: "montantGlobal",
  montantAppele,
  partExploitant,
});

const pleinePart = assietteGlobale(200, 1);

describe("calculerAssiette — mode montantGlobal", () => {
  it("applique la part exploitée au montant appelé", () => {
    expect(calculerAssiette(assietteGlobale(400, 0.5))).toBe(200);
  });

  it("rejette un montant négatif", () => {
    expect(() => calculerAssiette(assietteGlobale(-1, 1))).toThrow();
  });
});

describe("calculerAssiette — mode revenuCadastral", () => {
  it("applique le dégrèvement de 30 % avant le taux quand assietteDegrevee est vrai (TFNB, GEMAPI)", () => {
    // 1000 × (1 − 0,30) × 0,20 = 140
    const montant = calculerAssiette({
      mode: "revenuCadastral",
      revenuCadastral: 1000,
      tauxImposition: 0.2,
      assietteDegrevee: true,
    });
    expect(montant).toBe(140);
  });

  it("n'applique pas le dégrèvement quand assietteDegrevee est faux (chambre d'agriculture)", () => {
    // 1000 × 0,05 = 50
    const montant = calculerAssiette({
      mode: "revenuCadastral",
      revenuCadastral: 1000,
      tauxImposition: 0.05,
      assietteDegrevee: false,
    });
    expect(montant).toBe(50);
  });

  it("rejette un revenu cadastral négatif", () => {
    expect(() =>
      calculerAssiette({
        mode: "revenuCadastral",
        revenuCadastral: -1,
        tauxImposition: 0.1,
        assietteDegrevee: false,
      }),
    ).toThrow();
  });
});

describe("calculerAssiette — mode hectare", () => {
  it("multiplie le taux à l'hectare par la surface louée", () => {
    const montant = calculerAssiette({
      mode: "hectare",
      tauxHectare: 12.5,
      surfaceLouee: 8,
    });
    expect(montant).toBe(100);
  });

  it("rejette une surface négative", () => {
    expect(() =>
      calculerAssiette({ mode: "hectare", tauxHectare: 10, surfaceLouee: -1 }),
    ).toThrow();
  });
});

describe("calculerLigneTaxe — méthode tfnb (réforme 2025)", () => {
  it("taux du bail < dégrèvement → réduction de fermage (négatif), sans frais de rôle", () => {
    // Exemple du fichier : 200 € à 20 % → 200 × (0,20 − 0,30) × 1,43 = -28,60
    const r = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.2, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.imputePreneur).toBeCloseTo(-28.6, 2);
    expect(r.resteBailleur).toBeCloseTo(228.6, 2);
  });

  it("taux du bail > dégrèvement → remboursement preneur, frais de rôle inclus", () => {
    // Exemple du fichier : 200 € à 50 % → 200 × (0,50 − 0,30) × 1,43 × 1,03 = 58,92
    const r = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.5, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.imputePreneur).toBeCloseTo(58.92, 2);
    expect(r.resteBailleur).toBeCloseTo(141.08, 2);
  });

  it("taux du bail = dégrèvement → aucun versement réciproque", () => {
    const r = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.3, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.imputePreneur).toBe(0);
    expect(r.resteBailleur).toBe(200);
  });

  it("applique la part exploitée à l'assiette (mode montantGlobal)", () => {
    const r = calculerLigneTaxe(
      assietteGlobale(400, 0.5),
      { tauxBail: 0.5, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.montantTotal).toBe(200);
    expect(r.imputePreneur).toBeCloseTo(58.92, 2);
  });

  it("fonctionne avec le mode revenuCadastral (plusieurs exploitants)", () => {
    // revenu cadastral propre de l'exploitant : 500 €, taux communal 40 %
    // assiette dégrevée = 500 × 0,70 × 0,40 = 140
    // imputé = 140 × (0,50 − 0,30) × 1,43 × 1,03 = 41,244
    const r = calculerLigneTaxe(
      {
        mode: "revenuCadastral",
        revenuCadastral: 500,
        tauxImposition: 0.4,
        assietteDegrevee: true,
      },
      { tauxBail: 0.5, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.montantTotal).toBe(140);
    expect(r.imputePreneur).toBeCloseTo(41.24, 2);
  });
});

describe("calculerLigneTaxe — méthode simple", () => {
  it("chambre d'agriculture : 50 % + 8 % de frais de rôle", () => {
    const r = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.5, fraisDeRole: 0.08 },
      "simple",
    );
    // 200 × 0,5 × 1,08 = 108
    expect(r.imputePreneur).toBe(108);
    expect(r.resteBailleur).toBe(92);
  });

  it("taux nul → rien imputé au preneur", () => {
    const r = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0, fraisDeRole: 0.03 },
      "simple",
    );
    expect(r.imputePreneur).toBe(0);
    expect(r.resteBailleur).toBe(200);
  });

  it("taxe de remembrement en mode hectare", () => {
    const r = calculerLigneTaxe(
      { mode: "hectare", tauxHectare: 10, surfaceLouee: 8 },
      { tauxBail: 0.5, fraisDeRole: 0 },
      "simple",
    );
    expect(r.montantTotal).toBe(80);
    expect(r.imputePreneur).toBe(40);
  });
});

describe("paramètres et totaux", () => {
  it("utilise les paramètres 2025 par défaut (30 % / 1,43)", () => {
    expect(PARAMS_DEGREVEMENT_2025.tauxDegrevement).toBe(0.3);
    expect(PARAMS_DEGREVEMENT_2025.coefficientCorrecteur).toBe(1.43);
  });

  it("totalImputePreneur additionne les lignes", () => {
    const a = calculerLigneTaxe(pleinePart, { tauxBail: 0.2, fraisDeRole: 0.03 }, "tfnb");
    const b = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.5, fraisDeRole: 0.08 },
      "simple",
    );
    expect(totalImputePreneur([a, b])).toBeCloseTo(-28.6 + 108, 2);
  });

  it("rejette un montant négatif", () => {
    expect(() =>
      calculerLigneTaxe(
        assietteGlobale(-1, 1),
        { tauxBail: 0.5, fraisDeRole: 0.03 },
        "tfnb",
      ),
    ).toThrow();
  });
});

describe("revaloriserRevenuCadastral", () => {
  it("applique la composition sur le nombre d'années demandé", () => {
    // 1000 × 1,02^3 = 1061,208...
    const r = revaloriserRevenuCadastral(1000, 0.02, 3);
    expect(r.revenuCadastral).toBeCloseTo(1061.21, 2);
  });

  it("nombre d'années nul → revenu inchangé", () => {
    const r = revaloriserRevenuCadastral(1000, 0.02, 0);
    expect(r.revenuCadastral).toBe(1000);
  });

  it("rejette un revenu de référence négatif", () => {
    expect(() => revaloriserRevenuCadastral(-1, 0.02, 1)).toThrow();
  });

  it("rejette un nombre d'années négatif", () => {
    expect(() => revaloriserRevenuCadastral(1000, 0.02, -1)).toThrow();
  });
});
