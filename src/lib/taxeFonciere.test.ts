import { describe, it, expect } from "vitest";
import {
  calculerAssiette,
  calculerLigneTaxe,
  coefficientCorrecteur,
  detaillerLigneTaxe,
  totalImputePreneur,
  revaloriserRevenuCadastral,
  PARAMS_DEGREVEMENT_2025,
  PARAMS_DEGREVEMENT_AVANT_2025,
  type Assiette,
  type MethodeTaxe,
} from "./taxeFonciere";
import { arrondir } from "./fermage";

const assietteGlobale = (montantAppele: number, partExploitant: number): Assiette => ({
  mode: "montantGlobal",
  montantAppele,
  partExploitant,
});

const pleinePart = assietteGlobale(200, 1);

/** Normalise les espaces (insécables, fines) pour comparer des textes formatés. */
const espaces = (s: string) => s.replace(/[  ]/g, " ");

/**
 * Refait « à la calculatrice » le calcul écrit dans le détail : remplace les
 * symboles (×, ÷, −, %, €) et évalue l'expression.
 */
function evaluer(expression: string): number {
  const js = expression
    .replace(/[\s  ]/g, "")
    .replace(/€\/ha|€|ha/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/%/g, "/100")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  return Function(`"use strict"; return (${js});`)() as number;
}

describe("calculerAssiette — mode montantGlobal", () => {
  it("applique la part exploitée au montant appelé", () => {
    expect(calculerAssiette(assietteGlobale(400, 0.5))).toBe(200);
  });

  it("rejette un montant négatif", () => {
    expect(() => calculerAssiette(assietteGlobale(-1, 1))).toThrow();
  });

  it("rejette une part exploitée supérieure à 100 %", () => {
    expect(() => calculerAssiette(assietteGlobale(100, 1.2))).toThrow(/part exploitée/);
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

  it("accepte un taux voté supérieur à 100 % (cas de certaines communes rurales)", () => {
    const montant = calculerAssiette({
      mode: "revenuCadastral",
      revenuCadastral: 100,
      tauxImposition: 1.2,
      assietteDegrevee: false,
    });
    expect(montant).toBe(120);
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
    // 200 € à 20 % → 200 ÷ 0,70 × (0,20 − 0,30) = −28,571… → −28,57
    // (−28,60 avec le coefficient arrondi 1,43 des tableaux papier)
    const r = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.2, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.imputePreneur).toBe(-28.57);
    expect(r.resteBailleur).toBe(228.57);
  });

  it("taux du bail > dégrèvement → remboursement preneur, frais de rôle inclus", () => {
    // 200 € à 50 % → 200 ÷ 0,70 × (0,50 − 0,30) × 1,03 = 58,857… → 58,86
    const r = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.5, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.imputePreneur).toBe(58.86);
    expect(r.resteBailleur).toBe(141.14);
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
    expect(r.imputePreneur).toBe(58.86);
  });

  it("mode revenu cadastral : calcul direct, sans coefficient correcteur (méthode rigoureuse)", () => {
    // revenu cadastral 500 €, taux communal 40 %
    // montant total = 500 × 0,70 × 0,40 = 140
    // imputé = 500 × 0,40 × (0,50 − 0,30) × 1,03 = 41,20 (exactement)
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
    expect(r.imputePreneur).toBe(41.2);
  });

  it("mode revenu cadastral : identique à la matrice FNPPR (−41,59 €, et non −41,63 € avec 1,43)", () => {
    const r = calculerLigneTaxe(
      {
        mode: "revenuCadastral",
        revenuCadastral: 947.52,
        tauxImposition: 0.4389,
        assietteDegrevee: true,
      },
      { tauxBail: 0.2, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.imputePreneur).toBe(-41.59);
  });

  it("les deux méthodes concordent quand le montant appelé correspond au revenu cadastral", () => {
    const rc = 1234;
    const taux = 0.5123;
    const parRevenu = calculerLigneTaxe(
      { mode: "revenuCadastral", revenuCadastral: rc, tauxImposition: taux, assietteDegrevee: true },
      { tauxBail: 0.45, fraisDeRole: 0.03 },
      "tfnb",
    );
    const parMontant = calculerLigneTaxe(
      assietteGlobale(rc * 0.7 * taux, 1),
      { tauxBail: 0.45, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(parMontant.imputePreneur).toBe(parRevenu.imputePreneur);
  });

  it("taux du bail = dégrèvement, quel que soit le montant total → résultat rigoureusement nul (pas -0)", () => {
    const r = calculerLigneTaxe(
      assietteGlobale(1234.56, 1),
      { tauxBail: 0.3, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(r.imputePreneur).toBe(0);
    expect(Object.is(r.imputePreneur, -0)).toBe(false);
  });

  it("suit le taux de dégrèvement saisi (20 % avant 2025 : coefficient 1,25)", () => {
    // 200 ÷ 0,80 × (0,50 − 0,20) × 1,03 = 77,25
    const r = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.5, fraisDeRole: 0.03 },
      "tfnb",
      PARAMS_DEGREVEMENT_AVANT_2025,
    );
    expect(r.imputePreneur).toBe(77.25);
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

describe("contrôle des saisies de répartition", () => {
  it("rejette un taux du bail supérieur à 100 %", () => {
    expect(() =>
      calculerLigneTaxe(pleinePart, { tauxBail: 1.5, fraisDeRole: 0 }, "simple"),
    ).toThrow(/taux du bail/);
  });

  it("rejette des frais de rôle négatifs", () => {
    expect(() =>
      calculerLigneTaxe(pleinePart, { tauxBail: 0.5, fraisDeRole: -0.03 }, "simple"),
    ).toThrow(/frais de rôle/);
  });

  it("rejette une valeur non numérique", () => {
    expect(() =>
      calculerLigneTaxe(pleinePart, { tauxBail: Number.NaN, fraisDeRole: 0 }, "simple"),
    ).toThrow(/n'est pas un nombre/);
  });

  it("rejette un taux de dégrèvement de 100 % ou plus", () => {
    expect(() =>
      calculerLigneTaxe(pleinePart, { tauxBail: 0.5, fraisDeRole: 0 }, "tfnb", {
        tauxDegrevement: 1,
      }),
    ).toThrow(/dégrèvement/);
  });
});

describe("paramètres et totaux", () => {
  it("dégrèvement 2025 : 30 % ; coefficient correcteur exact 1 ÷ 0,70", () => {
    expect(PARAMS_DEGREVEMENT_2025.tauxDegrevement).toBe(0.3);
    expect(coefficientCorrecteur(0.3)).toBeCloseTo(1.428571, 6);
    expect(coefficientCorrecteur(0.2)).toBe(1.25);
  });

  it("totalImputePreneur additionne les lignes arrondies", () => {
    const a = calculerLigneTaxe(pleinePart, { tauxBail: 0.2, fraisDeRole: 0.03 }, "tfnb");
    const b = calculerLigneTaxe(
      pleinePart,
      { tauxBail: 0.5, fraisDeRole: 0.08 },
      "simple",
    );
    expect(totalImputePreneur([a, b])).toBe(79.43);
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

describe("detaillerLigneTaxe — détail chiffré du calcul", () => {
  it("TFNB en revenu cadastral : formule et valeurs saisies, frais de rôle au-delà du dégrèvement", () => {
    const d = detaillerLigneTaxe(
      {
        mode: "revenuCadastral",
        revenuCadastral: 1860.768,
        tauxImposition: 0.4389,
        assietteDegrevee: true,
      },
      { tauxBail: 0.5, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(d.etapes).toHaveLength(2);
    expect(espaces(d.etapes[0].calcul)).toBe("1 860,768 € × (1 − 30 %) × 43,89 %");
    expect(d.etapes[0].resultat).toBe(571.68);
    expect(d.etapes[1].formule).toBe(
      "Revenu cadastral × Taux voté × (Taux du bail − Dégrèvement) × (1 + Frais de rôle)",
    );
    expect(espaces(d.etapes[1].calcul)).toBe(
      "1 860,768 € × 43,89 % × (50 % − 30 %) × (1 + 3 %)",
    );
    expect(d.etapes[1].resultat).toBe(168.24);
  });

  it("TFNB sous le dégrèvement : pas de frais de rôle, et remarques explicatives", () => {
    const d = detaillerLigneTaxe(
      {
        mode: "revenuCadastral",
        revenuCadastral: 947.52,
        tauxImposition: 0.4389,
        assietteDegrevee: true,
      },
      { tauxBail: 0.2, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(espaces(d.etapes[1].calcul)).toBe("947,52 € × 43,89 % × (20 % − 30 %)");
    expect(d.etapes[1].resultat).toBe(-41.59);
    expect(d.remarques.join(" ")).toMatch(/négatif/);
    expect(d.remarques.join(" ")).toMatch(/Frais de rôle non appliqués/);
  });

  it("TFNB en montant global : la division par (1 − 30 %) est écrite et expliquée", () => {
    const d = detaillerLigneTaxe(
      pleinePart,
      { tauxBail: 0.2, fraisDeRole: 0.03 },
      "tfnb",
    );
    expect(espaces(d.etapes[1].calcul)).toBe("200,00 € × 100 % ÷ (1 − 30 %) × (20 % − 30 %)");
    expect(d.remarques.join(" ")).toMatch(/coefficient correcteur ≈ 1,4286/);
  });

  it("chambre d'agriculture : libellé « Part légale »", () => {
    const d = detaillerLigneTaxe(
      {
        mode: "revenuCadastral",
        revenuCadastral: 947.52,
        tauxImposition: 0.1501,
        assietteDegrevee: false,
      },
      { tauxBail: 0.5, fraisDeRole: 0.08 },
      "simple",
      PARAMS_DEGREVEMENT_2025,
      { libelleTauxBail: "Part légale" },
    );
    expect(d.etapes[1].formule).toBe(
      "Revenu cadastral × Taux voté × Part légale × (1 + Frais de rôle)",
    );
    expect(espaces(d.etapes[1].calcul)).toBe("947,52 € × 15,01 % × 50 % × (1 + 8 %)");
    expect(d.etapes[1].resultat).toBe(76.8);
  });

  it("taxe à l'hectare sans frais de rôle : pas de « × (1 + 0 %) »", () => {
    const d = detaillerLigneTaxe(
      { mode: "hectare", tauxHectare: 12.5, surfaceLouee: 14.2423 },
      { tauxBail: 0.5, fraisDeRole: 0 },
      "simple",
    );
    expect(espaces(d.etapes[1].calcul)).toBe("12,50 €/ha × 14,2423 ha × 50 %");
  });

  it("refait à la calculatrice, chaque calcul affiché redonne exactement le montant retenu (2 000 cas)", () => {
    // Générateur pseudo-aléatoire déterministe (reproductible d'un test à l'autre).
    let graine = 20261027;
    const alea = () => {
      graine = (graine * 1103515245 + 12345) % 2147483648;
      return graine / 2147483648;
    };
    const auCentieme = (max: number) => Math.round(alea() * max * 100) / 100;
    const methodes: MethodeTaxe[] = ["tfnb", "simple"];
    for (let i = 0; i < 2000; i++) {
      const mode = (["revenuCadastral", "montantGlobal", "hectare"] as const)[i % 3];
      const assiette: Assiette =
        mode === "revenuCadastral"
          ? {
              mode,
              revenuCadastral: auCentieme(8000),
              tauxImposition: Math.round(alea() * 9000) / 10000,
              assietteDegrevee: alea() < 0.7,
            }
          : mode === "montantGlobal"
            ? { mode, montantAppele: auCentieme(5000), partExploitant: Math.round(alea() * 100) / 100 }
            : { mode, tauxHectare: auCentieme(60), surfaceLouee: Math.round(alea() * 800000) / 10000 };
      const repartition = {
        tauxBail: [0, 0.2, 0.25, 0.3, 0.33, 0.5, 1][i % 7],
        fraisDeRole: [0, 0.03, 0.08][i % 3],
      };
      const methode = methodes[i % 2];
      const detail = detaillerLigneTaxe(assiette, repartition, methode);
      for (const etape of detail.etapes) {
        expect(arrondir(evaluer(etape.calcul), 2)).toBe(etape.resultat);
      }
    }
  });
});

describe("revaloriserRevenuCadastral", () => {
  it("applique la composition sur le nombre d'années demandé", () => {
    // 1000 × 1,02^3 = 1061,208...
    const r = revaloriserRevenuCadastral(1000, 0.02, 3);
    expect(r.revenuCadastral).toBeCloseTo(1061.21, 2);
  });

  it("une année au coefficient 2026 (0,8 %) : 1846 → 1860,768 (non arrondi, comme la matrice)", () => {
    const r = revaloriserRevenuCadastral(1846, 0.008, 1);
    expect(r.revenuCadastralExact).toBeCloseTo(1860.768, 9);
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
