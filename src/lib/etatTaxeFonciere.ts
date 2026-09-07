/**
 * État partagé des lignes de taxes de l'onglet « Répartition des taxes
 * foncières et assimilées », entre cet onglet et l'onglet « Appel de
 * fermage » qui reprend automatiquement les montants imputés au preneur dans
 * son décompte final.
 */

import { useState, type Dispatch, type SetStateAction } from "react";
import { LIGNES_INITIALES, type LigneUI } from "./taxeFonciereLignes";

export interface EtatTaxeFonciere {
  lignes: LigneUI[];
  setLignes: Dispatch<SetStateAction<LigneUI[]>>;
  tauxDegrevement: string;
  setTauxDegrevement: (v: string) => void;
  coefficient: string;
  setCoefficient: (v: string) => void;
}

export function useEtatTaxeFonciere(): EtatTaxeFonciere {
  const [lignes, setLignes] = useState<LigneUI[]>(LIGNES_INITIALES);
  const [tauxDegrevement, setTauxDegrevement] = useState("30");
  const [coefficient, setCoefficient] = useState("1.43");

  return {
    lignes,
    setLignes,
    tauxDegrevement,
    setTauxDegrevement,
    coefficient,
    setCoefficient,
  };
}
