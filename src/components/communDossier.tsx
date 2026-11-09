/**
 * Éléments communs aux onglets qui affichent les résultats du dossier.
 */

import type { ReactNode } from "react";
import { nomCommune, nomExploitant, type Coordonnees } from "../lib/dossier";
import type { ResultatBail, ResultatDossier } from "../lib/calculDossier";
import { formaterEuros } from "../lib/format";

/** Message affiché tant que la fiche ne permet aucun calcul. */
export function DossierVide({
  resultat,
  allerAuDossier,
}: {
  resultat: ResultatDossier;
  allerAuDossier: () => void;
}) {
  const erreurs = resultat.problemes.filter((p) => p.gravite === "erreur").length;
  return (
    <div className="info">
      {erreurs > 0 ? (
        <>
          <strong>La fiche contient {erreurs > 1 ? `${erreurs} erreurs` : "une erreur"}.</strong>{" "}
          Corrigez-{erreurs > 1 ? "les" : "la"} dans l'onglet Renseignements généraux.
        </>
      ) : (
        <>
          <strong>Aucune terre louée n'est encore renseignée.</strong> Remplissez
          d'abord la fiche Renseignements généraux : bailleur, communes,
          exploitants et terres louées.
        </>
      )}{" "}
      <button type="button" className="btn-lien" onClick={allerAuDossier}>
        Ouvrir la fiche
      </button>
    </div>
  );
}

/** Rappel des erreurs de la fiche : certaines terres ne sont pas calculées. */
export function AlerteErreurs({
  resultat,
  allerAuDossier,
}: {
  resultat: ResultatDossier;
  allerAuDossier: () => void;
}) {
  const erreurs = resultat.problemes.filter((p) => p.gravite === "erreur");
  if (erreurs.length === 0) return null;
  return (
    <div className="erreur no-print" role="alert">
      <strong>Attention :</strong> la fiche contient{" "}
      {erreurs.length > 1 ? `${erreurs.length} erreurs` : "une erreur"} (
      {erreurs.map((e) => e.ou).filter((o, i, t) => t.indexOf(o) === i).join(" ; ")}) : les
      terres concernées ne figurent pas ci-dessous.{" "}
      <button type="button" className="btn-lien" onClick={allerAuDossier}>
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
