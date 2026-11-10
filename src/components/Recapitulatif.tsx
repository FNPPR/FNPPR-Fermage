import { Fragment } from "react";
import { nomAffiche } from "../lib/dossier";
import type { ResultatBail, ResultatDossier, Totaux } from "../lib/calculDossier";
import { arrondir } from "../lib/fermage";
import { formaterEuros, formaterNombrePrecis } from "../lib/format";
import {
  AideImpression,
  Montant,
  ResultatsIndisponibles,
  dateEnLettres,
  nomCommuneDe,
  nomExploitantDe,
  resultatsDisponibles,
  type AllerAuDossier,
} from "./communDossier";

const ha = (s: number) => formaterNombrePrecis(s);
/** Nombre d'exploitants différents parmi des terres louées. */
const nombreExploitants = (baux: ResultatBail[]) => new Set(baux.map((b) => b.exploitant.id)).size;
const parHa = (v: number | null) => (v === null ? "—" : formaterEuros(v));
/** Dégrèvements, indemnités sécheresse et autres déductions (hors acomptes). */
const autresDeductionsBail = (b: ResultatBail) => arrondir(b.totalDeductions - b.deductions.acompte, 2);
const autresDeductionsTotaux = (t: Totaux) => arrondir(t.deductions - t.acomptes, 2);

function CellulesTotaux({ t }: { t: Totaux }) {
  return (
    <>
      <td className="nombre">{ha(t.surface)}</td>
      <td className="nombre">{formaterEuros(t.fermage)}</td>
      <td className="nombre">{parHa(t.fermageParHa)}</td>
      <td className="nombre">
        <Montant valeur={t.taxes} />
      </td>
      <td className="nombre">{formaterEuros(t.acomptes)}</td>
      <td className="nombre">{formaterEuros(autresDeductionsTotaux(t))}</td>
      <td className="nombre">
        <Montant valeur={t.resteDu} fort />
      </td>
    </>
  );
}

export function Recapitulatif({
  resultat,
  allerAuDossier,
}: {
  resultat: ResultatDossier;
  allerAuDossier: AllerAuDossier;
}) {
  const disponibles = resultatsDisponibles(resultat);
  const proprietaire = nomAffiche(resultat.bailleur, "");
  const { annee, totaux } = resultat;
  return (
    <section className="card recapitulatif" aria-labelledby="titre-recap">
      {/* Récapitulatif imprimé en paysage : style actif seulement sur cet onglet. */}
      <style>{"@page { size: A4 landscape; }"}</style>
      <div className="no-print">
        <h2 id="titre-recap">Récapitulatif de la propriété</h2>
        <p className="intro">
          Les fermages et charges de l'année pour toute la propriété, par
          exploitant et par commune. Document destiné au propriétaire, utile
          notamment pour sa déclaration de revenus fonciers.
        </p>
        {!disponibles ? (
          <ResultatsIndisponibles resultat={resultat} allerAuDossier={allerAuDossier} />
        ) : (
          <>
            <div className="detail-actions">
              <button type="button" className="btn-imprimer" onClick={() => window.print()}>
                Imprimer le récapitulatif
              </button>
              <AideImpression />
            </div>
          </>
        )}
      </div>

      {disponibles && (
        <div className="recap-document">
          <div className="detail-entete">
            <div>
              <p className="detail-titre">Récapitulatif des fermages et charges {annee}</p>
              {proprietaire && <p className="detail-reference">Propriétaire : {proprietaire}</p>}
            </div>
            <p className="detail-date">Échéance du {dateEnLettres(resultat.echeance)}</p>
          </div>

          <p className="recap-sous-titre">Par exploitant</p>
          <div className="tableau-scroll tableau-libre">
            <table className="tableau-dossier tableau-recap">
              <thead>
                <tr>
                  <th>Exploitant</th>
                  <th>Commune</th>
                  <th className="nombre">Surface (ha)</th>
                  <th className="nombre">Fermage {annee}</th>
                  <th className="nombre">Fermage à l'hectare</th>
                  <th className="nombre">Taxes imputées</th>
                  <th className="nombre">Acomptes versés</th>
                  <th className="nombre">Dégrèvements et autres déductions</th>
                  <th className="nombre">Reste à verser</th>
                </tr>
              </thead>
              <tbody>
                {resultat.parExploitant.map((g) => (
                  <Fragment key={g.exploitant.id}>
                    {g.baux.map((b, i) => (
                      <tr key={b.bail.id}>
                        <td>{i === 0 ? nomExploitantDe(b) : ""}</td>
                        <td>{nomCommuneDe(b)}</td>
                        <td className="nombre">{ha(b.surface)}</td>
                        <td className="nombre">{formaterEuros(b.fermage)}</td>
                        <td className="nombre">{parHa(b.fermageParHa)}</td>
                        <td className="nombre">
                          <Montant valeur={b.totalTaxes} />
                        </td>
                        <td className="nombre">{formaterEuros(b.deductions.acompte)}</td>
                        <td className="nombre">{formaterEuros(autresDeductionsBail(b))}</td>
                        <td className="nombre">
                          <Montant valeur={b.resteDu} />
                        </td>
                      </tr>
                    ))}
                    {g.baux.length > 1 && (
                      <tr className="ligne-sous-total">
                        <td colSpan={2}>Total {nomExploitantDe(g.baux[0])}</td>
                        <CellulesTotaux t={g.totaux} />
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total de la propriété</td>
                  <CellulesTotaux t={totaux} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="recap-bloc">
          <p className="recap-sous-titre">Par commune</p>
          <div className="tableau-scroll tableau-libre">
            <table className="tableau-dossier tableau-recap">
              <thead>
                <tr>
                  <th>Commune</th>
                  <th className="nombre">Exploitants</th>
                  <th className="nombre">Surface (ha)</th>
                  <th className="nombre">Fermages {annee}</th>
                  <th className="nombre">Fermage à l'hectare</th>
                  <th className="nombre">Taxes imputées</th>
                  <th className="nombre">Reste à verser</th>
                </tr>
              </thead>
              <tbody>
                {resultat.parCommune.map((g) => (
                  <tr key={g.commune.id}>
                    <td>{nomCommuneDe(g.baux[0])}</td>
                    <td className="nombre">{nombreExploitants(g.baux)}</td>
                    <td className="nombre">{ha(g.totaux.surface)}</td>
                    <td className="nombre">{formaterEuros(g.totaux.fermage)}</td>
                    <td className="nombre">{parHa(g.totaux.fermageParHa)}</td>
                    <td className="nombre">
                      <Montant valeur={g.totaux.taxes} />
                    </td>
                    <td className="nombre">
                      <Montant valeur={g.totaux.resteDu} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="nombre">{nombreExploitants(resultat.baux)}</td>
                  <td className="nombre">{ha(totaux.surface)}</td>
                  <td className="nombre">{formaterEuros(totaux.fermage)}</td>
                  <td className="nombre">{parHa(totaux.fermageParHa)}</td>
                  <td className="nombre">
                    <Montant valeur={totaux.taxes} />
                  </td>
                  <td className="nombre">
                    <Montant valeur={totaux.resteDu} fort />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          </div>

          <p className="detail-pied">
            Fermages réévalués selon l'indice national des fermages ; taxes
            imputées aux preneurs calculées sur le revenu cadastral de chaque
            exploitant (montant négatif : réduction en faveur du preneur).
            Reste à verser = fermage + taxes − acomptes, dégrèvements,
            indemnités et autres déductions. Totaux = somme des montants
            arrondis. Document indicatif établi par le calculateur de fermage
            de la Fédération Nationale de la Propriété Privée Rurale.
          </p>
        </div>
      )}
    </section>
  );
}
