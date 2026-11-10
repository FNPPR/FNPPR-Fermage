import { describe, it, expect } from "vitest";
import {
  formaterEuros,
  formaterEurosPrecis,
  formaterNombrePrecis,
  formaterTaux,
  parseNombre,
  saisieVide,
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
    expect(parseNombre("1.234,56")).toBeNaN();
    expect(parseNombre("1e3")).toBeNaN();
    expect(parseNombre("0x10")).toBeNaN();
    expect(parseNombre("Infinity")).toBeNaN();
    expect(parseNombre("12-")).toBeNaN();
  });

  it("accepte le signe moins typographique recopié depuis le site", () => {
    expect(parseNombre("\u22125,5")).toBe(-5.5);
    expect(parseNombre("-5,5")).toBe(-5.5);
  });

  it("saisieVide : blancs, « € » ou « % » seuls", () => {
    expect(saisieVide("")).toBe(true);
    expect(saisieVide(" % ")).toBe(true);
    expect(saisieVide("€")).toBe(true);
    expect(saisieVide("0")).toBe(false);
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
    // Surfaces : toutes les décimales saisies, sans arrondi à 4 décimales.
    expect(formaterNombrePrecis(7.77777)).toBe("7,77777");
    expect(formaterNombrePrecis(15.23 + 7.16)).toBe("22,39");
    expect(formaterNombrePrecis(1.123456789)).toBe("1,123456789");
  });
});

describe("formaterEuros", () => {
  it("arrondit au centime comme les calculs", () => {
    expect(espaces(formaterEuros(1234.5))).toBe("1 234,50 €");
    expect(espaces(formaterEuros(1500.555))).toBe("1 500,56 €");
    expect(espaces(formaterEuros(1.005))).toBe("1,01 €");
  });

  it("écrit les montants négatifs avec le signe moins « − »", () => {
    expect(espaces(formaterEuros(-41.59))).toBe("\u221241,59 €");
    expect(espaces(formaterEuros(-0.005))).toBe("\u22120,01 €");
  });

  it("n'affiche jamais « −0,00 € »", () => {
    expect(espaces(formaterEuros(-0))).toBe("0,00 €");
    expect(espaces(formaterEuros(-0.004))).toBe("0,00 €");
  });
});
