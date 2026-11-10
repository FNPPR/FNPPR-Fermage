/**
 * Éléments communs aux onglets qui affichent les résultats du dossier.
 */

import type { ReactNode } from "react";
import { nomCommune, nomExploitant, type Coordonnees } from "../lib/dossier";
import type { Probleme, ResultatBail, ResultatDossier } from "../lib/calculDossier";
import { formaterEuros } from "../lib/format";

/**
 * Retour à la fiche Renseignements généraux, éventuellement sur une case
 * précise (identifiant du champ, voir `idDuChamp`).
 */
export type AllerAuDossier = (idChamp?: string) => void;

/** Identifiant, dans la fiche, de la case concernée par un problème ; null s'il n'y en a pas. */
export function idDuChamp(p: Probleme): string | null {
  if (!p.champ) return null;
  if (p.bailId) return `bail-${p.bailId}-${p.champ}`;
  if (p.communeId) return `commune-${p.communeId}-${p.champ}`;
  if (p.champ === "revalorisationRevenuCadastral") return "d-revalo";
  if (p.champ === "tauxDegrevement") return "d-degrevement";
  return null;
}

/** Amène une case de la fiche à l'écran (en ouvrant les blocs repliés) et y place le curseur. */
export function allerAuChamp(id: string): void {
  const champ = document.getElementById(id);
  if (!champ) return;
  for (let n = champ.parentElement; n; n = n.parentElement) {
    if (n instanceof HTMLDetailsElement) n.open = true;
  }
  champ.scrollIntoView({ block: "center" });
  champ.focus({ preventScroll: true });
}

/**
 * Vrai quand les résultats peuvent être affichés et imprimés : fiche sans
 * aucune erreur et au moins une terre louée.
 */
export function resultatsDisponibles(r: ResultatDossier): boolean {
  return r.sansErreur && r.baux.length > 0;
}

/** Liste de problèmes de la fiche, chacun avec un lien vers la case à corriger. */
export function ListeProblemes({
  problemes,
  allerA,
  max,
}: {
  problemes: Probleme[];
  allerA: (idChamp: string) => void;
  /** Nombre de problèmes affichés au plus (les suivants sont résumés). */
  max?: number;
}) {
  const visibles = max === undefined ? problemes : problemes.slice(0, max);
  const reste = problemes.length - visibles.length;
  return (
    <>
      <ul className="liste-problemes">
        {visibles.map((p, i) => {
          const id = idDuChamp(p);
          return (
            <li key={i}>
              <strong>{p.ou}</strong> : {p.message}
              {id && (
                <>
                  {" "}
                  <button type="button" className="btn-lien" onClick={() => allerA(id)}>
                    Aller à la case
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {reste > 0 && (
        <p className="liste-problemes-suite">
          … et {reste > 1 ? `${reste} autres points` : "un autre point"}, signalés dans la fiche.
        </p>
      )}
    </>
  );
}

/**
 * Affiché à la place des résultats tant qu'ils ne sont pas disponibles :
 * fiche incomplète ou erronée (rien n'est alors calculé ni imprimable), ou
 * aucune terre louée renseignée.
 */
export function ResultatsIndisponibles({
  resultat,
  allerAuDossier,
}: {
  resultat: ResultatDossier;
  allerAuDossier: AllerAuDossier;
}) {
  const erreurs = resultat.problemes.filter((p) => p.gravite === "erreur");
  if (erreurs.length === 0) {
    return (
      <div className="info">
        <strong>Aucune terre louée n'est encore renseignée.</strong> Remplissez
        d'abord la fiche Renseignements généraux : bailleur, communes,
        exploitants et terres louées.{" "}
        <button type="button" className="btn-lien" onClick={() => allerAuDossier()}>
          Ouvrir la fiche
        </button>
      </div>
    );
  }
  const n = erreurs.length;
  return (
    <div className="erreur blocage" role="alert">
      <p className="blocage-titre">
        <strong>
          Aucun résultat n'est affiché : la fiche comporte{" "}
          {n > 1 ? `${n} points à corriger` : "un point à corriger"}.
        </strong>
      </p>
      <p>
        Tant qu'une case obligatoire est vide ou qu'une saisie est erronée,
        aucun montant n'est calculé ni imprimable : aucun appel de fermage
        incomplet ou faux ne peut ainsi être établi.
      </p>
      <ListeProblemes problemes={erreurs} allerA={allerAuDossier} max={8} />
      <button
        type="button"
        className="btn-imprimer"
        onClick={() => allerAuDossier(idDuChamp(erreurs[0]) ?? undefined)}
      >
        Corriger la fiche
      </button>
    </div>
  );
}

/** « MOREAU Aline » ou « Exploitant 2 ». */
export function nomExploitantDe(b: ResultatBail): string {
  return nomExploitant(b.exploitant, b.rangExploitant);
}

/** « LE LOROUX » ou « Commune 2 ». */
export function nomCommuneDe(b: ResultatBail): string {
  return nomCommune(b.commune, b.rangCommune);
}

/** Montant en euros ; les montants négatifs (en faveur du preneur) sont signalés. */
export function Montant({ valeur, fort = false }: { valeur: number; fort?: boolean }) {
  const texte = formaterEuros(valeur);
  const contenu = fort ? <strong>{texte}</strong> : texte;
  return <span className={valeur < 0 ? "montant-negatif" : undefined}>{contenu}</span>;
}

/** Bloc d'adresse : « Madame MOREAU Aline », adresse, code postal et commune, téléphone, e-mail. */
export function BlocAdresse({ c, avecContact = false }: { c: Coordonnees; avecContact?: boolean }) {
  const lignes: ReactNode[] = [];
  const nom = [c.civilite, c.nom, c.prenom].map((x) => x.trim()).filter(Boolean).join(" ");
  if (nom) lignes.push(<strong key="nom">{nom}</strong>);
  for (const l of c.adresse.split("\n").map((x) => x.trim()).filter(Boolean)) lignes.push(l);
  const ville = [c.codePostal.trim(), c.ville.trim()].filter(Boolean).join(" ");
  if (ville) lignes.push(ville);
  if (avecContact) {
    if (c.telephone.trim()) lignes.push(`Tél. ${c.telephone.trim()}`);
    if (c.email.trim()) lignes.push(c.email.trim());
  }
  return (
    <>
      {lignes.map((l, i) => (
        <span key={i}>
          {l}
          <br />
        </span>
      ))}
    </>
  );
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « 2026-11-01 » → « 1er novembre 2026 » ; texte non reconnu rendu tel quel. */
export function dateEnLettres(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  const jour = Number(m[3]);
  const mois = MOIS[Number(m[2]) - 1];
  if (!mois || jour < 1 || jour > 31) return iso.trim();
  return `${jour === 1 ? "1er" : jour} ${mois} ${m[1]}`;
}

/** Date du jour au format AAAA-MM-JJ (heure locale). */
export function aujourdhuiIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** « COMMUNE A » ; « COMMUNE A et COMMUNE B » ; « A, B et C ». */
export function enumeration(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Rappel d'impression, commun aux pages imprimables. */
export function AideImpression() {
  return (
    <p className="aide-bloc">
      Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF »
      pour obtenir un fichier, et décochez « En-têtes et pieds de page »
      (Plus de paramètres) pour ne pas imprimer l'adresse du site.
    </p>
  );
}
