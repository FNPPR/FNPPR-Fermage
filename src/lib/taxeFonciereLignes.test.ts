import { describe, it, expect } from "vitest";
import {
  additionTotalPreneur,
  calculerToutesLesLignes,
  calculerUneLigne,
  lireParametresTaxes,
  LIGNES_INITIALES,
  tauxBailEffectif,
  type LigneUI,
} from "./taxeFonciereLignes";
import { calculerLigneTaxe } from "./taxeFonciere";
import { revaloriserFermage } from "./fermage";

const espaces = (s: string) => s.replace(/[  ]/g, " ");

/** Lignes initiales complétées des taux votés d'une commune. */
function lignesAvecTaux(
  taux: { commune: string; interco: string; chambre: string; gemapi: string },
  tauxBail: string,
  tauxBailGemapi: string,
): LigneUI[] {
  return LIGNES_INITIALES.map((l) => {
    switch (l.id) {
      case "commune":
        return { ...l, tauxImposition: taux.commune, tauxBail };
      case "interco":
        return { ...l, tauxImposition: taux.interco, tauxBail };
      case "chambre":
        return { ...l, tauxImposition: taux.chambre };
      case "gemapi":
        return { ...l, tauxImposition: taux.gemapi, tauxBail: tauxBailGemapi };
      default:
        return l;
    }
  });
}

describe("calculerToutesLesLignes", () => {
  it("calcule toutes les lignes initiales sans erreur (saisie vide = 0)", () => {
    const r = calculerToutesLesLignes({
      lignes: LIGNES_INITIALES,
      tauxDegrevement: "30",
      revenuCadastral: "",
    });
    expect("erreur" in r).toBe(false);
    if (!("erreur" in r)) {
      expect(r.resultats).toHaveLength(LIGNES_INITIALES.length);
      expect(r.totalPreneur).toBe(0);
    }
  });

  it("rejette un taux de dégrèvement non numérique ou hors bornes", () => {
    for (const t of ["abc", "100", "-5"]) {
      const r = calculerToutesLesLignes({
        lignes: LIGNES_INITIALES,
        tauxDegrevement: t,
        revenuCadastral: "1000",
      });
      expect("erreur" in r).toBe(true);
    }
  });

  it("rejette un revenu cadastral non numérique", () => {
    const r = calculerToutesLesLignes({
      lignes: LIGNES_INITIALES,
      tauxDegrevement: "30",
      revenuCadastral: "mille",
    });
    expect("erreur" in r && r.erreur).toMatch(/Revenu cadastral/);
  });

  it("indique la ligne concernée par une erreur de saisie", () => {
    const lignes = LIGNES_INITIALES.map((l) =>
      l.id === "commune"
        ? { ...l, modeAssiette: "montantGlobal" as const, montantAppele: "-1" }
        : l,
    );
    const r = calculerToutesLesLignes({ lignes, tauxDegrevement: "30", revenuCadastral: "" });
    expect("erreur" in r && r.erreur).toMatch(/^TFNB – part communale — /);
  });

  it("une erreur de saisie reste propre à sa ligne (les autres lignes se calculent)", () => {
    const lignes = LIGNES_INITIALES.map((l) =>
      l.id === "commune" ? { ...l, tauxBail: "150" } : l,
    );
    const parametres = lireParametresTaxes({ lignes, tauxDegrevement: "30", revenuCadastral: "1000" });
    if ("erreur" in parametres) throw new Error(parametres.erreur);
    const commune = calculerUneLigne(lignes[0], parametres.params, parametres.revenuCadastral);
    const interco = calculerUneLigne(lignes[1], parametres.params, parametres.revenuCadastral);
    expect("erreur" in commune && commune.erreur).toMatch(/taux du bail/);
    expect("erreur" in interco).toBe(false);
  });

  it("le total est la somme des montants arrondis des lignes", () => {
    const r = calculerToutesLesLignes({
      lignes: lignesAvecTaux(
        { commune: "43,89", interco: "3,25", chambre: "15,01", gemapi: "2,38" },
        "20",
        "20",
      ),
      tauxDegrevement: "30",
      revenuCadastral: "947,52",
    });
    if ("erreur" in r) throw new Error(r.erreur);
    const somme = r.resultats.reduce((s, x) => s + x.res.imputePreneur, 0);
    expect(r.totalPreneur).toBe(Math.round(somme * 100) / 100);
    // Somme exacte non arrondie : 35,3860… → la matrice affiche 35,39 € alors
    // que ses lignes affichées totalisent 35,38 € ; le site retient 35,38 €.
    expect(r.totalPreneur).toBe(35.38);
  });
});

describe("lignes par défaut", () => {
  it("TFNB, chambre d'agriculture et GEMAPI sont calculées par revenu cadastral (méthode rigoureuse)", () => {
    for (const id of ["commune", "interco", "chambre", "gemapi"]) {
      const l = LIGNES_INITIALES.find((x) => x.id === id)!;
      expect(l.modeAssiette).toBe("revenuCadastral");
      expect(l.modesPossibles).toContain("montantGlobal");
      expect(l.modesPossibles).not.toContain("hectare");
    }
  });

  it("remembrement et taxes syndicales sont calculées à l'hectare", () => {
    for (const id of ["remembrement", "syndicales"]) {
      const l = LIGNES_INITIALES.find((x) => x.id === id)!;
      expect(l.modeAssiette).toBe("hectare");
      expect(l.modesPossibles).not.toContain("revenuCadastral");
    }
  });

  it("chambre d'agriculture : la part légale de 50 % prime sur toute saisie", () => {
    const chambre = LIGNES_INITIALES.find((l) => l.id === "chambre")!;
    expect(tauxBailEffectif({ ...chambre, tauxBail: "10" })).toBe("50");
    expect(chambre.note).toMatch(/art\. 1604 du Code général des impôts/);
    expect(chambre.note).toMatch(/L514-1/);
  });
});

describe("Taxe GEMAPI — réforme 2025 : formule « simple » sur assiette dégrevée", () => {
  it("la ligne GEMAPI par défaut suit la méthode « simple », pas « tfnb »", () => {
    const gemapi = LIGNES_INITIALES.find((l) => l.id === "gemapi");
    expect(gemapi?.methode).toBe("simple");
    expect(gemapi?.assietteDegrevee).toBe(true);
  });

  it("imputé au preneur = revenu cadastral × 70 % × taux voté × taux du bail × (1 + frais de rôle)", () => {
    // Revenu cadastral 1000, taux voté 10 % → assiette = 1000 × 0,70 × 0,10 = 70
    // Imputé = 70 × 0,40 × 1,03 = 28,84
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
    expect(r.imputePreneur).toBe(28.84);
  });
});

describe("additionTotalPreneur", () => {
  it("écrit l'addition des lignes non nulles, signes compris", () => {
    const r = calculerToutesLesLignes({
      lignes: lignesAvecTaux(
        { commune: "43,89", interco: "3,25", chambre: "15,01", gemapi: "2,38" },
        "20",
        "20",
      ),
      tauxDegrevement: "30",
      revenuCadastral: "947,52",
    });
    if ("erreur" in r) throw new Error(r.erreur);
    expect(espaces(additionTotalPreneur(r.resultats, r.totalPreneur))).toBe(
      "−41,59 € − 3,08 € + 76,80 € + 3,25 € = 35,38 €",
    );
  });
});

/**
 * Exemple de référence : matrice FNPPR « calcul par revenu cadastral » 2026
 * (deux communes, trois preneurs ; noms et adresses retirés). Les montants
 * attendus ont été recalculés indépendamment en arithmétique décimale exacte
 * selon la méthode rigoureuse de la matrice. Ils diffèrent de ceux affichés
 * par la matrice d'origine pour le preneur 3 (bail à 50 %), dont la TFNB y
 * était divisée par 100 par erreur (1,68 € au lieu de 168,24 €, etc.).
 */
describe("exemple de référence — matrice FNPPR 2026 (données anonymisées)", () => {
  const COEFFICIENT_BASES_2026 = 1.008;
  const communes = [
    {
      nom: "commune 1",
      taux: { commune: "43,89", interco: "3,25", chambre: "15,01", gemapi: "2,38" },
      preneurs: [
        { rcAnneePrecedente: 940, tauxBail: "20", tauxBailGemapi: "20", attendus: [-41.59, -3.08, 76.8, 3.25], total: 35.38 },
        { rcAnneePrecedente: 1640, tauxBail: "30", tauxBailGemapi: "0", attendus: [0, 0, 133.99, 0], total: 133.99 },
        { rcAnneePrecedente: 1846, tauxBail: "50", tauxBailGemapi: "30", attendus: [168.24, 12.46, 150.82, 9.58], total: 341.1 },
      ],
    },
    {
      nom: "commune 2",
      taux: { commune: "42,89", interco: "3,25", chambre: "15,1", gemapi: "2,38" },
      preneurs: [
        { rcAnneePrecedente: 325, tauxBail: "20", tauxBailGemapi: "20", attendus: [-14.05, -1.06, 26.71, 1.12], total: 12.72 },
        { rcAnneePrecedente: 6103, tauxBail: "30", tauxBailGemapi: "0", attendus: [0, 0, 501.62, 0], total: 501.62 },
        { rcAnneePrecedente: 1259, tauxBail: "50", tauxBailGemapi: "30", attendus: [112.13, 8.5, 103.48, 6.53], total: 230.64 },
      ],
    },
  ];

  for (const c of communes) {
    c.preneurs.forEach((p, i) => {
      it(`${c.nom}, preneur ${i + 1} (bail à ${p.tauxBail} %)`, () => {
        // Revenu cadastral actualisé, non arrondi (comme la matrice) : RC × 1,008.
        const rc = String(p.rcAnneePrecedente * COEFFICIENT_BASES_2026).replace(".", ",");
        const r = calculerToutesLesLignes({
          lignes: lignesAvecTaux(c.taux, p.tauxBail, p.tauxBailGemapi),
          tauxDegrevement: "30",
          revenuCadastral: rc,
        });
        if ("erreur" in r) throw new Error(r.erreur);
        const parId = Object.fromEntries(r.resultats.map((x) => [x.ligne.id, x.res.imputePreneur]));
        expect([parId.commune, parId.interco, parId.chambre, parId.gemapi]).toEqual(p.attendus);
        expect(r.totalPreneur).toBe(p.total);
      });
    });
  }

  it("réévaluation des six fermages 2025 → 2026 (indices 123,06 → 127,04)", () => {
    const fermages = [1729.42, 3325, 3762, 732.45, 1350, 2808];
    const attendus = [1785.35, 3432.54, 3883.67, 756.14, 1393.66, 2898.82];
    expect(fermages.map((f) => revaloriserFermage(f, 2025, 2026).loyer)).toEqual(attendus);
  });
});
