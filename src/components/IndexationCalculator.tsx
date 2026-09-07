import { useMemo, useState } from "react";
import {
  revaloriserFermage,
  historiqueRevalorisation,
} from "../lib/fermage";
import { INDICES_FERMAGE, ANNEE_MAX, ANNEE_MIN } from "../data/indices";
import type { EtatFermageBase } from "../lib/etatFermageBase";
import {
  formaterEuros,
  formaterNombre,
  formaterPourcentage,
} from "../lib/format";

const ANNEES = INDICES_FERMAGE.map((i) => i.annee);

export function IndexationCalculator({
  fermageBase: { loyer, setLoyer, anneeDepart, setAnneeDepart, anneeArrivee, setAnneeArrivee },
}: {
  fermageBase: EtatFermageBase;
}) {
  const [afficherHistorique, setAfficherHistorique] = useState(false);

  const calcul = useMemo(() => {
    const montant = Number(loyer.replace(",", "."));
    if (!loyer.trim() || Number.isNaN(montant)) {
      return { erreur: "Saisissez un montant de loyer valide." };
    }
    try {
      const resultat = revaloriserFermage(montant, anneeDepart, anneeArrivee);
      const historique = historiqueRevalorisation(
        montant,
        Math.min(anneeDepart, anneeArrivee),
        Math.max(anneeDepart, anneeArrivee),
      );
      return { resultat, historique };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
    }
  }, [loyer, anneeDepart, anneeArrivee]);

  return (
    <section className="card" aria-labelledby="titre-indexation">
      <h2 id="titre-indexation">Réévaluation annuelle du fermage</h2>
      <p className="intro">
        Calculez le nouveau montant d'un fermage en appliquant l'indice national
        des fermages : <strong>nouveau loyer = loyer initial × (indice de
        l'année d'arrivée / indice de l'année de départ)</strong>.
      </p>

      <div className="grille">
        <div className="champ">
          <label htmlFor="loyer">Loyer de référence (€/an)</label>
          <span className="aide">Montant du fermage l'année de départ</span>
          <input
            id="loyer"
            inputMode="decimal"
            value={loyer}
            onChange={(e) => setLoyer(e.target.value)}
            placeholder="ex. 1 250"
          />
        </div>

        <div className="champ">
          <label htmlFor="annee-depart">Année de départ</label>
          <span className="aide">Année de l'indice de référence</span>
          <select
            id="annee-depart"
            value={anneeDepart}
            onChange={(e) => setAnneeDepart(Number(e.target.value))}
          >
            {ANNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="champ">
          <label htmlFor="annee-arrivee">Année de calcul</label>
          <span className="aide">Année du nouveau loyer</span>
          <select
            id="annee-arrivee"
            value={anneeArrivee}
            onChange={(e) => setAnneeArrivee(Number(e.target.value))}
          >
            {ANNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {"erreur" in calcul && calcul.erreur ? (
        <p className="erreur">{calcul.erreur}</p>
      ) : (
        "resultat" in calcul &&
        calcul.resultat && (
          <>
            <div className="resultat">
              <div className="montant-principal">
                {formaterEuros(calcul.resultat.loyer)}
                <span style={{ fontSize: "1rem", fontWeight: 600 }}> /an</span>
              </div>
              <div className="legende">
                Loyer réévalué pour {anneeArrivee} (départ {anneeDepart}) —
                variation totale{" "}
                <strong
                  className={
                    calcul.resultat.variationPct >= 0 ? "pos" : "neg"
                  }
                >
                  {formaterPourcentage(calcul.resultat.variationPct)}
                </strong>
              </div>

              <div className="detail-calcul">
                Détail :{" "}
                <code>
                  {formaterEuros(calcul.resultat.loyerInitial)} ×{" "}
                  {formaterNombre(calcul.resultat.indiceArrivee)} ÷{" "}
                  {formaterNombre(calcul.resultat.indiceDepart)}
                </code>{" "}
                = {formaterEuros(calcul.resultat.loyer)}
              </div>

              <button
                type="button"
                className="lien-toggle"
                onClick={() => setAfficherHistorique((v) => !v)}
                style={{
                  marginTop: "0.9rem",
                  background: "none",
                  border: "none",
                  color: "var(--vert)",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                {afficherHistorique
                  ? "Masquer l'historique année par année"
                  : "Afficher l'historique année par année"}
              </button>
            </div>

            {afficherHistorique && calcul.historique && (
              <div className="tableau-scroll" style={{ marginTop: "1rem" }}>
                <table>
                  <caption>
                    Évolution du loyer de {Math.min(anneeDepart, anneeArrivee)}{" "}
                    à {Math.max(anneeDepart, anneeArrivee)}.
                  </caption>
                  <thead>
                    <tr>
                      <th>Année</th>
                      <th>Indice</th>
                      <th>Variation</th>
                      <th>Loyer (€/an)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcul.historique.map((ligne) => (
                      <tr
                        key={ligne.annee}
                        className={
                          ligne.annee === anneeArrivee ? "surligne" : undefined
                        }
                      >
                        <td>{ligne.annee}</td>
                        <td>{formaterNombre(ligne.indice)}</td>
                        <td
                          className={
                            ligne.variationAnnuellePct == null
                              ? undefined
                              : ligne.variationAnnuellePct >= 0
                                ? "pos"
                                : "neg"
                          }
                        >
                          {ligne.variationAnnuellePct == null
                            ? "—"
                            : formaterPourcentage(ligne.variationAnnuellePct)}
                        </td>
                        <td>{formaterEuros(ligne.loyer)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}

      <p className="intro" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
        Indices disponibles de {ANNEE_MIN} à {ANNEE_MAX}.
      </p>
    </section>
  );
}
