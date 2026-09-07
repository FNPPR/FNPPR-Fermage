import { useMemo, useState } from "react";
import { calculerAppelFermage, type LigneCharge } from "../lib/appelFermage";
import { ANNEE_MAX, INDICES_FERMAGE } from "../data/indices";
import { formaterEuros, formaterNombre } from "../lib/format";

const ANNEES = INDICES_FERMAGE.map((i) => i.annee);

type Periode = "sem1" | "sem2" | "annuel";

const LIBELLE_PERIODE: Record<Exclude<Periode, "annuel">, string> = {
  sem1: "1er Semestre",
  sem2: "2ème Semestre",
};

const CIVILITES = ["Madame, Monsieur,", "Madame,", "Monsieur,", "Messieurs,"];

interface LigneUI {
  id: string;
  libelle: string;
  montant: string;
}

let compteurLigne = 0;
function nouvelleLigne(libelle = "", montant = ""): LigneUI {
  compteurLigne += 1;
  return { id: `ligne-${compteurLigne}`, libelle, montant };
}

const num = (s: string) => Number(s.replace(",", ".").trim());

const deuxChiffres = (annee: number) => String(annee).slice(-2);

export function AppelFermage() {
  // Destinataire et période
  const [civilite, setCivilite] = useState(CIVILITES[0]);
  const [destinataire, setDestinataire] = useState("");
  const [periode, setPeriode] = useState<Periode>("sem2");
  const [annee, setAnnee] = useState(ANNEE_MAX);
  const [echeance, setEcheance] = useState("");

  // Fermage
  const [loyer, setLoyer] = useState("1000");
  const [anneeDepart, setAnneeDepart] = useState(ANNEE_MAX - 1);
  const [anneeArrivee, setAnneeArrivee] = useState(ANNEE_MAX);
  const [acompte, setAcompte] = useState("0");

  // Impôts & taxes
  const [lignes, setLignes] = useState<LigneUI[]>([nouvelleLigne()]);

  // Signature
  const [expediteur, setExpediteur] = useState("");

  function majLigne(id: string, champ: "libelle" | "montant", valeur: string) {
    setLignes((arr) =>
      arr.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)),
    );
  }
  function ajouterLigne() {
    setLignes((arr) => [...arr, nouvelleLigne()]);
  }
  function supprimerLigne(id: string) {
    setLignes((arr) => (arr.length > 1 ? arr.filter((l) => l.id !== id) : arr));
  }

  const calcul = useMemo(() => {
    const montantLoyer = num(loyer);
    const montantAcompte = num(acompte);
    if (!loyer.trim() || !Number.isFinite(montantLoyer)) {
      return { erreur: "Saisissez un montant de loyer de référence valide." };
    }
    if (!Number.isFinite(montantAcompte)) {
      return { erreur: "Saisissez un acompte valide (0 si aucun acompte à déduire)." };
    }

    const charges: LigneCharge[] = [];
    for (const l of lignes) {
      if (!l.libelle.trim() && !l.montant.trim()) continue; // ligne vide ignorée
      const montant = num(l.montant || "0");
      if (!Number.isFinite(montant)) {
        return {
          erreur: `Montant invalide pour la ligne « ${l.libelle || "sans libellé"} ».`,
        };
      }
      charges.push({
        id: l.id,
        libelle: l.libelle.trim() || "Ligne sans libellé",
        montant,
      });
    }

    try {
      const resultat = calculerAppelFermage({
        loyerInitial: montantLoyer,
        anneeDepart,
        anneeArrivee,
        acompte: montantAcompte,
        charges,
      });
      return { resultat };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
    }
  }, [loyer, acompte, anneeDepart, anneeArrivee, lignes]);

  const libellePeriode =
    periode === "annuel"
      ? `l'année ${annee}`
      : `du ${LIBELLE_PERIODE[periode]} ${annee}`;

  const labelAcompte =
    periode === "sem2"
      ? `Déduction acompte 1er semestre ${deuxChiffres(annee)}`
      : "Déduction acompte déjà versé";

  return (
    <section className="card" aria-labelledby="titre-appel">
      <h2 id="titre-appel">Appel de fermage</h2>
      <p className="intro">
        Composez le décompte à adresser au preneur : reprend la réévaluation
        du loyer selon l'indice national (onglet « Réévaluation ») et le
        total des impôts et taxes qui lui sont imputés (onglet « Répartition
        des taxes foncières et assimilées »), pour produire un courrier prêt
        à imprimer.
      </p>

      {/* Destinataire et période */}
      <div className="grille" style={{ marginBottom: "1rem" }}>
        <div className="champ" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ap-dest">Destinataire (nom et adresse)</label>
          <span className="aide">Une ligne d'adresse par ligne de texte</span>
          <textarea
            id="ap-dest"
            rows={3}
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value)}
            placeholder={"Monsieur Jean Dupont\n12 rue de la Mairie\n44590 Lusanger"}
          />
        </div>
        <div className="champ">
          <label htmlFor="ap-civ">Formule d'appel</label>
          <select
            id="ap-civ"
            value={civilite}
            onChange={(e) => setCivilite(e.target.value)}
          >
            {CIVILITES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="ap-periode">Période</label>
          <select
            id="ap-periode"
            value={periode}
            onChange={(e) => setPeriode(e.target.value as Periode)}
          >
            <option value="sem1">1er semestre</option>
            <option value="sem2">2ème semestre</option>
            <option value="annuel">Année complète</option>
          </select>
        </div>
        <div className="champ">
          <label htmlFor="ap-annee">Année</label>
          <select
            id="ap-annee"
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
          >
            {ANNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="ap-echeance">Date d'échéance</label>
          <span className="aide">Facultatif — ex. « 1er novembre »</span>
          <input
            id="ap-echeance"
            type="text"
            value={echeance}
            onChange={(e) => setEcheance(e.target.value)}
          />
        </div>
      </div>

      {/* Fermage */}
      <h3 className="appel-soustitre">Fermage</h3>
      <div className="grille" style={{ marginBottom: "1rem" }}>
        <div className="champ">
          <label htmlFor="ap-loyer">Loyer de référence (€)</label>
          <span className="aide">Montant du fermage l'année de départ</span>
          <input
            id="ap-loyer"
            inputMode="decimal"
            value={loyer}
            onChange={(e) => setLoyer(e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="ap-adepart">Année de départ</label>
          <select
            id="ap-adepart"
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
          <label htmlFor="ap-aarrivee">Année de calcul</label>
          <select
            id="ap-aarrivee"
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
        <div className="champ">
          <label htmlFor="ap-acompte">Acompte déjà versé (€)</label>
          <span className="aide">0 si aucun acompte à déduire</span>
          <input
            id="ap-acompte"
            inputMode="decimal"
            value={acompte}
            onChange={(e) => setAcompte(e.target.value)}
          />
        </div>
      </div>

      {/* Impôts & Taxes */}
      <h3 className="appel-soustitre">Impôts &amp; Taxes</h3>
      <p className="intro" style={{ marginBottom: "0.6rem" }}>
        Reportez ici le montant imputé au preneur pour chaque ligne calculée
        dans l'onglet « Répartition des taxes foncières et assimilées »
        (laissez vide si aucune taxe n'est refacturée).
      </p>
      {lignes.map((l) => (
        <div className="appel-ligne-saisie" key={l.id}>
          <input
            type="text"
            placeholder="Libellé (ex. Pnb. Aubin rc 25 940)"
            value={l.libelle}
            onChange={(e) => majLigne(l.id, "libelle", e.target.value)}
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Montant (€)"
            value={l.montant}
            onChange={(e) => majLigne(l.id, "montant", e.target.value)}
          />
          <button
            type="button"
            className="btn-supprimer"
            onClick={() => supprimerLigne(l.id)}
            disabled={lignes.length === 1}
            aria-label="Supprimer cette ligne"
            title="Supprimer cette ligne"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn-ajouter" onClick={ajouterLigne}>
        + Ajouter une ligne
      </button>

      {"erreur" in calcul && calcul.erreur && (
        <p className="erreur">{calcul.erreur}</p>
      )}

      {"resultat" in calcul && calcul.resultat && (
        <>
          <div className="resultat" style={{ marginTop: "1.5rem" }}>
            <div className="legende">Total de l'échéance</div>
            <div className="montant-principal">
              {formaterEuros(calcul.resultat.totalEcheance)}
            </div>
            <div className="legende">
              Fermage : {formaterEuros(calcul.resultat.totalFermage)} + Impôts
              &amp; taxes : {formaterEuros(calcul.resultat.totalCharges)}
            </div>
          </div>

          <h3 className="appel-soustitre" style={{ marginTop: "1.5rem" }}>
            Aperçu du courrier
          </h3>
          <div className="appel-lettre" id="appel-lettre">
            {destinataire.trim() && (
              <p className="appel-destinataire">
                {destinataire.split("\n").map((ligne, i) => (
                  <span key={i}>
                    {ligne}
                    <br />
                  </span>
                ))}
              </p>
            )}

            <p>{civilite}</p>
            <p>
              Je vous prie de bien vouloir trouver, ci-dessous, le décompte
              de votre fermage {libellePeriode}
              {echeance.trim() ? `, à échéance du ${echeance.trim()}` : ""},
              savoir :
            </p>

            <p className="appel-titre-bloc">Fermage :</p>
            <div className="appel-ligne-calc">
              <span>
                Fermage {deuxChiffres(anneeArrivee)}{" "}
                {formaterNombre(calcul.resultat.revalorisation.loyerInitial)}{" "}
                × {formaterNombre(calcul.resultat.revalorisation.indiceArrivee)} ÷{" "}
                {formaterNombre(calcul.resultat.revalorisation.indiceDepart)}
              </span>
              <span>{formaterEuros(calcul.resultat.revalorisation.loyer)}</span>
            </div>
            {calcul.resultat.acompte > 0 && (
              <div className="appel-ligne-calc">
                <span>{labelAcompte}</span>
                <span>− {formaterEuros(calcul.resultat.acompte)}</span>
              </div>
            )}
            <div className="appel-ligne-calc appel-sous-total">
              <span>Total fermage</span>
              <span>{formaterEuros(calcul.resultat.totalFermage)}</span>
            </div>

            <p className="appel-titre-bloc">Impôts &amp; Taxes :</p>
            {calcul.resultat.charges.length === 0 ? (
              <div className="appel-ligne-calc">
                <span>Néant</span>
                <span>{formaterEuros(0)}</span>
              </div>
            ) : (
              calcul.resultat.charges.map((c) => (
                <div className="appel-ligne-calc" key={c.id}>
                  <span>{c.libelle}</span>
                  <span>{formaterEuros(c.montant)}</span>
                </div>
              ))
            )}
            <div className="appel-ligne-calc appel-sous-total">
              <span>Total charges</span>
              <span>{formaterEuros(calcul.resultat.totalCharges)}</span>
            </div>

            <div className="appel-ligne-calc appel-total">
              <span>TOTAL DE L'ÉCHÉANCE</span>
              <span>{formaterEuros(calcul.resultat.totalEcheance)}</span>
            </div>

            <p style={{ marginTop: "1.25rem" }}>
              que vous voudrez bien me régler, par le moyen de votre choix,
              le plus tôt possible.
            </p>
            <p>
              Vous en remerciant, je vous demande de croire, {civilite} à
              l'expression de mes sentiments distingués.
            </p>

            {expediteur.trim() && (
              <p className="appel-signature">
                {expediteur.split("\n").map((ligne, i) => (
                  <span key={i}>
                    {ligne}
                    <br />
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="champ" style={{ margin: "1rem 0" }}>
            <label htmlFor="ap-expediteur">Signature (facultatif)</label>
            <textarea
              id="ap-expediteur"
              rows={2}
              value={expediteur}
              onChange={(e) => setExpediteur(e.target.value)}
              placeholder={"Jean Dupont\nPropriétaire bailleur"}
            />
          </div>

          <button
            type="button"
            className="btn-imprimer"
            onClick={() => window.print()}
          >
            🖨️ Imprimer / exporter en PDF
          </button>
        </>
      )}

      <p
        className="intro"
        style={{ marginTop: "1.25rem", marginBottom: 0, fontSize: "0.82rem" }}
      >
        Document indicatif à vérifier avant envoi : la civilité, l'adresse et
        la formule de politesse restent à adapter selon vos usages. Ce
        premier gabarit sera affiné dans une prochaine version.
      </p>
    </section>
  );
}
