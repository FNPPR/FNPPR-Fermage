/**
 * Dossier en cours, partagé par tous les onglets (renseignements généraux,
 * réévaluation, taxes, appels de fermage, récapitulatif) et conservé
 * automatiquement dans le navigateur (localStorage), sur cet ordinateur
 * seulement : rien n'est envoyé sur Internet.
 *
 * Le stockage est toujours lu et écrit de façon défensive : indisponible
 * (navigation privée, quota…) ou illisible, le calculateur repart d'un
 * dossier vide au lieu de planter.
 */

import { useCallback, useEffect, useState } from "react";
import { exporterDossier, lireDossier, nouveauDossier, type Dossier } from "./dossier";

export const CLE_DOSSIER = "fnppr-fermage-dossier";

function lireDossierStocke(): Dossier {
  try {
    const brut = window.localStorage.getItem(CLE_DOSSIER);
    if (brut) return lireDossier(JSON.parse(brut));
  } catch {
    // Stockage indisponible ou contenu illisible : dossier vide.
  }
  return nouveauDossier();
}

export interface EtatDossier {
  dossier: Dossier;
  /** Applique une modification au dossier (fonction pure : ancien → nouveau). */
  modifier: (f: (d: Dossier) => Dossier) => void;
  /** Remplace tout le dossier (nouveau dossier, fichier ouvert, exemple). */
  remplacer: (d: Dossier) => void;
}

export function useEtatDossier(): EtatDossier {
  const [dossier, setDossier] = useState<Dossier>(lireDossierStocke);

  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_DOSSIER, exporterDossier(dossier));
    } catch {
      // Stockage indisponible : la saisie reste utilisable pour la session.
    }
  }, [dossier]);

  const modifier = useCallback((f: (d: Dossier) => Dossier) => setDossier(f), []);
  const remplacer = useCallback((d: Dossier) => setDossier(d), []);
  return { dossier, modifier, remplacer };
}

/** Le dossier contient-il déjà une saisie (à ne pas écraser sans prévenir) ? */
export function dossierEntame(d: Dossier): boolean {
  return (
    d.communes.length > 0 ||
    d.exploitants.length > 0 ||
    Object.values(d.bailleur).some((v) => v.trim() !== "")
  );
}
