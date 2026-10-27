import { useMemo, useState } from "react";
import {
  coefficientCorrecteur,
  revaloriserRevenuCadastral,
  type ModeAssiette,
} from "../lib/taxeFonciere";
import {
  LIBELLES_MODE,
  additionTotalPreneur,
  calculerToutesLesLignes,
  calculerUneLigne,
  ligneRenseignee,
  lireParametresTaxes,
  tauxBailEffectif,
  type CalculLigne,
  type CalculTaxe,
  type LigneUI,
} from "../lib/taxeFonciereLignes";
import type { EtatTaxeFonciere } from "../lib/etatTaxeFonciere";
import {
  formaterEuros,
  formaterEurosPrecis,
  formaterNombrePrecis,
  formaterTaux,
  parseNombre as num,
} from "../lib/format";

/** Libellés courts des méthodes, pour l'en-tête de chaque taxe au détail imprimé. */
const METHODE_COURTE: Record<ModeAssiette, string> = {
  revenuCadastral: "revenu cadastral de l'exploitant (méthode rigoureuse)",
  montantGlobal: "montant global de l'avis (approximation)",
  hectare: "taux à l'hectare",
};

const dateDuJour = () =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

/** Écrit un nombre comme une saisie française, sans l'arrondir (1860.768 → « 1860,768 »). */
function enSaisie(valeur: number): string {
  return String(Number(valeur.toPrecision(12))).replace(".", ",");
}

/**
 * Petit outil d'actualisation du revenu cadastral de l'année précédente.
 *
 * Volontairement limité à UNE seule année : on part du revenu cadastral de
 * l'année précédente et on lui applique le coefficient de revalorisation des
 * bases voté pour l'année en cours — pas de composition sur plusieurs années,
 * pour rester au plus près du dernier relevé reçu. Le résultat, non arrondi
 * (comme dans la matrice FNPPR), peut être reporté d'un clic dans le revenu
 * cadastral de l'exploitant.
 */
function OutilRevalorisation({ onReporter }: { onReporter: (valeur: string) => void }) {
  const [base, setBase] = useState("");
  const [taux, setTaux] = useState("0,8");

  const resultat = useMemo(() => {
    if (!base.trim()) return null;
    const b = num(base);
    const t = num(taux) / 100;
    if (![b, t].every(Number.isFinite)) {
      return { erreur: "Renseignez des valeurs numériques valides." };
    }
    try {
      return { base: b, taux: t, valeur: revaloriserRevenuCadastral(b, t, 1) };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
    }
  }, [base, taux]);

  return (
    <details className="explication" style={{ marginBottom: "1.25rem" }}>
      <summary>Outil : actualiser le revenu cadastral de l'année précédente</summary>
      <p>
        Le revenu cadastral doit être réactualisé chaque année par
        l'application du <strong>coefficient de revalorisation forfaitaire
        des bases</strong>, voté en loi de finances : 0,8 % pour 2026
        (coefficient 1,008), à vérifier et corriger chaque année. Le revenu
        cadastral propre à un exploitant est en général le{" "}
        <strong>même montant</strong> pour la part communale, la part
        intercommunale, la chambre d'agriculture et la taxe GEMAPI : seuls le
        taux voté et l'application ou non du dégrèvement diffèrent d'une taxe
        à l'autre.
      </p>
      <div className="grille">
        <div className="champ">
          <label htmlFor="rc-base">Revenu cadastral de l'année précédente (€)</label>
          <span className="aide">Relevé de propriété de l'an dernier</span>
          <input
            id="rc-base"
            inputMode="decimal"
            placeholder="ex. 940"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="rc-taux">Revalorisation des bases (%)</label>
          <span className="aide">0,8 % pour 2026</span>
          <input
            id="rc-taux"
            inputMode="decimal"
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
          />
        </div>
      </div>
      {resultat &&
        ("erreur" in resultat ? (
          <p className="erreur">{resultat.erreur}</p>
        ) : (
          <div className="formule" style={{ marginTop: "0.75rem" }}>
            Revenu cadastral actualisé : {formaterEurosPrecis(resultat.base)} × (1 +{" "}
            {formaterTaux(resultat.taux)}) ={" "}
            <strong>{formaterEurosPrecis(resultat.valeur.revenuCadastralExact)}</strong>
            <div>
              <button
                type="button"
                className="btn-ajouter"
                style={{ margin: "0.6rem 0 0" }}
                onClick={() => onReporter(enSaisie(resultat.valeur.revenuCadastralExact))}
              >
                Reporter dans le revenu cadastral de l'exploitant
              </button>
            </div>
          </div>
        ))}
    </details>
  );
}

/** Une ligne de taxe : saisie, puis calcul chiffré et résultat. */
function BlocLigne({
  ligne,
  calcul,
  revenuCadastral,
  maj,
}: {
  ligne: LigneUI;
  /** Résultat de la ligne, ou null si les paramètres communs sont invalides. */
  calcul: CalculLigne | null;
  revenuCadastral: number;
  maj: (id: string, champ: keyof LigneUI, valeur: string) => void;
}) {
  const approximation =
    ligne.modeAssiette === "montantGlobal" &&
    ligne.modesPossibles.includes("revenuCadastral");

  return (
    <div className="taxe-bloc">
      <div className="taxe-bloc-titre">
        <span>{ligne.libelle}</span>
        <span className={`badge ${ligne.assietteDegrevee ? "conforme" : "inferieur"}`}>
          {ligne.assietteDegrevee ? "Base dégrevée · réforme 2025" : "taxe annexe"}
        </span>
      </div>

      {ligne.note && <p className="intro note-ligne">ℹ️ {ligne.note}</p>}

      {ligne.modesPossibles.length > 1 && (
        <div className="champ" style={{ marginBottom: "0.75rem" }}>
          <label htmlFor={`mode-${ligne.id}`}>Méthode de calcul</label>
          <select
            id={`mode-${ligne.id}`}
            value={ligne.modeAssiette}
            onChange={(e) => maj(ligne.id, "modeAssiette", e.target.value)}
          >
            {ligne.modesPossibles.map((m) => (
              <option key={m} value={m}>
                {LIBELLES_MODE[m]}
              </option>
            ))}
          </select>
        </div>
      )}

      {approximation && (
        <p className="note-approximation">
          ⚠️ Approximation : fiable seulement si l'avis ne concerne qu'un
          exploitant. Avec plusieurs exploitants, choisissez la méthode du
          revenu cadastral.
        </p>
      )}

      <div className="grille">
        {ligne.modeAssiette === "montantGlobal" && (
          <>
            <div className="champ">
              <label htmlFor={`ma-${ligne.id}`}>Montant appelé (€)</label>
              <span className="aide">{ligne.aideMontantAppele}</span>
              <input
                id={`ma-${ligne.id}`}
                inputMode="decimal"
                value={ligne.montantAppele}
                onChange={(e) => maj(ligne.id, "montantAppele", e.target.value)}
              />
            </div>
            <div className="champ">
              <label htmlFor={`pe-${ligne.id}`}>Part exploitée (%)</label>
              <span className="aide">{ligne.aidePartExploitee}</span>
              <input
                id={`pe-${ligne.id}`}
                inputMode="decimal"
                value={ligne.partExploitant}
                onChange={(e) => maj(ligne.id, "partExploitant", e.target.value)}
              />
            </div>
          </>
        )}

        {ligne.modeAssiette === "revenuCadastral" && (
          <div className="champ">
            <label htmlFor={`ti-${ligne.id}`}>Taux voté (%)</label>
            <span className="aide">
              {ligne.aideTauxImposition}. Appliqué au revenu cadastral de
              l'exploitant ({formaterEurosPrecis(revenuCadastral)}).
            </span>
            <input
              id={`ti-${ligne.id}`}
              inputMode="decimal"
              placeholder="ex. 43,89"
              value={ligne.tauxImposition}
              onChange={(e) => maj(ligne.id, "tauxImposition", e.target.value)}
            />
          </div>
        )}

        {ligne.modeAssiette === "hectare" && (
          <>
            <div className="champ">
              <label htmlFor={`th-${ligne.id}`}>Taux à l'hectare (€/ha)</label>
              <span className="aide">{ligne.aideTauxImposition}</span>
              <input
                id={`th-${ligne.id}`}
                inputMode="decimal"
                value={ligne.tauxHectare}
                onChange={(e) => maj(ligne.id, "tauxHectare", e.target.value)}
              />
            </div>
            <div className="champ">
              <label htmlFor={`sl-${ligne.id}`}>Surface louée (ha)</label>
              <span className="aide">Surface donnée à bail à cet exploitant</span>
              <input
                id={`sl-${ligne.id}`}
                inputMode="decimal"
                value={ligne.surfaceLouee}
                onChange={(e) => maj(ligne.id, "surfaceLouee", e.target.value)}
              />
            </div>
          </>
        )}

        {ligne.tauxBailLegal ? (
          <div className="champ">
            <label htmlFor={`tb-${ligne.id}`}>Part légale du preneur (%)</label>
            <span className="aide">Fixée par la loi, non modifiable</span>
            <input id={`tb-${ligne.id}`} value={tauxBailEffectif(ligne)} disabled />
          </div>
        ) : (
          <div className="champ">
            <label htmlFor={`tb-${ligne.id}`}>Taux du bail (%)</label>
            <span className="aide">Part remboursée par le preneur, prévue au bail</span>
            <input
              id={`tb-${ligne.id}`}
              inputMode="decimal"
              value={ligne.tauxBail}
              onChange={(e) => maj(ligne.id, "tauxBail", e.target.value)}
            />
          </div>
        )}
        <div className="champ">
          <label htmlFor={`fr-${ligne.id}`}>Frais de rôle (%)</label>
          <span className="aide">
            {ligne.methode === "tfnb"
              ? "Seulement si le taux du bail dépasse le dégrèvement"
              : "Frais de recouvrement"}
          </span>
          <input
            id={`fr-${ligne.id}`}
            inputMode="decimal"
            value={ligne.fraisDeRole}
            onChange={(e) => maj(ligne.id, "fraisDeRole", e.target.value)}
          />
        </div>
      </div>

      {calcul === null ? null : "erreur" in calcul ? (
        <p className="erreur" role="alert" style={{ marginBottom: 0 }}>
          {calcul.erreur}
        </p>
      ) : !ligneRenseignee({ ligne, ...calcul }) ? (
        <p className="taxe-resultat taxe-remarque" style={{ marginBottom: 0 }}>
          Aucun montant pour cette taxe : renseignez-la seulement si elle
          figure sur l'avis.
        </p>
      ) : (
        <div className="taxe-resultat taxe-calcul">
          {calcul.detail.etapes.map((etape) => {
            const imputeNegatif =
              etape.libelle === "Imputé au preneur" && etape.resultat < 0;
            return (
              <div className="taxe-etape" key={etape.libelle}>
                <span className="taxe-etape-formule">
                  {etape.libelle} = {etape.formule}
                </span>
                <span className="taxe-etape-calcul">
                  = {etape.calcul} ={" "}
                  <strong className={imputeNegatif ? "taxe-faveur" : undefined}>
                    {formaterEuros(etape.resultat)}
                  </strong>
                </span>
              </div>
            );
          })}
          {calcul.res.imputePreneur < 0 && (
            <span className="taxe-faveur">
              En faveur du preneur : réduction de fermage de{" "}
              {formaterEuros(-calcul.res.imputePreneur)}.
            </span>
          )}
          {calcul.detail.remarques
            .filter((r) => !r.startsWith("Taux du bail inférieur"))
            .map((r) => (
              <span className="taxe-remarque" key={r}>
                {r}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * Page « Détail des calculs » : chaque taxe avec sa formule et les valeurs
 * saisies, pour vérifier l'exactitude du calcul et en faire la démonstration
 * à l'adhérent. C'est la seule partie de l'onglet qui s'imprime.
 */
function DetailCalculs({
  calcul,
  referenceDossier,
  afficheALEcran,
}: {
  calcul: Extract<CalculTaxe, { resultats: unknown }>;
  referenceDossier: string;
  afficheALEcran: boolean;
}) {
  const lignesAvecMontant = calcul.resultats.filter(ligneRenseignee);
  const lignesSansMontant = calcul.resultats.filter((r) => !ligneRenseignee(r));
  const utiliseRC = calcul.resultats.some(
    (r) => r.ligne.modeAssiette === "revenuCadastral",
  );

  return (
    <div
      id="detail-calculs"
      className={`detail-page${afficheALEcran ? "" : " masque-ecran"}`}
    >
      <div className="detail-entete">
        <div>
          <p className="detail-titre">
            Détail des calculs — répartition des taxes foncières et assimilées
          </p>
          {referenceDossier.trim() && (
            <p className="detail-reference">{referenceDossier.trim()}</p>
          )}
        </div>
        <p className="detail-date">Édité le {dateDuJour()}</p>
      </div>

      <p className="detail-parametres">
        Dégrèvement de la TFNB : {formaterTaux(calcul.params.tauxDegrevement)}{" "}
        (loi n° 2025-127 du 14/02/2025).
        {utiliseRC && (
          <>
            {" "}
            Revenu cadastral de l'exploitant (relevé de propriété, actualisé) :{" "}
            {formaterEurosPrecis(calcul.revenuCadastral)}.
          </>
        )}
      </p>

      {lignesAvecMontant.length === 0 ? (
        <p>Aucune taxe renseignée pour le moment.</p>
      ) : (
        lignesAvecMontant.map(({ ligne, detail }) => (
          <div className="detail-ligne" key={ligne.id}>
            <p className="detail-ligne-titre">
              {ligne.libelle}{" "}
              <span className="detail-methode">— {METHODE_COURTE[ligne.modeAssiette]}</span>
            </p>
            {detail.etapes.map((etape) => (
              <div className="detail-etape" key={etape.libelle}>
                <p className="detail-formule">
                  {etape.libelle} = {etape.formule}
                </p>
                <p className="detail-operation">
                  = {etape.calcul} = <strong>{formaterEuros(etape.resultat)}</strong>
                </p>
              </div>
            ))}
            {detail.remarques.map((r) => (
              <p className="detail-remarque" key={r}>
                {r}
              </p>
            ))}
          </div>
        ))
      )}

      <div className="detail-total">
        <p>
          <strong>Total imputé au preneur</strong> ={" "}
          {additionTotalPreneur(calcul.resultats, calcul.totalPreneur)}
        </p>
        <p className="detail-sens">
          {calcul.totalPreneur > 0
            ? "Montant à rembourser par le preneur au bailleur."
            : calcul.totalPreneur < 0
              ? "Montant en faveur du preneur, à déduire du fermage."
              : "Aucun montant à régler au titre des taxes."}
        </p>
      </div>

      {lignesSansMontant.length > 0 && (
        <p className="detail-remarque">
          Sans montant : {lignesSansMontant.map((r) => r.ligne.libelle).join(", ")}.
        </p>
      )}

      <p className="detail-pied">
        Chaque calcul part directement des valeurs saisies, sans arrondi
        intermédiaire ; seuls les résultats sont arrondis au centime, et le
        total est la somme des lignes arrondies. Calcul indicatif, établi
        selon les clauses du bail renseignées. Fédération Nationale de la
        Propriété Privée Rurale.
      </p>
    </div>
  );
}

export function TaxeFonciere({ etat }: { etat: EtatTaxeFonciere }) {
  const {
    lignes,
    setLignes,
    tauxDegrevement,
    setTauxDegrevement,
    revenuCadastral,
    setRevenuCadastral,
    referenceDossier,
    setReferenceDossier,
  } = etat;
  const [afficherDetail, setAfficherDetail] = useState(false);

  function maj(id: string, champ: keyof LigneUI, valeur: string) {
    setLignes((arr) =>
      arr.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)),
    );
  }

  const calcul = useMemo(
    () => calculerToutesLesLignes({ lignes, tauxDegrevement, revenuCadastral }),
    [lignes, tauxDegrevement, revenuCadastral],
  );
  const parametres = useMemo(
    () => lireParametresTaxes({ lignes, tauxDegrevement, revenuCadastral }),
    [lignes, tauxDegrevement, revenuCadastral],
  );

  const tauxD = num(tauxDegrevement) / 100;
  const coefficient =
    Number.isFinite(tauxD) && tauxD >= 0 && tauxD < 1
      ? formaterNombrePrecis(Number(coefficientCorrecteur(tauxD).toFixed(4)))
      : "—";
  const rcSaisi = num(revenuCadastral);

  return (
    <section className="card" aria-labelledby="titre-taxe">
      <div className="no-print">
        <h2 id="titre-taxe">Répartition des taxes foncières et assimilées</h2>
        <p className="intro">
          Le <strong>bailleur</strong> est redevable du paiement des taxes
          foncières sur les propriétés bâties et non bâties, mais le bail à
          ferme et/ou le bail-type départemental prévoient que le{" "}
          <strong>preneur</strong> en rembourse une quote-part. Depuis 2006, les
          terres agricoles sont affectées d'une <strong>exonération</strong> des
          bases communale et intercommunale au profit exclusif du preneur ; la
          loi n°2025-127 du 14/02/2025 l'a portée de 20 % à <strong>30 %</strong>.
        </p>

        <div className="info" style={{ marginBottom: "1rem" }}>
          <strong>1. L'exploitant concerné.</strong> Le calcul se fait{" "}
          <strong>exploitant par exploitant</strong>, à partir du revenu
          cadastral propre aux parcelles qui lui sont louées : c'est la seule
          méthode exacte lorsque plusieurs exploitants se partagent un même
          avis d'imposition. S'il y a plusieurs exploitants, faites un calcul
          pour chacun.
          <div className="grille" style={{ marginTop: "0.75rem" }}>
            <div className="champ">
              <label htmlFor="rc-exploitant">Revenu cadastral de l'exploitant (€)</label>
              <span className="aide">
                Relevé de propriété, parcelles louées à cet exploitant,
                actualisé pour l'année
              </span>
              <input
                id="rc-exploitant"
                inputMode="decimal"
                placeholder="ex. 947,52"
                value={revenuCadastral}
                onChange={(e) => setRevenuCadastral(e.target.value)}
              />
            </div>
            <div className="champ">
              <label htmlFor="ref-dossier">Référence du calcul (facultatif)</label>
              <span className="aide">
                Propriétaire, preneur, commune : reprise en tête du détail
                imprimé
              </span>
              <input
                id="ref-dossier"
                type="text"
                placeholder="ex. Propriété X — preneur Y — commune Z"
                value={referenceDossier}
                onChange={(e) => setReferenceDossier(e.target.value)}
              />
            </div>
          </div>
          <p className="note-approximation" style={{ margin: "0.75rem 0 0" }}>
            ⚠️ Prenez le revenu cadastral du <strong>relevé de propriété</strong>,
            et non celui de l'avis de taxe foncière de l'année, déjà minoré de
            30 % : sinon le dégrèvement serait compté deux fois.
          </p>
          {Number.isFinite(rcSaisi) && rcSaisi > 0 && (
            <p style={{ margin: "0.5rem 0 0" }}>
              Revenu cadastral retenu pour toutes les taxes calculées par cette
              méthode : <strong>{formaterEurosPrecis(rcSaisi)}</strong>.
            </p>
          )}
        </div>

        <OutilRevalorisation onReporter={setRevenuCadastral} />

        <div className="info" style={{ marginBottom: "1rem" }}>
          <strong>2. Paramètre réglementaire (réforme 2025).</strong> Le
          dégrèvement de 30 % réduit à 70 % la base de la TFNB (parts
          communale et intercommunale) et de la taxe GEMAPI, mais seule la
          TFNB en fait bénéficier le preneur lors de la répartition : la taxe
          GEMAPI n'a pas le caractère d'une taxe foncière.
          <div className="grille" style={{ marginTop: "0.75rem" }}>
            <div className="champ">
              <label htmlFor="degrevement">Taux de dégrèvement (%)</label>
              <span className="aide">30 % depuis 2025 (20 % auparavant)</span>
              <input
                id="degrevement"
                inputMode="decimal"
                value={tauxDegrevement}
                onChange={(e) => setTauxDegrevement(e.target.value)}
              />
            </div>
            <div className="champ">
              <label htmlFor="coef">Coefficient correcteur (calculé)</label>
              <span className="aide">
                1 ÷ (1 − dégrèvement) ; sert uniquement à la méthode « montant
                global », pour reconstituer la taxe avant dégrèvement
              </span>
              <output id="coef" className="valeur-calculee">
                {coefficient}
              </output>
            </div>
          </div>
        </div>

        <h3 className="appel-soustitre" style={{ marginTop: "1.25rem" }}>
          3. Les taxes, ligne par ligne
        </h3>

        {"erreur" in calcul && (
          <p className="erreur">
            {calcul.erreur} Le total et le détail des calculs s'afficheront une
            fois la saisie corrigée.
          </p>
        )}

        {lignes.map((l) => (
          <BlocLigne
            key={l.id}
            ligne={l}
            calcul={
              "erreur" in parametres
                ? null
                : calculerUneLigne(l, parametres.params, parametres.revenuCadastral)
            }
            revenuCadastral={"erreur" in parametres ? 0 : parametres.revenuCadastral}
            maj={maj}
          />
        ))}

        {"resultats" in calcul && (
          <div className="resultat">
            <div className="legende" style={{ marginBottom: "0.4rem" }}>
              Total des taxes (surface louée) : {formaterEuros(calcul.totalGeneral)}
            </div>
            <div className="montant-principal">
              {formaterEuros(calcul.totalPreneur)}
            </div>
            <div className="legende">
              {calcul.totalPreneur >= 0
                ? "À rembourser par le preneur au bailleur (toutes taxes)."
                : "En faveur du preneur : réduction nette de fermage (toutes taxes)."}{" "}
              Part restant à la charge du bailleur :{" "}
              <strong>
                {formaterEuros(calcul.totalGeneral - calcul.totalPreneur)}
              </strong>
              .
            </div>
          </div>
        )}
      </div>

      {"resultats" in calcul && (
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
            <button
              type="button"
              className="btn-imprimer"
              onClick={() => window.print()}
            >
              Imprimer le détail des calculs
            </button>
            <p className="intro" style={{ fontSize: "0.82rem", margin: "0.5rem 0 0" }}>
              Une page récapitule chaque taxe avec sa formule et les chiffres
              saisis, pour vérifier le calcul et le montrer à l'adhérent. Dans
              la fenêtre d'impression, décochez « En-têtes et pieds de page »
              (Plus de paramètres) pour ne pas imprimer l'adresse du site.
            </p>
          </div>
          <DetailCalculs
            calcul={calcul}
            referenceDossier={referenceDossier}
            afficheALEcran={afficherDetail}
          />
        </>
      )}

      <div className="no-print">
        <details className="explication">
          <summary>Comment ce calcul fonctionne-t-il&nbsp;?</summary>
          <p>
            <strong>1. Le montant de chaque taxe pour la surface louée</strong>{" "}
            se calcule de l'une des façons suivantes, au choix sur chaque ligne :
          </p>
          <ul>
            <li>
              <strong>Revenu cadastral de l'exploitant × taux voté</strong>{" "}
              (méthode rigoureuse, proposée par défaut) : revenu cadastral
              propre aux parcelles louées à l'exploitant (relevé de
              propriété), réduit de 30 % pour la TFNB et la taxe GEMAPI, non
              réduit pour la chambre d'agriculture, puis multiplié par le taux
              voté (bas de colonne de l'avis). Indispensable dès qu'il y a
              plusieurs exploitants sur le même avis.
            </li>
            <li>
              <strong>Montant global de l'avis × % de surface</strong> :
              approximation, fiable seulement pour un exploitant unique.
            </li>
            <li>
              <strong>Taux à l'hectare × surface louée</strong> : pour les
              taxes assises directement sur la surface (remembrement, taxes
              syndicales / de marais), suivant le protocole départemental.
            </li>
          </ul>
          <p>
            <strong>2. La part du preneur</strong>, une fois ce montant connu :
          </p>
          <p className="formule">
            TFNB (parts communale et intercommunale) :<br />
            Imputé au preneur = Revenu cadastral × Taux voté × (Taux du bail −
            30 %) × (1 + frais de rôle, seulement si le taux du bail dépasse
            30 %)
          </p>
          <ul>
            <li>
              <strong>Taux du bail &lt; 30 %</strong> : résultat négatif →{" "}
              <em>réduction du fermage</em> en faveur du preneur.
            </li>
            <li>
              <strong>Taux du bail = 30 %</strong> : aucun versement réciproque
              (le dégrèvement compense le remboursement prévu).
            </li>
            <li>
              <strong>Taux du bail &gt; 30 %</strong> : remboursement du preneur
              au bailleur, majoré des frais de rôle.
            </li>
          </ul>
          <p style={{ fontSize: "0.85rem" }}>
            Avec la méthode « montant global », la taxe avant dégrèvement est
            reconstituée en divisant le montant appelé par 0,70 (coefficient
            correcteur 1 ÷ 0,70 ≈ 1,4286, arrondi à 1,43 dans les tableaux
            papier : le calcul exact évite un écart d'environ 0,1 %).
          </p>
          <p className="formule">
            Taxe GEMAPI :<br />
            Imputé au preneur = Revenu cadastral × 70 % × Taux voté × Taux du
            bail × (1 + frais de rôle)
          </p>
          <p style={{ fontSize: "0.85rem" }}>
            La base est réduite à 70 % car l'administration fiscale calcule
            elle-même la taxe GEMAPI sur une base déjà dégrevée. En revanche,
            n'ayant pas le caractère d'une taxe foncière, la taxe GEMAPI ne
            bénéficie pas, lors de la répartition, du mécanisme de
            dégrèvement en faveur du preneur : pas de soustraction des 30 %.
          </p>
          <p className="formule">
            Chambre d'agriculture, remembrement, taxes syndicales :<br />
            Imputé au preneur = Montant de la taxe × Taux du bail × (1 + frais
            de rôle)
          </p>
          <p>
            Pour la chambre d'agriculture, la loi prévoit un remboursement de
            50 % (art. 1604 du Code général des impôts, art. L514-1 du Code
            rural et de la pêche maritime), majoré de 8 % de frais de rôle :
            taux d'ordre public, non modifiable par le bail.
          </p>
          <p>
            <strong>3. Les arrondis.</strong> Chaque calcul part des valeurs
            saisies, sans arrondi intermédiaire. Seul le résultat de chaque
            ligne est arrondi au centime (arrondi commercial, comme la
            fonction ARRONDI d'Excel), et le total est la somme des lignes
            arrondies : le décompte adressé au preneur est ainsi toujours égal
            à la somme de ses lignes.
          </p>
        </details>

        <p className="intro" style={{ marginTop: "1.25rem", marginBottom: 0, fontSize: "0.82rem" }}>
          Source : Fédération Nationale de la Propriété Privée Rurale — loi
          n°2025-127 du 14/02/2025, art. L415-3 du Code rural et de la pêche
          maritime. Calcul indicatif, à adapter aux clauses de votre bail.
        </p>
      </div>
    </section>
  );
}
