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
  /** Taux de dégrèvement de la TFNB, en % (30 depuis 2025). */
  tauxDegrevement: string;
  setTauxDegrevement: (v: string) => void;
  /** Revenu cadastral de l'exploitant (relevé de propriété, actualisé), en €,
   * saisi une seule fois pour toutes les lignes. */
  revenuCadastral: string;
  setRevenuCadastral: (v: string) => void;
  /** Référence libre (propriétaire, preneur, commune) reprise en tête du
   * détail des calculs imprimé. */
  referenceDossier: string;
  setReferenceDossier: (v: string) => void;
}

export function useEtatTaxeFonciere(): EtatTaxeFonciere {
  const [lignes, setLignes] = useState<LigneUI[]>(LIGNES_INITIALES);
  const [tauxDegrevement, setTauxDegrevement] = useState("30");
  const [revenuCadastral, setRevenuCadastral] = useState("");
  const [referenceDossier, setReferenceDossier] = useState("");

  return {
    lignes,
    setLignes,
    tauxDegrevement,
    setTauxDegrevement,
    revenuCadastral,
    setRevenuCadastral,
    referenceDossier,
    setReferenceDossier,
  };
}
