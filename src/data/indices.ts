/**
 * Indice national des fermages (base 100 en 2009).
 *
 * Depuis la loi de modernisation de l'agriculture et de la pêche du 27 juillet
 * 2010, l'indice est national et unique. Il est composé à 60 % de l'évolution
 * du revenu brut d'entreprise agricole (RBEA) à l'hectare constaté au plan
 * national au cours des cinq années précédentes et à 40 % de l'évolution du
 * niveau général des prix de l'année précédente.
 *
 * Chaque année, un arrêté ministériel (publié au Journal officiel, en général
 * en juillet) constate la valeur de l'indice. Les loyers des baux ruraux sont
 * révisés chaque année en multipliant le loyer en cours par le rapport entre
 * l'indice de l'année et celui de l'année précédente.
 *
 * Sources :
 *  - Arrêté du 11 août 2026 (indice 2026 = 127,04 ; +3,23 %)
 *    NOR : AGRT2618753A — JORF du 13 août 2026
 *  - Arrêté du 23 juillet 2025 (indice 2025 = 123,06 ; +0,42 %)
 *    https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051987943
 *  - Arrêté du 17 juillet 2024 (indice 2024 = 122,55 ; +5,23 %)
 *    https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050058521
 *  - Décret n° 2010-1126 du 27 septembre 2010 (base 100 en 2009).
 *
 * Les valeurs sont arrondies au centième, conformément aux arrêtés.
 */

export interface IndiceFermage {
  /** Année de constatation de l'indice. */
  annee: number;
  /** Valeur de l'indice (base 100 en 2009). */
  valeur: number;
  /** Variation par rapport à l'année précédente, en pourcentage. */
  variation: number | null;
}

/**
 * Tableau officiel de l'indice national des fermages, trié par année croissante.
 * Mis à jour jusqu'à l'arrêté de 2026.
 */
export const INDICES_FERMAGE: readonly IndiceFermage[] = [
  { annee: 2009, valeur: 100.0, variation: null },
  { annee: 2010, valeur: 98.37, variation: -1.63 },
  { annee: 2011, valeur: 101.25, variation: 2.92 },
  { annee: 2012, valeur: 103.95, variation: 2.67 },
  { annee: 2013, valeur: 106.68, variation: 2.63 },
  { annee: 2014, valeur: 108.30, variation: 1.52 },
  { annee: 2015, valeur: 110.05, variation: 1.61 },
  { annee: 2016, valeur: 109.59, variation: -0.42 },
  { annee: 2017, valeur: 106.28, variation: -3.02 },
  { annee: 2018, valeur: 103.05, variation: -3.04 },
  { annee: 2019, valeur: 104.76, variation: 1.66 },
  { annee: 2020, valeur: 105.33, variation: 0.55 },
  { annee: 2021, valeur: 106.48, variation: 1.09 },
  { annee: 2022, valeur: 110.26, variation: 3.55 },
  { annee: 2023, valeur: 116.46, variation: 5.63 },
  { annee: 2024, valeur: 122.55, variation: 5.23 },
  { annee: 2025, valeur: 123.06, variation: 0.42 },
  { annee: 2026, valeur: 127.04, variation: 3.23 },
] as const;

/** Année la plus ancienne disposant d'un indice national. */
export const ANNEE_MIN = INDICES_FERMAGE[0].annee;

/** Année la plus récente disposant d'un indice national. */
export const ANNEE_MAX = INDICES_FERMAGE[INDICES_FERMAGE.length - 1].annee;

/** Map pratique année -> valeur de l'indice. */
const INDICE_PAR_ANNEE = new Map<number, number>(
  INDICES_FERMAGE.map((i) => [i.annee, i.valeur]),
);

/**
 * Retourne la valeur de l'indice national des fermages pour une année donnée,
 * ou `undefined` si l'année n'est pas connue.
 */
export function indicePourAnnee(annee: number): number | undefined {
  return INDICE_PAR_ANNEE.get(annee);
}
