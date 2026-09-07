/**
 * État partagé du « fermage de base » (loyer de référence, année de départ,
 * année de calcul) entre les onglets « Réévaluation » et « Appel de fermage »,
 * qui portent tous deux sur exactement la même donnée : le loyer réévalué
 * selon l'indice national. Sans cet état commun, une saisie dans un onglet
 * n'était pas reprise dans l'autre (chacun avait sa propre mémoire locale).
 */

import { useState } from "react";
import { ANNEE_MAX } from "../data/indices";

export interface EtatFermageBase {
  loyer: string;
  setLoyer: (v: string) => void;
  anneeDepart: number;
  setAnneeDepart: (v: number) => void;
  anneeArrivee: number;
  setAnneeArrivee: (v: number) => void;
}

export function useEtatFermageBase(): EtatFermageBase {
  const [loyer, setLoyer] = useState("1000");
  const [anneeDepart, setAnneeDepart] = useState(ANNEE_MAX - 1);
  const [anneeArrivee, setAnneeArrivee] = useState(ANNEE_MAX);

  return {
    loyer,
    setLoyer,
    anneeDepart,
    setAnneeDepart,
    anneeArrivee,
    setAnneeArrivee,
  };
}
