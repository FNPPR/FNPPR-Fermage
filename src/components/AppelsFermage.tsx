import { useState } from "react";
import { nomAffiche, type Dossier } from "../lib/dossier";
import {
  LIBELLES_DEDUCTIONS,
  LIBELLES_TAXES,
  deductionsUtiles,
  taxesUtiles,
  totalTaxe,
  type ResultatBail,
  type ResultatDossier,
} from "../lib/calculDossier";
import { arrondir } from "../lib/fermage";
import { MOINS, formaterEuros, formaterNombre, formaterNombrePrecis } from "../lib/format";
import type { EtatDossier } from "../lib/etatDossier";
import {
  AideImpression,
  BlocAdresse,
  ResultatsIndisponibles,
  aujourdhuiIso,
  dateEnLettres,
  enumeration,
  nomCommuneDe,
  nomExploitantDe,
  resultatsDisponibles,
  type AllerAuDossier,
} from "./communDossier";

type Presentation = "exploitant" | "commune";

const somme = (valeurs: number[]) => arrondir(valeurs.reduce((s, v) => s + v, 0), 2);

/** Montant d'une colonne ; les sommes à déduire sont précédées du signe moins : « −864,71 € ». */
function Cellule({ valeur, aDeduire = false }: { valeur: number; aDeduire?: boolean }) {
  return (
    <td className="nombre">
      {aDeduire && arrondir(valeur, 2) !== 0 ? MOINS : ""}
      {formaterEuros(valeur)}
    </td>
  );
}

function Lettre({
  baux,
  dossier,
  resultat,
  dateCourrier,
}: {
  baux: ResultatBail[];
  dossier: Dossier;
  resultat: ResultatDossier;
  dateCourrier: string;
}) {
  const exploitant = baux[0].exploitant.coordonnees;
  const plusieurs = baux.length > 1;
  const taxes = taxesUtiles(baux);
  const deductions = deductionsUtiles(baux);
  const totalTaxes = somme(baux.map((b) => b.totalTaxes));
  const totalDeductions = somme(baux.map((b) => b.totalDeductions));
  const fermage = somme(baux.map((b) => b.fermage));
  const reste = somme(baux.map((b) => b.resteDu));
  const civilite = exploitant.civilite.trim() || "Madame, Monsieur";
  const communes = baux.map(nomCommuneDe);
  const signataire = [dossier.bailleur.prenom.trim(), dossier.bailleur.nom.trim()].filter(Boolean).join(" ");
  const lieu = dossier.lieuCourrier.trim();
  const { indice, indicePrecedent } = resultat;
  const acomptes = baux.filter((b) => b.nombreAcomptes > 0);
  const colonnes = baux.length + (plusieurs ? 1 : 0);

  const ligne = (libelle: string, valeurs: number[], total: number, aDeduire = false, classe?: string) => (
    <tr className={classe}>
      <td>{libelle}</td>
      {valeurs.map((v, i) => (
        <Cellule key={i} valeur={v} aDeduire={aDeduire} />
      ))}
      {plusieurs && <Cellule valeur={total} aDeduire={aDeduire} />}
    </tr>
  );

  return (
    <article className="appel-lettre">
      <div className="appel-entete">
        <div className="appel-expediteur">
          <BlocAdresse c={dossier.bailleur} avecContact />
        </div>
        <div className="appel-destinataire">
          <BlocAdresse c={exploitant} />
        </div>
      </div>

      <p className="appel-lieu-date">
        {lieu ? `${lieu}, le ` : "Le "}
        {dateEnLettres(dateCourrier)}
      </p>

      <p className="appel-objet">
        Objet : appel de fermage — échéance du {dateEnLettres(dossier.echeance)}
      </p>

      <p>{civilite},</p>
      <p>
        Je vous prie de bien vouloir trouver ci-dessous le décompte{" "}
        {plusieurs ? "de vos fermages" : "de votre fermage"} à l'échéance du{" "}
        {dateEnLettres(dossier.echeance)}, pour les terres que vous louez{" "}
        {plusieurs ? `sur les communes de ${enumeration(communes)}` : `sur la commune de ${communes[0]}`}.
      </p>

      <div className="appel-tableau-conteneur">
      <table className="appel-tableau">
        {plusieurs && (
          <thead>
            <tr>
              <th />
              {communes.map((c, i) => (
                <th key={i} className="nombre">
                  {c}
                </th>
              ))}
              <th className="nombre">Total</th>
            </tr>
          </thead>
        )}
        <tbody>
          <tr className="appel-section">
            <td colSpan={colonnes + 1}>Fermage</td>
          </tr>
          <tr className="ligne-info">
            <td>Surface louée</td>
            {baux.map((b) => (
              <td key={b.bail.id} className="nombre">
                {formaterNombrePrecis(b.surface)} ha
              </td>
            ))}
            {plusieurs && (
              <td className="nombre">
                {formaterNombrePrecis(baux.reduce((s, b) => s + b.surface, 0))} ha
              </td>
            )}
          </tr>
          {ligne(
            `Fermage ${resultat.anneePrecedente}`,
            baux.map((b) => b.fermagePrecedent),
            // Somme des montants tels qu'affichés, au centime.
            somme(baux.map((b) => arrondir(b.fermagePrecedent, 2))),
            false,
            "ligne-info",
          )}
          {ligne(
            `Fermage ${resultat.annee}${
              indice !== null && indicePrecedent !== null
                ? ` (× ${formaterNombre(indice)} ÷ ${formaterNombre(indicePrecedent)})`
                : ""
            }`,
            baux.map((b) => b.fermage),
            fermage,
            false,
            "appel-sous-total-ligne",
          )}

          <tr className="appel-section">
            <td colSpan={colonnes + 1}>Impôts et taxes</td>
          </tr>
          {taxes.length === 0 ? (
            <tr>
              <td colSpan={colonnes + 1}>Néant</td>
            </tr>
          ) : (
            taxes.map((id) => (
              <tr key={id}>
                <td>{LIBELLES_TAXES[id]}</td>
                {baux.map((b) => (
                  <Cellule key={b.bail.id} valeur={b.taxes.find((t) => t.id === id)?.impute ?? 0} />
                ))}
                {plusieurs && <Cellule valeur={totalTaxe(baux, id)} />}
              </tr>
            ))
          )}
          {ligne("Total impôts et taxes", baux.map((b) => b.totalTaxes), totalTaxes, false, "appel-sous-total-ligne")}

          {deductions.length > 0 && (
            <>
              <tr className="appel-section">
                <td colSpan={colonnes + 1}>À déduire</td>
              </tr>
              {deductions.map((id) => (
                <tr key={id}>
                  <td>{LIBELLES_DEDUCTIONS[id]}</td>
                  {baux.map((b) => (
                    <Cellule key={b.bail.id} valeur={b.deductions[id]} aDeduire />
                  ))}
                  {plusieurs && <Cellule valeur={somme(baux.map((b) => b.deductions[id]))} aDeduire />}
                </tr>
              ))}
              {ligne("Total à déduire", baux.map((b) => b.totalDeductions), totalDeductions, true, "appel-sous-total-ligne")}
            </>
          )}
        </tbody>
        <tfoot>
          <tr className="appel-total-ligne">
            <td>Reste à devoir</td>
            {baux.map((b) => (
              <td key={b.bail.id} className="nombre">
                {formaterEuros(b.resteDu)}
              </td>
            ))}
            {plusieurs && <td className="nombre">{formaterEuros(reste)}</td>}
          </tr>
        </tfoot>
      </table>
      </div>

      <p style={{ marginTop: "1.1rem" }}>
        {reste > 0
          ? `Montant de ${formaterEuros(reste)} que vous voudrez bien me régler par le moyen de votre choix, le plus tôt possible.`
          : reste < 0
            ? `Ce solde de ${formaterEuros(-reste)} est en votre faveur ; il vous sera reversé.`
            : "Aucune somme n'est due à cette échéance."}
      </p>
      <p>Veuillez agréer, {civilite}, l'expression de mes meilleurs sentiments.</p>
      {signataire && <p className="appel-signature">{signataire}</p>}

      {acomptes.length > 0 && (
        <p className="appel-nota">
          Nota : acomptes à prévoir pour {resultat.annee + 1}, avant l'échéance :{" "}
          {acomptes
            .map((b) => {
              const n = b.nombreAcomptes;
              const texte = `${n} ${n > 1 ? "acomptes" : "acompte"} de ${formaterEuros(b.montantAcompte)}${n > 1 ? " chacun" : ""}`;
              return plusieurs ? `${nomCommuneDe(b)}, ${texte}` : texte;
            })
            .join(" ; ")}
          .
        </p>
      )}
    </article>
  );
}

export function AppelsFermage({
  etat,
  resultat,
  allerAuDossier,
}: {
  etat: EtatDossier;
  resultat: ResultatDossier;
  allerAuDossier: AllerAuDossier;
}) {
  const { dossier, modifier } = etat;
  const [presentation, setPresentation] = useState<Presentation>("exploitant");
  const [filtre, setFiltre] = useState("tous");
  const dateCourrier = dossier.dateCourrier.trim() || aujourdhuiIso();

  const filtreValide = resultat.parExploitant.some((g) => g.exploitant.id === filtre) ? filtre : "tous";
  const groupes = resultatsDisponibles(resultat)
    ? resultat.parExploitant.filter((g) => filtreValide === "tous" || g.exploitant.id === filtreValide)
    : [];
  const appels: ResultatBail[][] =
    presentation === "exploitant" ? groupes.map((g) => g.baux) : groupes.flatMap((g) => g.baux.map((b) => [b]));
  const bailleurRenseigne = nomAffiche(dossier.bailleur, "") !== "";

  return (
    <section className="card" aria-labelledby="titre-appels">
      <div className="no-print">
        <h2 id="titre-appels">Appels de fermage</h2>
        <p className="intro">
          Les appels de fermage de tous les exploitants, calculés à partir de
          la fiche Renseignements généraux : fermage réévalué, taxes imputées
          au preneur et déductions. Imprimez-les ou enregistrez-les en PDF ;
          ils sont conservés avec le dossier.
        </p>
        {!resultatsDisponibles(resultat) ? (
          <ResultatsIndisponibles resultat={resultat} allerAuDossier={allerAuDossier} />
        ) : (
          <>
            <fieldset className="choix-presentation">
              <legend>Présentation</legend>
              <label>
                <input
                  type="radio"
                  name="presentation"
                  checked={presentation === "exploitant"}
                  onChange={() => setPresentation("exploitant")}
                />{" "}
                Un appel par exploitant, regroupant toutes ses communes
              </label>
              <label>
                <input
                  type="radio"
                  name="presentation"
                  checked={presentation === "commune"}
                  onChange={() => setPresentation("commune")}
                />{" "}
                Un appel par commune
              </label>
            </fieldset>
            <div className="grille">
              <div className="champ">
                <label htmlFor="ap-filtre">Exploitant</label>
                <select id="ap-filtre" value={filtreValide} onChange={(e) => setFiltre(e.target.value)}>
                  <option value="tous">Tous les exploitants ({resultat.parExploitant.length})</option>
                  {resultat.parExploitant.map((g) => (
                    <option key={g.exploitant.id} value={g.exploitant.id}>
                      {nomExploitantDe(g.baux[0])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="ap-lieu">Lieu de rédaction</label>
                <input
                  id="ap-lieu"
                  type="text"
                  value={dossier.lieuCourrier}
                  placeholder="ex. Commune A"
                  onChange={(e) => modifier((d) => ({ ...d, lieuCourrier: e.target.value }))}
                />
              </div>
              <div className="champ">
                <label htmlFor="ap-date">Date du courrier</label>
                <input
                  id="ap-date"
                  type="date"
                  value={dateCourrier}
                  onChange={(e) => modifier((d) => ({ ...d, dateCourrier: e.target.value }))}
                />
              </div>
            </div>
            {!bailleurRenseigne && (
              <p className="confirmation-bloc">
                Le bailleur n'est pas renseigné : l'en-tête et la signature des
                appels resteront vides.{" "}
                <button type="button" className="btn-lien" onClick={() => allerAuDossier("bailleur-nom")}>
                  Compléter la fiche
                </button>
              </p>
            )}
            <div className="detail-actions">
              <button type="button" className="btn-imprimer" onClick={() => window.print()}>
                Imprimer {appels.length > 1 ? `les ${appels.length} appels` : "l'appel"}
              </button>
              <AideImpression />
            </div>
            <h3 className="appel-soustitre" style={{ marginTop: "1.25rem" }}>
              Aperçu : {appels.length} {appels.length > 1 ? "appels" : "appel"}, un par page à l'impression
            </h3>
          </>
        )}
      </div>

      {appels.map((baux) => (
        <Lettre
          key={baux.map((b) => b.bail.id).join("+")}
          baux={baux}
          dossier={dossier}
          resultat={resultat}
          dateCourrier={dateCourrier}
        />
      ))}

      {appels.length > 0 && (
        <p className="intro no-print" style={{ marginTop: "1.25rem", marginBottom: 0, fontSize: "0.82rem" }}>
          Documents indicatifs à vérifier avant envoi : adresses et formule de
          politesse restent à adapter selon vos usages.
        </p>
      )}
    </section>
  );
}
