import type { ResultatDossier } from "../lib/calculDossier";
import { formaterEuros, formaterNombre, formaterNombrePrecis } from "../lib/format";
import {
  ResultatsIndisponibles,
  nomCommuneDe,
  nomExploitantDe,
  resultatsDisponibles,
  type AllerAuDossier,
} from "./communDossier";

/** Réévaluation de tous les fermages du dossier (onglet Réévaluation). */
export function ReevaluationDossier({
  resultat,
  allerAuDossier,
}: {
  resultat: ResultatDossier;
  allerAuDossier: AllerAuDossier;
}) {
  // Rien à montrer tant que la fiche ne contient aucune terre louée.
  if (resultat.bauxSaisis === 0) return null;
  const { annee, anneePrecedente, indice, indicePrecedent } = resultat;
  return (
    <section className="card" aria-labelledby="titre-reeval-dossier">
      <h2 id="titre-reeval-dossier">Fermages du dossier : {anneePrecedente} → {annee}</h2>
      {!resultatsDisponibles(resultat) ? (
        <ResultatsIndisponibles resultat={resultat} allerAuDossier={allerAuDossier} />
      ) : (
        <>
          <p className="intro">
            Chaque fermage {anneePrecedente} de la fiche est multiplié par
            l'indice {annee} ({indice !== null ? formaterNombre(indice) : "—"}) puis
            divisé par l'indice {anneePrecedente} (
            {indicePrecedent !== null ? formaterNombre(indicePrecedent) : "—"}), et
            arrondi au centime.
          </p>
          <div className="tableau-scroll tableau-libre">
            <table className="tableau-dossier">
              <thead>
                <tr>
                  <th>Exploitant</th>
                  <th>Commune</th>
                  <th className="nombre">Surface (ha)</th>
                  <th className="nombre">Fermage {anneePrecedente}</th>
                  <th className="nombre">Fermage {annee}</th>
                  <th className="nombre">Fermage {annee} à l'hectare</th>
                </tr>
              </thead>
              <tbody>
                {resultat.parExploitant.map((g) =>
                  g.baux.map((b, i) => (
                    <tr key={b.bail.id}>
                      <td>{i === 0 ? nomExploitantDe(b) : ""}</td>
                      <td>{nomCommuneDe(b)}</td>
                      <td className="nombre">{formaterNombrePrecis(b.surface)}</td>
                      <td className="nombre">{formaterEuros(b.fermagePrecedent)}</td>
                      <td className="nombre">
                        <strong>{formaterEuros(b.fermage)}</strong>
                      </td>
                      <td className="nombre">
                        {b.fermageParHa !== null ? formaterEuros(b.fermageParHa) : "—"}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total de la propriété</td>
                  <td className="nombre">{formaterNombrePrecis(resultat.totaux.surface)}</td>
                  <td className="nombre">{formaterEuros(resultat.totaux.fermagePrecedent)}</td>
                  <td className="nombre">{formaterEuros(resultat.totaux.fermage)}</td>
                  <td className="nombre">
                    {resultat.totaux.fermageParHa !== null ? formaterEuros(resultat.totaux.fermageParHa) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="aide-bloc" style={{ marginTop: "0.6rem" }}>
            Chaque fermage est arrondi au centime ; le total est la somme des
            fermages arrondis. Fermage à l'hectare = fermage {annee} ÷ surface.
          </p>
        </>
      )}
    </section>
  );
}
