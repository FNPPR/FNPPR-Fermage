import { useState } from "react";
import { nomAffiche } from "../lib/dossier";
import {
  LIBELLES_TAXES,
  taxesUtiles,
  totalTaxe,
  type GroupeCommune,
  type ResultatBail,
  type ResultatDossier,
} from "../lib/calculDossier";
import {
  formaterEuros,
  formaterEurosPrecis,
  formaterTaux,
} from "../lib/format";
import { parseNombre } from "../lib/format";
import {
  AideImpression,
  AlerteErreurs,
  DossierVide,
  Montant,
  dateEnLettres,
  nomCommuneDe,
  nomExploitantDe,
} from "./communDossier";

/** « −41,59 € − 3,08 € + 76,80 € = 32,13 € » (lignes non nulles). */
function addition(montants: number[], total: number): string {
  const termes = montants.filter((m) => m !== 0);
  if (termes.length === 0) return formaterEuros(0);
  const texte = termes
    .map((m, i) => {
      const v = formaterEuros(Math.abs(m));
      if (i === 0) return m < 0 ? `−${v}` : v;
      return m < 0 ? ` − ${v}` : ` + ${v}`;
    })
    .join("");
  return termes.length === 1 ? texte : `${texte} = ${formaterEuros(total)}`;
}

/** Taux saisi (texte, en %) affiché proprement : « 42,89 % ». */
function taux(saisie: string): string {
  const v = parseNombre(saisie);
  return Number.isFinite(v) ? formaterTaux(v / 100) : saisie;
}

function TableauCommune({ groupe }: { groupe: GroupeCommune }) {
  const { commune, baux } = groupe;
  const lignes = taxesUtiles(baux);
  const plusieurs = baux.length > 1;
  return (
    <div className="taxe-bloc">
      <div className="taxe-bloc-titre">
        <span>{nomCommuneDe(baux[0])}</span>
      </div>
      <p className="aide-bloc">
        Taux votés : commune {taux(commune.tauxCommunal)}, intercommunalité{" "}
        {taux(commune.tauxIntercommunal)}, chambre d'agriculture {taux(commune.tauxChambre)}, GEMAPI{" "}
        {taux(commune.tauxGemapi)} ; frais de rôle {taux(commune.fraisRoleTaxesFoncieres)} (taxes
        foncières et GEMAPI) et {taux(commune.fraisRoleChambre)} (chambre d'agriculture).
      </p>
      <div className="tableau-scroll tableau-libre">
        <table className="tableau-dossier">
          <thead>
            <tr>
              <th>Imputé au preneur</th>
              {baux.map((b) => (
                <th key={b.bail.id} className="nombre">
                  {nomExploitantDe(b)}
                </th>
              ))}
              {plusieurs && <th className="nombre">Total</th>}
            </tr>
          </thead>
          <tbody>
            <tr className="ligne-info">
              <td>Revenu cadastral actualisé</td>
              {baux.map((b) => (
                <td key={b.bail.id} className="nombre">
                  {formaterEurosPrecis(b.revenuCadastral)}
                </td>
              ))}
              {plusieurs && <td />}
            </tr>
            <tr className="ligne-info">
              <td>Taux du bail (taxes foncières / GEMAPI)</td>
              {baux.map((b) => (
                <td key={b.bail.id} className="nombre">
                  {taux(b.bail.tauxBail)} / {taux(b.bail.tauxBailGemapi)}
                </td>
              ))}
              {plusieurs && <td />}
            </tr>
            {lignes.length === 0 && (
              <tr>
                <td colSpan={baux.length + (plusieurs ? 2 : 1)}>Aucune taxe imputée au preneur.</td>
              </tr>
            )}
            {lignes.map((id) => (
              <tr key={id}>
                <td>{LIBELLES_TAXES[id]}</td>
                {baux.map((b) => (
                  <td key={b.bail.id} className="nombre">
                    <Montant valeur={b.taxes.find((t) => t.id === id)?.impute ?? 0} />
                  </td>
                ))}
                {plusieurs && (
                  <td className="nombre">
                    <Montant valeur={totalTaxe(baux, id)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total imputé au preneur</td>
              {baux.map((b) => (
                <td key={b.bail.id} className="nombre">
                  <Montant valeur={b.totalTaxes} fort />
                </td>
              ))}
              {plusieurs && (
                <td className="nombre">
                  <Montant valeur={groupe.totaux.taxes} fort />
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function DetailBail({ b, revalorisation }: { b: ResultatBail; revalorisation: number }) {
  const lignes = b.taxes.filter((t) => t.impute !== 0 || (t.montantTotal ?? 0) !== 0);
  // Remarques (montant négatif, frais de rôle non appliqués…) : une seule fois par terres louées.
  const remarques = [
    ...new Set(
      lignes.flatMap((t) => t.detail?.remarques ?? []).filter((r) => !r.includes("à 0 %")),
    ),
  ];
  return (
    <div className="detail-ligne">
      <p className="detail-ligne-titre">
        {nomExploitantDe(b)} <span className="detail-methode">— {nomCommuneDe(b)}</span>
      </p>
      <p className="detail-remarque" style={{ fontStyle: "normal" }}>
        Revenu cadastral actualisé = {formaterEurosPrecis(b.revenuCadastralPrecedent)} × (1 +{" "}
        {formaterTaux(revalorisation)}) ={" "}
        {formaterEurosPrecis(b.revenuCadastral)}
      </p>
      {lignes.length === 0 && <p className="detail-remarque">Aucune taxe pour ces terres.</p>}
      {lignes.map((t) =>
        t.detail ? (
          <div className="detail-etape" key={t.id}>
            <p className="detail-formule">
              <strong>{t.libelle}</strong>
            </p>
            {t.detail.etapes.map((e) => (
              <div key={e.libelle}>
                <p className="detail-formule">
                  {e.libelle} = {e.formule}
                </p>
                <p className="detail-operation">
                  = {e.calcul} = <strong>{formaterEuros(e.resultat)}</strong>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="detail-etape" key={t.id}>
            <p className="detail-formule">
              <strong>{t.libelle}</strong>
            </p>
            <p className="detail-operation">
              Montant saisi = <strong>{formaterEuros(t.impute)}</strong>
            </p>
          </div>
        ),
      )}
      {remarques.map((r) => (
        <p className="detail-remarque" key={r}>
          {r}
        </p>
      ))}
      <p className="detail-operation" style={{ marginTop: "0.3rem" }}>
        <strong>Total imputé au preneur</strong> ={" "}
        {addition(
          b.taxes.map((t) => t.impute),
          b.totalTaxes,
        )}
      </p>
    </div>
  );
}

function DetailCalculs({ resultat, afficheALEcran }: { resultat: ResultatDossier; afficheALEcran: boolean }) {
  const bailleur = nomAffiche(resultat.bailleur, "");
  return (
    <div id="detail-calculs" className={`detail-page${afficheALEcran ? "" : " masque-ecran"}`}>
      <div className="detail-entete">
        <div>
          <p className="detail-titre">
            Détail des calculs — répartition des taxes foncières et assimilées {resultat.annee}
          </p>
          {bailleur && <p className="detail-reference">Propriétaire : {bailleur}</p>}
        </div>
        <p className="detail-date">Échéance du {dateEnLettres(resultat.echeance)}</p>
      </div>
      <p className="detail-parametres">
        Dégrèvement de la TFNB : {formaterTaux(resultat.tauxDegrevement)} (loi n° 2025-127 du
        14/02/2025). Revenus cadastraux de l'an dernier (relevés de propriété) revalorisés de{" "}
        {formaterTaux(resultat.revalorisation)}.
      </p>
      {resultat.parCommune.map((g) => (
        <div key={g.commune.id} className="detail-commune">
          <p className="detail-titre-commune">{nomCommuneDe(g.baux[0])}</p>
          {g.baux.map((b) => (
            <DetailBail key={b.bail.id} b={b} revalorisation={resultat.revalorisation} />
          ))}
        </div>
      ))}
      <p className="detail-pied">
        Chaque calcul part directement des valeurs saisies, sans arrondi
        intermédiaire ; seuls les résultats sont arrondis au centime, et les
        totaux sont la somme des lignes arrondies. Montant négatif : en faveur
        du preneur (réduction de fermage). Calcul indicatif, établi selon les
        clauses des baux renseignées. Fédération Nationale de la Propriété
        Privée Rurale.
      </p>
    </div>
  );
}

export function TaxesDossier({
  resultat,
  allerAuDossier,
}: {
  resultat: ResultatDossier;
  allerAuDossier: () => void;
}) {
  const [afficherDetail, setAfficherDetail] = useState(false);
  return (
    <section className="card" aria-labelledby="titre-taxe">
      <div className="no-print">
        <h2 id="titre-taxe">Répartition des taxes foncières et assimilées</h2>
        <p className="intro">
          Le <strong>bailleur</strong> est redevable du paiement des taxes
          foncières sur les propriétés bâties et non bâties, mais le bail à
          ferme et/ou le bail-type départemental prévoient que le{" "}
          <strong>preneur</strong> en rembourse une quote-part. Depuis 2006,
          les terres agricoles sont affectées d'une <strong>exonération</strong>{" "}
          des bases communale et intercommunale au profit exclusif du preneur ;
          la loi n°2025-127 du 14/02/2025 l'a portée de 20 % à{" "}
          <strong>30 %</strong>. Les montants ci-dessous sont calculés, commune
          par commune, à partir du <strong>revenu cadastral propre à chaque
          exploitant</strong> : c'est la méthode exacte lorsque plusieurs
          exploitants se partagent un même avis d'imposition.
        </p>

        {resultat.baux.length === 0 ? (
          <DossierVide resultat={resultat} allerAuDossier={allerAuDossier} />
        ) : (
          <>
            <AlerteErreurs resultat={resultat} allerAuDossier={allerAuDossier} />
            <p className="aide-bloc">
              Année {resultat.annee} · dégrèvement {formaterTaux(resultat.tauxDegrevement)} · revenus
              cadastraux revalorisés de {formaterTaux(resultat.revalorisation)} · montant négatif = en
              faveur du preneur (réduction de fermage).
            </p>
            {resultat.parCommune.map((g) => (
              <TableauCommune key={g.commune.id} groupe={g} />
            ))}
            <div className="resultat">
              <div className="legende" style={{ marginBottom: "0.4rem" }}>
                Total des taxes imputées aux preneurs, toutes communes
              </div>
              <div className="montant-principal">
                <Montant valeur={resultat.totaux.taxes} />
              </div>
              <div className="legende">
                Détail par exploitant et par commune dans les appels de fermage
                et le récapitulatif.
              </div>
            </div>
          </>
        )}
      </div>

      {resultat.baux.length > 0 && (
        <>
          <div className="no-print detail-actions">
            <button
              type="button"
              className="btn-ajouter"
              onClick={() => setAfficherDetail((v) => !v)}
              aria-expanded={afficherDetail}
              aria-controls="detail-calculs"
            >
              {afficherDetail ? "Masquer" : "Afficher"} le détail des calculs
            </button>
            <button type="button" className="btn-imprimer" onClick={() => window.print()}>
              Imprimer le détail des calculs
            </button>
            <AideImpression />
          </div>
          <DetailCalculs resultat={resultat} afficheALEcran={afficherDetail} />
        </>
      )}

      <div className="no-print">
        <details className="explication">
          <summary>Comment ce calcul fonctionne-t-il&nbsp;?</summary>
          <p>
            Pour chaque exploitant et dans chaque commune, le calcul part du{" "}
            <strong>revenu cadastral de l'an dernier</strong> propre aux
            parcelles qui lui sont louées (relevé de propriété, et non l'avis
            d'impôt, déjà minoré de 30 %), revalorisé du coefficient de
            l'année (0,8 % en 2026).
          </p>
          <p className="formule">
            Taxe foncière (parts communale et intercommunale) :<br />
            Imputé au preneur = Revenu cadastral × Taux voté × (Taux du bail −
            30 %) × (1 + frais de rôle, seulement si le résultat est positif)
          </p>
          <ul>
            <li>
              <strong>Taux du bail &lt; 30 %</strong> : résultat négatif →{" "}
              <em>réduction du fermage</em> en faveur du preneur.
            </li>
            <li>
              <strong>Taux du bail = 30 %</strong> : aucun versement réciproque.
            </li>
            <li>
              <strong>Taux du bail &gt; 30 %</strong> : remboursement du preneur
              au bailleur, majoré des frais de rôle.
            </li>
          </ul>
          <p className="formule">
            Chambre d'agriculture :<br />
            Imputé au preneur = Revenu cadastral × Taux voté × 50 % × (1 + frais
            de rôle)
          </p>
          <p>
            Le taux de 50 % ne résulte pas d'une clause du bail : c'est une
            disposition d'ordre public (art. 1604 du Code général des impôts
            et art. L514-1 du Code rural et de la pêche maritime), non
            négociable entre les parties.
          </p>
          <p className="formule">
            Taxe GEMAPI :<br />
            Imputé au preneur = Revenu cadastral × 70 % × Taux voté × Taux du
            bail GEMAPI × (1 + frais de rôle)
          </p>
          <p>
            La taxe GEMAPI est calculée par l'administration sur une base déjà
            réduite à 70 %, mais elle n'a pas le caractère d'une taxe foncière
            : sa répartition ne retranche pas les 30 % de dégrèvement.
            Imposition récente : vérifiez que le bail prévoit bien son
            remboursement ; à défaut, laissez son taux du bail à 0 %.
          </p>
          <p className="formule">
            Remembrement, taxes syndicales :<br />
            Imputé au preneur = Montant à l'hectare × Surface louée × Part du
            preneur
          </p>
          <p>
            <strong>Arrondis.</strong> Chaque calcul part des valeurs saisies,
            sans arrondi intermédiaire. Seul le résultat de chaque ligne est
            arrondi au centime (arrondi commercial, comme la fonction ARRONDI
            d'Excel), et chaque total est la somme des lignes arrondies : un
            appel de fermage est ainsi toujours égal à la somme de ses lignes.
          </p>
        </details>
        <p className="intro" style={{ marginTop: "1.25rem", marginBottom: 0, fontSize: "0.82rem" }}>
          Source : Fédération Nationale de la Propriété Privée Rurale — loi
          n°2025-127 du 14/02/2025, art. L415-3 du Code rural et de la pêche
          maritime. Calcul indicatif, à adapter aux clauses de vos baux.
        </p>
      </div>
    </section>
  );
}
