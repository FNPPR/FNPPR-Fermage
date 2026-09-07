import { useMemo, useState } from "react";
import { calculerAppelFermage, type LigneCharge } from "../lib/appelFermage";
import { calculerToutesLesLignes } from "../lib/taxeFonciereLignes";
import { ANNEE_MAX, INDICES_FERMAGE } from "../data/indices";
import type { EtatFermageBase } from "../lib/etatFermageBase";
import type { EtatTaxeFonciere } from "../lib/etatTaxeFonciere";
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

const dateDuJour = () =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

export function AppelFermage({
  fermageBase: { loyer, setLoyer, anneeDepart, setAnneeDepart, anneeArrivee, setAnneeArrivee },
  taxeFonciere,
  onVoirTaxeFonciere,
}: {
  fermageBase: EtatFermageBase;
  taxeFonciere: EtatTaxeFonciere;
  onVoirTaxeFonciere: () => void;
}) {
  // Expéditeur, destinataire, lieu et date
  const [expediteur, setExpediteur] = useState("");
  const [destinataire, setDestinataire] = useState("");
  const [lieu, setLieu] = useState("");
  const [dateCourrier, setDateCourrier] = useState(dateDuJour);

  // Objet et période
  const [civilite, setCivilite] = useState(CIVILITES[0]);
  const [periode, setPeriode] = useState<Periode>("sem2");
  const [annee, setAnnee] = useState(ANNEE_MAX);
  const [echeance, setEcheance] = useState("");

  // Fermage
  const [acompte, setAcompte] = useState("0");

  // Impôts & taxes
  const [lignes, setLignes] = useState<LigneUI[]>([nouvelleLigne()]);

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

  // Lignes de taxes calculées automatiquement depuis l'onglet « Répartition
  // des taxes foncières et assimilées » (même état, partagé via App.tsx).
  const calculTaxe = useMemo(
    () =>
      calculerToutesLesLignes(
        taxeFonciere.lignes,
        taxeFonciere.tauxDegrevement,
        taxeFonciere.coefficient,
      ),
    [taxeFonciere.lignes, taxeFonciere.tauxDegrevement, taxeFonciere.coefficient],
  );
  const lignesAutoTaxe: LigneCharge[] =
    "resultats" in calculTaxe
      ? calculTaxe.resultats
          .filter(({ res }) => res.imputePreneur !== 0)
          .map(({ ligne, res }) => ({
            id: `taxe-${ligne.id}`,
            libelle: ligne.libelle,
            montant: res.imputePreneur,
          }))
      : [];

  const calcul = useMemo(() => {
    const montantLoyer = num(loyer);
    const montantAcompte = num(acompte);
    if (!loyer.trim() || !Number.isFinite(montantLoyer)) {
      return { erreur: "Saisissez un montant de loyer de référence valide." };
    }
    if (!Number.isFinite(montantAcompte)) {
      return { erreur: "Saisissez un acompte valide (0 si aucun acompte à déduire)." };
    }

    const chargesLibres: LigneCharge[] = [];
    for (const l of lignes) {
      if (!l.libelle.trim() && !l.montant.trim()) continue; // ligne vide ignorée
      const montant = num(l.montant || "0");
      if (!Number.isFinite(montant)) {
        return {
          erreur: `Montant invalide pour la ligne « ${l.libelle || "sans libellé"} ».`,
        };
      }
      chargesLibres.push({
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
        charges: [...lignesAutoTaxe, ...chargesLibres],
      });
      return { resultat };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
    }
  }, [loyer, acompte, anneeDepart, anneeArrivee, lignes, lignesAutoTaxe]);

  const libellePeriode =
    periode === "annuel"
      ? `de l'année ${annee}`
      : `du ${LIBELLE_PERIODE[periode]} ${annee}`;

  const labelAcompte =
    periode === "sem2"
      ? `Déduction acompte 1er semestre ${deuxChiffres(annee)}`
      : "Déduction acompte déjà versé";

  // Nom repris en signature, en bas du courrier (première ligne non vide de
  // l'expéditeur, déjà affiché en entête).
  const nomSignataire =
    expediteur
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? "";

  return (
    <section className="card" aria-labelledby="titre-appel">
      <div className="no-print">
        <h2 id="titre-appel">Appel de fermage</h2>
        <p className="intro">
          Composez le décompte à adresser au preneur : cet onglet est
          entièrement relié aux onglets « Réévaluation » et « Répartition des
          taxes foncières et assimilées » — loyer, années et taxes imputées au
          preneur sont repris automatiquement, sans ressaisie. Le résultat est
          un courrier directement modifiable ci-dessous, prêt à imprimer ou à
          enregistrer en PDF.
        </p>

        {/* Expéditeur, destinataire, lieu et date */}
        <h3 className="appel-soustitre">Expéditeur et destinataire</h3>
        <div className="grille" style={{ marginBottom: "1rem" }}>
          <div className="champ" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="ap-exp">Vos coordonnées (nom et adresse)</label>
            <span className="aide">
              Affichées en haut du courrier et reprises en signature ;
              laissez vide pour ne pas les afficher
            </span>
            <textarea
              id="ap-exp"
              rows={3}
              value={expediteur}
              onChange={(e) => setExpediteur(e.target.value)}
              placeholder={"Jean Dupont\n3 chemin des Vignes\n44590 Lusanger"}
            />
          </div>
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
            <label htmlFor="ap-lieu">Lieu de rédaction</label>
            <span className="aide">Facultatif — ex. « Lusanger »</span>
            <input
              id="ap-lieu"
              type="text"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
            />
          </div>
          <div className="champ">
            <label htmlFor="ap-date">Date du courrier</label>
            <input
              id="ap-date"
              type="text"
              value={dateCourrier}
              onChange={(e) => setDateCourrier(e.target.value)}
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
        <p className="intro" style={{ marginBottom: "0.6rem" }}>
          Ces trois champs sont communs avec l'onglet « Réévaluation » : une
          saisie ici ou là-bas se retrouve dans les deux.
        </p>
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

        {"erreur" in calculTaxe && (
          <p className="erreur">
            Les taxes de l'onglet « Répartition des taxes foncières et
            assimilées » n'ont pas pu être calculées ({calculTaxe.erreur}) et
            ne sont donc pas incluses ci-dessous.
          </p>
        )}

        <div className="appel-taxes-auto">
          <p className="intro" style={{ marginBottom: "0.5rem" }}>
            Reprises automatiquement depuis l'onglet «&nbsp;Répartition des
            taxes foncières et assimilées&nbsp;» (montants imputés au preneur,
            hors lignes nulles) :
          </p>
          {lignesAutoTaxe.length === 0 ? (
            <p className="intro" style={{ marginBottom: "0.5rem" }}>
              Aucune — toutes les lignes de cet onglet sont actuellement à 0.
            </p>
          ) : (
            lignesAutoTaxe.map((c) => (
              <div className="appel-ligne-calc" key={c.id}>
                <span>{c.libelle}</span>
                <span>{formaterEuros(c.montant)}</span>
              </div>
            ))
          )}
          <button
            type="button"
            className="lien-toggle"
            onClick={onVoirTaxeFonciere}
            style={{
              background: "none",
              border: "none",
              color: "var(--bleu)",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
              marginTop: "0.5rem",
              textDecoration: "underline",
              fontSize: "0.88rem",
            }}
          >
            → Vérifier / modifier ces montants dans l'onglet Répartition des
            taxes foncières
          </button>
        </div>

        <p className="intro" style={{ margin: "1.1rem 0 0.6rem" }}>
          <strong>Charges complémentaires</strong> (facultatif) — toute autre
          ligne non couverte ci-dessus (ex. taxe hors barème, frais divers) :
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
        )}
      </div>

      {"resultat" in calcul && calcul.resultat && (
        <>
          <h3 className="appel-soustitre no-print" style={{ marginTop: "1.5rem" }}>
            Aperçu du courrier
          </h3>
          <div className="appel-lettre" id="appel-lettre">
            {(expediteur.trim() || destinataire.trim()) && (
              <div className="appel-entete">
                <div className="appel-expediteur">
                  {expediteur.trim() &&
                    expediteur.split("\n").map((ligne, i) => (
                      <span key={i}>
                        {ligne}
                        <br />
                      </span>
                    ))}
                </div>
                <div className="appel-destinataire">
                  {destinataire.trim() &&
                    destinataire.split("\n").map((ligne, i) => (
                      <span key={i}>
                        {ligne}
                        <br />
                      </span>
                    ))}
                </div>
              </div>
            )}

            {(lieu.trim() || dateCourrier.trim()) && (
              <p className="appel-lieu-date">
                {lieu.trim() ? `${lieu.trim()}, ` : ""}
                le {dateCourrier.trim() || "…"}
              </p>
            )}

            <p className="appel-objet">
              Objet&nbsp;: Appel de fermage {libellePeriode}
            </p>

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

            {nomSignataire && <p className="appel-signature">{nomSignataire}</p>}
          </div>

          <div className="no-print">
            <div
              className="info"
              style={{ margin: "1.25rem 0 0.75rem", fontSize: "0.85rem" }}
            >
              💡 Pour un rendu propre en PDF (sans l'adresse du site en pied
              de page), dans la boîte d'impression ouvrez «&nbsp;Plus de
              paramètres&nbsp;» et décochez «&nbsp;En-têtes et pieds de
              page&nbsp;».
            </div>

            <button
              type="button"
              className="btn-imprimer"
              onClick={() => window.print()}
            >
              🖨️ Imprimer / exporter en PDF
            </button>
          </div>
        </>
      )}

      <p
        className="intro no-print"
        style={{ marginTop: "1.25rem", marginBottom: 0, fontSize: "0.82rem" }}
      >
        Document indicatif à vérifier avant envoi : l'adresse et la formule
        de politesse restent à adapter selon vos usages.
      </p>
    </section>
  );
}
