import { useMemo, useState } from "react";
import { convertirDenrees, UNITES_DENREES } from "../lib/fermage";
import { formaterEuros, formaterNombre } from "../lib/format";

export function DenreesConverter() {
  const [quantite, setQuantite] = useState("50");
  const [uniteId, setUniteId] = useState(UNITES_DENREES[0].id);
  const [prix, setPrix] = useState("18.50");

  const uniteLibelle =
    UNITES_DENREES.find((u) => u.id === uniteId)?.libelle ?? "denrée";

  const calcul = useMemo(() => {
    const q = Number(quantite.replace(",", "."));
    const p = Number(prix.replace(",", "."));
    if (Number.isNaN(q) || Number.isNaN(p)) {
      return { erreur: "Renseignez une quantité et un prix valides." };
    }
    try {
      return { resultat: convertirDenrees(q, p, uniteLibelle) };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
    }
  }, [quantite, prix, uniteLibelle]);

  return (
    <section className="card" aria-labelledby="titre-denrees">
      <h2 id="titre-denrees">Conversion d'un bail en denrées</h2>
      <p className="intro">
        Les baux antérieurs à la réforme de 2010 pouvaient être exprimés en
        quantités de denrées (quintaux de blé, hectolitres de vin…). Le montant
        en euros s'obtient en multipliant la quantité par le{" "}
        <strong>prix unitaire de référence</strong> fixé par l'arrêté
        préfectoral. Ce montant peut ensuite être réévalué via l'indice national
        (onglet « Réévaluation »).
      </p>
      <p className="info" style={{ marginBottom: "1.25rem" }}>
        ℹ️ Le fermage en denrées a été supprimé pour la généralité des baux en
        1994 : cet outil ne conserve un réel intérêt que pour les{" "}
        <strong>baux viticoles</strong> dont la clause de paiement en nature
        (hectolitres de vin) subsiste encore.
      </p>

      <div className="grille">
        <div className="champ">
          <label htmlFor="quantite">Quantité (denrée/an)</label>
          <input
            id="quantite"
            inputMode="decimal"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="unite">Denrée</label>
          <select
            id="unite"
            value={uniteId}
            onChange={(e) => setUniteId(e.target.value)}
          >
            {UNITES_DENREES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.libelle}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="prix">Prix unitaire de référence (€)</label>
          <span className="aide">Prix officiel de la denrée</span>
          <input
            id="prix"
            inputMode="decimal"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
          />
        </div>
      </div>

      {"erreur" in calcul && calcul.erreur ? (
        <p className="erreur">{calcul.erreur}</p>
      ) : (
        "resultat" in calcul &&
        calcul.resultat && (
          <div className="resultat">
            <div className="montant-principal">
              {formaterEuros(calcul.resultat.montant)}
              <span style={{ fontSize: "1rem", fontWeight: 600 }}> /an</span>
            </div>
            <div className="legende">Montant annuel du fermage en euros</div>
            <div className="detail-calcul">
              Détail :{" "}
              <code>
                {formaterNombre(calcul.resultat.quantite)} ×{" "}
                {formaterEuros(calcul.resultat.prixUnitaire)}
              </code>{" "}
              ({calcul.resultat.uniteLibelle}) ={" "}
              {formaterEuros(calcul.resultat.montant)}
            </div>
          </div>
        )
      )}
    </section>
  );
}
