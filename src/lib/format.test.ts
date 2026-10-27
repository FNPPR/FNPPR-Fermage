import { describe, it, expect } from "vitest";
import {
  formaterEurosPrecis,
  formaterNombrePrecis,
  formaterTaux,
  parseNombre,
} from "./format";

const espaces = (s: string) => s.replace(/[  ]/g, " ");

describe("parseNombre", () => {
  it("accepte la virgule ou le point décimal", () => {
    expect(parseNombre("947,52")).toBe(947.52);
    expect(parseNombre("947.52")).toBe(947.52);
  });

  it("ignore les espaces de milliers (y compris insécables) et les symboles € et %", () => {
    expect(parseNombre("1 640")).toBe(1640);
    expect(parseNombre("1 785,35 €")).toBe(1785.35);
    expect(parseNombre("43,89 %")).toBe(43.89);
  });

  it("une saisie vide vaut 0", () => {
    expect(parseNombre("")).toBe(0);
    expect(parseNombre("   ")).toBe(0);
  });

  it("une saisie incompréhensible donne NaN (erreur affichée, jamais une autre valeur)", () => {
    expect(parseNombre("mille")).toBeNaN();
    expect(parseNombre("1,234,5")).toBeNaN();
  });
});

describe("formatage sans arrondi (détail des calculs)", () => {
  it("formaterEurosPrecis garde toutes les décimales utiles", () => {
    expect(espaces(formaterEurosPrecis(947.52))).toBe("947,52 €");
    expect(espaces(formaterEurosPrecis(1846 * 1.008))).toBe("1 860,768 €");
    expect(espaces(formaterEurosPrecis(200))).toBe("200,00 €");
  });

  it("formaterTaux écrit une fraction en pourcentage, sans bruit binaire", () => {
    expect(espaces(formaterTaux(0.4389))).toBe("43,89 %");
    expect(espaces(formaterTaux(0.3))).toBe("30 %");
    expect(espaces(formaterTaux(0.008))).toBe("0,8 %");
  });

  it("formaterNombrePrecis", () => {
    expect(formaterNombrePrecis(14.2423)).toBe("14,2423");
    expect(formaterNombrePrecis(8)).toBe("8");
  });
});
