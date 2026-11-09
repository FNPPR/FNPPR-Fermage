import { describe, it, expect } from "vitest";
import {
  calculerDossier,
  deductionsUtiles,
  taxesUtiles,
  totalTaxe,
  type ResultatBail,
} from "./calculDossier";
import { dossierExemple } from "./exempleDossier";
import { nouveauBail, nouvelExploitant, nouvelleCommune, nouveauDossier } from "./dossier";

/**
 * Exemple de référence : matrice FNPPR « calcul par revenu cadastral » 2026,
 * exemple de novembre (2 communes × 3 exploitants, noms fictifs). Montants
 * attendus recalculés indépendamment, en arithmétique décimale exacte, selon
 * la méthode rigoureuse de la matrice ; chaque ligne est arrondie au centime.
 * Ordre des lignes : part communale, part intercommunale, chambre
 * d'agriculture, GEMAPI.
 */
const ATTENDUS: Record<
  string,
  { fermage: number; lignes: number[]; taxes: number; deductions: number; reste: number; acompte: number }
> = {
  "bail-aa": { fermage: 1785.35, lignes: [32.33, 2.53, 59.64, 2.27], taxes: 96.77, deductions: 926.71, reste: 955.41, acompte: 892.68 },
  "bail-ab": { fermage: 3432.54, lignes: [-70.9, -5.54, 136.05, 1.03], taxes: 60.64, deductions: 205, reste: 3288.18, acompte: 0 },
  "bail-ac": { fermage: 3883.67, lignes: [-79.81, -6.23, 153.13, 8.74], taxes: 75.83, deductions: 266, reste: 3693.5, acompte: 1941.84 },
  "bail-ba": { fermage: 756.14, lignes: [0, 0, 26.47, 1.41], taxes: 27.88, deductions: 275, reste: 509.02, acompte: 378.07 },
  "bail-bb": { fermage: 1393.66, lignes: [-25.39, -1.98, 49.1, 0], taxes: 21.73, deductions: 43.5, reste: 1371.89, acompte: 0 },
  "bail-bc": { fermage: 2898.82, lignes: [54.61, 4.25, 102.52, 10.89], taxes: 172.27, deductions: 458, reste: 2613.09, acompte: 1449.41 },
};

const arrondi = (x: number) => Math.round(x * 100) / 100;

function bailDe(r: ReturnType<typeof calculerDossier>, id: string): ResultatBail {
  const b = r.baux.find((x) => x.bail.id === id);
  if (!b) throw new Error(`bail ${id} absent`);
  return b;
}

describe("exemple de référence — matrice FNPPR 2026 (novembre)", () => {
  const r = calculerDossier(dossierExemple());

  it("calcule les six baux sans erreur ni avertissement", () => {
    expect(r.problemes).toEqual([]);
    expect(r.baux.map((b) => b.bail.id)).toEqual([
      "bail-aa", "bail-ba", "bail-ab", "bail-bb", "bail-ac", "bail-bc",
    ]);
  });

  for (const [id, a] of Object.entries(ATTENDUS)) {
    it(`${id} : fermage, taxes ligne par ligne, déductions, reste dû et acompte`, () => {
      const b = bailDe(r, id);
      expect(b.fermage).toBe(a.fermage);
      expect(b.taxes.slice(0, 4).map((t) => t.impute)).toEqual(a.lignes);
      expect(b.taxes.slice(4).map((t) => t.impute)).toEqual([0, 0, 0]);
      expect(b.totalTaxes).toBe(a.taxes);
      expect(b.totalDeductions).toBe(a.deductions);
      expect(b.resteDu).toBe(a.reste);
      expect(b.montantAcompte).toBe(a.acompte);
    });
  }

  it("totaux par exploitant", () => {
    expect(r.parExploitant.map((g) => [g.totaux.fermage, g.totaux.taxes, g.totaux.resteDu])).toEqual([
      [2541.49, 124.65, 1464.43],
      [4826.2, 82.37, 4660.07],
      [6782.49, 248.1, 6306.59],
    ]);
  });

  it("totaux par commune", () => {
    expect(r.parCommune.map((g) => [g.totaux.fermage, g.totaux.taxes, g.totaux.resteDu])).toEqual([
      [9101.56, 233.24, 7937.09],
      [5048.62, 221.88, 4494],
    ]);
  });

  it("totaux de la propriété", () => {
    expect(r.totaux.fermage).toBe(14150.18);
    expect(r.totaux.taxes).toBe(455.12);
    expect(r.totaux.deductions).toBe(2174.21);
    expect(r.totaux.resteDu).toBe(12431.09);
    expect(r.totaux.surface).toBeCloseTo(128.344, 9);
  });

  it("retrouve la matrice, sauf ses deux erreurs documentées", () => {
    // Reste dû affiché par la matrice (feuilles COMMUNE 1 et 2, ligne 56).
    const matrice: Record<string, number> = {
      "bail-aa": 955.41, "bail-ab": 3288.18, "bail-ac": 3699.73,
      "bail-ba": 509.01, "bail-bb": 1371.89, "bail-bc": 2613.09,
    };
    const ecarts: Record<string, number> = {
      "bail-ac": -6.23, // part intercommunale vide dans la matrice (case K45)
      "bail-ba": 0.01, // la matrice additionne des montants non arrondis
    };
    for (const [id, m] of Object.entries(matrice)) {
      expect(arrondi(bailDe(r, id).resteDu - m)).toBe(ecarts[id] ?? 0);
    }
  });

  it("les frais de rôle des taxes foncières ne s'appliquent qu'aux montants positifs", () => {
    // Commune A, exploitant A : bail à 40 % > 30 % → frais de rôle de 4 % compris.
    expect(bailDe(r, "bail-aa").taxes[0].detail?.etapes[1].calcul).toMatch(/\(1 \+ 4 %\)$/);
    // Commune A, exploitant B : bail à 20 % < 30 % → réduction, sans frais de rôle.
    expect(bailDe(r, "bail-ab").taxes[0].detail?.etapes[1].calcul).not.toMatch(/1 \+/);
  });
});

describe("cohérence interne (chaque appel est la somme de ses lignes)", () => {
  const r = calculerDossier(dossierExemple());

  it("total des taxes = somme des lignes arrondies ; reste dû = fermage + taxes − déductions", () => {
    for (const b of r.baux) {
      expect(b.totalTaxes).toBe(arrondi(b.taxes.reduce((s, t) => s + t.impute, 0)));
      expect(b.totalDeductions).toBe(arrondi(Object.values(b.deductions).reduce((s, v) => s + v, 0)));
      expect(b.resteDu).toBe(arrondi(b.fermage + b.totalTaxes - b.totalDeductions));
    }
  });

  it("totaux = somme des baux, par exploitant comme par commune", () => {
    for (const groupes of [r.parExploitant, r.parCommune]) {
      for (const g of groupes) {
        expect(g.totaux.resteDu).toBe(arrondi(g.baux.reduce((s, b) => s + b.resteDu, 0)));
        expect(g.totaux.taxes).toBe(arrondi(g.baux.reduce((s, b) => s + b.totalTaxes, 0)));
      }
      expect(arrondi(groupes.reduce((s, g) => s + g.totaux.resteDu, 0))).toBe(r.totaux.resteDu);
    }
  });

  it("totalTaxe additionne une même taxe sur plusieurs communes", () => {
    const a = r.parExploitant[0].baux;
    expect(totalTaxe(a, "chambre")).toBe(arrondi(59.64 + 26.47));
  });

  it("taxesUtiles et deductionsUtiles ne retiennent que les lignes non nulles", () => {
    expect(taxesUtiles(r.baux)).toEqual(["communale", "intercommunale", "chambre", "gemapi"]);
    expect(deductionsUtiles(r.baux)).toEqual(["acompte", "degrevement", "secheresse"]);
    expect(taxesUtiles([bailDe(r, "bail-ba")])).toEqual(["chambre", "gemapi"]);
  });
});

/** Petit dossier d'une commune et d'un exploitant, à compléter par test. */
function dossierSimple(modif: (d: ReturnType<typeof nouveauDossier>) => void = () => {}) {
  const d = nouveauDossier(2026);
  const c = nouvelleCommune("c1");
  c.nom = "Ici";
  c.tauxCommunal = "40";
  c.tauxChambre = "10";
  const e = nouvelExploitant("e1");
  e.coordonnees.nom = "PRENEUR";
  const b = nouveauBail("e1", "c1", "b1");
  b.surface = "10";
  b.fermagePrecedent = "1000";
  b.revenuCadastralPrecedent = "500";
  d.communes = [c];
  d.exploitants = [e];
  d.baux = [b];
  modif(d);
  return d;
}

describe("autres taxes, déductions et acomptes", () => {
  it("« autre taxe » s'ajoute, « autre déduction » se retire", () => {
    const base = calculerDossier(dossierSimple()).baux[0];
    const r = calculerDossier(
      dossierSimple((d) => {
        d.baux[0].autreTaxe = "15";
        d.baux[0].autreDeduction = "4,5";
      }),
    ).baux[0];
    expect(r.totalTaxes).toBe(arrondi(base.totalTaxes + 15));
    expect(r.resteDu).toBe(arrondi(base.resteDu + 15 - 4.5));
  });

  it("remembrement et taxes syndicales : €/ha × surface × part du preneur", () => {
    const r = calculerDossier(
      dossierSimple((d) => {
        d.communes[0].remembrementParHa = "3";
        d.communes[0].remembrementPartPreneur = "50";
        d.communes[0].syndicalesParHa = "12,5";
        d.communes[0].syndicalesPartPreneur = "100";
      }),
    ).baux[0];
    expect(r.taxes.find((t) => t.id === "remembrement")?.impute).toBe(15);
    expect(r.taxes.find((t) => t.id === "syndicales")?.impute).toBe(125);
  });

  it("acompte de l'année suivante : fermage ÷ (nombre d'acomptes + 1) ; aucun → 0", () => {
    const deux = calculerDossier(dossierSimple((d) => (d.baux[0].nombreAcomptes = "2"))).baux[0];
    expect(deux.montantAcompte).toBe(arrondi((1000 * 127.04) / 123.06 / 3));
    const aucun = calculerDossier(dossierSimple()).baux[0];
    expect(aucun.montantAcompte).toBe(0);
  });

  it("chambre d'agriculture : 50 % quel que soit le taux du bail", () => {
    const a = calculerDossier(dossierSimple((d) => (d.baux[0].tauxBail = "0"))).baux[0];
    const b = calculerDossier(dossierSimple((d) => (d.baux[0].tauxBail = "100"))).baux[0];
    const chambre = (x: ResultatBail) => x.taxes.find((t) => t.id === "chambre")?.impute;
    // 500 × 1,008 × 10 % × 50 % × 1,08 = 27,216 → 27,22
    expect(chambre(a)).toBe(27.22);
    expect(chambre(b)).toBe(27.22);
  });

  it("fermage et taxes à l'hectare", () => {
    const r = calculerDossier(dossierSimple()).baux[0];
    expect(r.fermageParHa).toBeCloseTo(r.fermage / 10, 9);
    expect(r.fermageEtTaxesParHa).toBeCloseTo((r.fermage + r.totalTaxes) / 10, 9);
    const sansSurface = calculerDossier(dossierSimple((d) => (d.baux[0].surface = ""))).baux[0];
    expect(sansSurface.fermageParHa).toBeNull();
  });
});

describe("erreurs et avertissements de saisie", () => {
  it("une valeur illisible écarte le bail et dit où elle se trouve", () => {
    const r = calculerDossier(dossierSimple((d) => (d.baux[0].surface = "dix")));
    expect(r.baux).toHaveLength(0);
    expect(r.problemes).toContainEqual(
      expect.objectContaining({
        gravite: "erreur",
        ou: "PRENEUR – Ici",
        bailId: "b1",
        message: "Surface louée : « dix » n'est pas un nombre.",
      }),
    );
  });

  it("un taux du bail au-delà de 100 % est refusé", () => {
    const r = calculerDossier(dossierSimple((d) => (d.baux[0].tauxBail = "120")));
    expect(r.baux).toHaveLength(0);
    expect(r.problemes[0].message).toMatch(/entre 0 et 100/);
  });

  it("un nombre d'acomptes doit être entier", () => {
    const r = calculerDossier(dossierSimple((d) => (d.baux[0].nombreAcomptes = "1,5")));
    expect(r.problemes[0].message).toMatch(/entier/);
  });

  it("un taux communal illisible écarte les baux de la commune", () => {
    const r = calculerDossier(dossierSimple((d) => (d.communes[0].tauxCommunal = "4O")));
    expect(r.baux).toHaveLength(0);
    expect(r.problemes[0]).toEqual(
      expect.objectContaining({ gravite: "erreur", ou: "Commune Ici", communeId: "c1" }),
    );
  });

  it("un dégrèvement illisible bloque tout le calcul", () => {
    const r = calculerDossier(dossierSimple((d) => (d.tauxDegrevement = "abc")));
    expect(r.baux).toHaveLength(0);
    expect(r.problemes[0].ou).toBe("Paramètres de l'année");
  });

  it("une année sans indice de l'année précédente est signalée", () => {
    const r = calculerDossier(dossierSimple((d) => (d.annee = 2009)));
    expect(r.baux).toHaveLength(0);
    expect(r.problemes[0].message).toMatch(/Indice des fermages inconnu pour 2008/);
  });

  it("avertit si le revenu cadastral ou le fermage manquent, sans bloquer", () => {
    const r = calculerDossier(
      dossierSimple((d) => {
        d.baux[0].revenuCadastralPrecedent = "";
        d.baux[0].fermagePrecedent = "";
      }),
    );
    expect(r.baux).toHaveLength(1);
    expect(r.problemes.map((p) => p.gravite)).toEqual(["avertissement", "avertissement"]);
  });

  it("avertit d'un exploitant sans terres et d'une commune sans exploitant", () => {
    const r = calculerDossier(
      dossierSimple((d) => {
        d.exploitants.push(nouvelExploitant("e2"));
        d.communes.push(nouvelleCommune("c2"));
      }),
    );
    expect(r.problemes.map((p) => p.ou)).toEqual(["Exploitant 2", "Commune 2"]);
  });
});

/**
 * Second exemple de référence : matrice FNPPR d'octobre 2026 (corrigée le
 * 27 octobre), 2 communes × 3 exploitants, frais de rôle 3 % et 8 %.
 * Montants attendus recalculés en décimal exact (voir la note aux testeurs du
 * 27 octobre 2026) ; ordre : communale, intercommunale, chambre, GEMAPI.
 */
describe("exemple de référence — matrice FNPPR d'octobre 2026", () => {
  const d = nouveauDossier(2026);
  const communes = [
    { id: "c1", taux: ["43,89", "3,25", "15,01", "2,38"] },
    { id: "c2", taux: ["42,89", "3,25", "15,1", "2,38"] },
  ];
  d.communes = communes.map(({ id, taux }) => {
    const c = nouvelleCommune(id);
    [c.tauxCommunal, c.tauxIntercommunal, c.tauxChambre, c.tauxGemapi] = taux;
    return c;
  });
  d.exploitants = ["p1", "p2", "p3"].map((id) => nouvelExploitant(id));
  const baux: [string, string, string, string, string, string][] = [
    // commune, exploitant, fermage 2025, revenu cadastral 2025, taux du bail, taux GEMAPI
    ["c1", "p1", "1729,42", "940", "20", "20"],
    ["c1", "p2", "3325", "1640", "30", "0"],
    ["c1", "p3", "3762", "1846", "50", "30"],
    ["c2", "p1", "732,45", "325", "20", "20"],
    ["c2", "p2", "1350", "6103", "30", "0"],
    ["c2", "p3", "2808", "1259", "50", "30"],
  ];
  d.baux = baux.map(([c, p, f, rc, tb, tg]) => {
    const b = nouveauBail(p, c, `${c}-${p}`);
    b.fermagePrecedent = f;
    b.revenuCadastralPrecedent = rc;
    b.tauxBail = tb;
    b.tauxBailGemapi = tg;
    b.surface = "10";
    return b;
  });
  const r = calculerDossier(d);
  const attendus: Record<string, { lignes: number[]; total: number; fermage: number }> = {
    "c1-p1": { lignes: [-41.59, -3.08, 76.8, 3.25], total: 35.38, fermage: 1785.35 },
    "c1-p2": { lignes: [0, 0, 133.99, 0], total: 133.99, fermage: 3432.54 },
    "c1-p3": { lignes: [168.24, 12.46, 150.82, 9.58], total: 341.1, fermage: 3883.67 },
    "c2-p1": { lignes: [-14.05, -1.06, 26.71, 1.12], total: 12.72, fermage: 756.14 },
    "c2-p2": { lignes: [0, 0, 501.62, 0], total: 501.62, fermage: 1393.66 },
    "c2-p3": { lignes: [112.13, 8.5, 103.48, 6.53], total: 230.64, fermage: 2898.82 },
  };
  for (const [id, a] of Object.entries(attendus)) {
    it(`${id} : taxes ligne par ligne, total et fermage`, () => {
      const b = bailDe(r, id);
      expect(b.taxes.slice(0, 4).map((t) => t.impute)).toEqual(a.lignes);
      expect(b.totalTaxes).toBe(a.total);
      expect(b.fermage).toBe(a.fermage);
    });
  }
});
