/**
 * Variante de `useState` dont la valeur est conservée dans le `localStorage`
 * du navigateur : elle survit à la fermeture de l'onglet, au rechargement de
 * la page ou au passage sur un autre onglet du calculateur.
 *
 * Toujours accédé de façon défensive (essai/erreur) : le `localStorage` peut
 * être indisponible (navigation privée, quota dépassé, contexte sans DOM) —
 * dans ce cas l'état se comporte comme un `useState` ordinaire, sans
 * persistance, plutôt que de faire planter la page.
 */

import { useEffect, useState } from "react";

function lireValeurStockee<T>(cle: string, valeurParDefaut: T): T {
  try {
    const brut = window.localStorage.getItem(cle);
    if (brut === null) return valeurParDefaut;
    return JSON.parse(brut) as T;
  } catch {
    return valeurParDefaut;
  }
}

export function useLocalStorageState<T>(
  cle: string,
  valeurParDefaut: T,
): [T, (v: T | ((prec: T) => T)) => void] {
  const [valeur, setValeur] = useState<T>(() =>
    lireValeurStockee(cle, valeurParDefaut),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(cle, JSON.stringify(valeur));
    } catch {
      // Stockage indisponible (navigation privée, quota…) : on continue sans
      // persister, la saisie reste utilisable pour la session en cours.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, valeur]);

  return [valeur, setValeur];
}
