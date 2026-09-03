import { useMemo, useState } from "react";
import { controleBornesPrefectorales } from "../lib/fermage";
import { formaterEuros, formaterNombre } from "../lib/format";
import {
  DEPARTEMENTS,
  BAREMES_VERIFIES,
  rechercheArreteUrl,
} from "../data/baremes";

const LIBELLE_CONFORMITE = {
  conforme: "Loyer conforme à la fourchette",
  inferieur: "Loyer inférieur au minimum autorisé",
  superieur: "Loyer supérieur au maximum autorisé",
} as const;

export function BornesPrefectorales() {
  const [surface, setSurface] = useState("10");
  const [minHa, setMinHa] = useState("80");
  const [maxHa, setMaxHa] = useState("180");
  const [loyer, setLoyer] = useState("1500");

  // Département et catégorie sélectionnés
  const [departementCode, setDepartementCode] = useState("");
  const [categorieId, setCategorieId] = useState("");

  const departement = DEPARTEMENTS.find((d) => d.code === departementCode);
  const bareme = departementCode ? BAREMES_VERIFIES[departementCode] : undefined;
  const categorieActive = bareme?.categories.find((c) => c.id === categorieId);
  const rechercheUrl = departement ? rechercheArreteUrl(departement.nom) : "";

  function choisirDepartement(code: string) {
    setDepartementCode(code);
    const b = code ? BAREMES_VERIFIES[code] : undefined;
    const premiere = b?.categories[0];
    if (premiere) {
      setCategorieId(premiere.id);
      setMinHa(String(premiere.minParHa));
      setMaxHa(String(premiere.maxParHa));
    } else {
      setCategorieId("");
    }
  }

  function choisirCategorie(catId: string) {
    setCategorieId(catId);
    const cat = bareme?.categories.find((c) => c.id === catId);
    if (cat) {
      setMinHa(String(cat.minParHa));
      setMaxHa(String(cat.maxParHa));
    }
  }

  const calcul = useMemo(() => {
    const s = Number(surface.replace(",", "."));
    const min = Number(minHa.replace(",", "."));
    const max = Number(maxHa.replace(",", "."));
    const l = Number(loyer.replace(",", "."));
    if ([s, min, max, l].some((n) => Number.isNaN(n))) {
      return { erreur: "Renseignez des valeurs numériques valides." };
    }
    try {
      return { resultat: controleBornesPrefectorales(s, min, max, l) };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
    }
  }, [surface, minHa, maxHa, loyer]);

  return (
    <section className="card" aria-labelledby="titre-bornes">
      <h2 id="titre-bornes">Minimas et maximas du fermage</h2>
      <p className="intro">
        Le loyer d'un bail rural doit rester dans la fourchette (minimum /
        maximum par hectare) fixée par l'<strong>arrêté préfectoral</strong> de
        votre département, selon la nature et la catégorie des terres.
        Sélectionnez votre département pour accéder à son arrêté officiel ; les
        bornes sont pré-remplies lorsque les valeurs ont été vérifiées (✓).
      </p>
      <p className="info" style={{ marginBottom: "1.25rem" }}>
        ⚠️ Cet outil concerne les <strong>terres</strong>. Pour les{" "}
        <strong>loyers de bâtiments</strong> (bâtiments d'exploitation et
        d'habitation), le mode de calcul est différent et varie selon chaque
        département : référez-vous à l'<strong>arrêté préfectoral</strong> de
        votre département.
      </p>
      {/* Sélection du département + catégorie */}
      <div className="grille" style={{ marginBottom: "0.5rem" }}>
        <div className="champ">
          <label htmlFor="departement">Département</label>
          <span className="aide">✓ = bornes pré-remplies vérifiées</span>
          <select
            id="departement"
            value={departementCode}
            onChange={(e) => choisirDepartement(e.target.value)}
          >
            <option value="">Saisie manuelle</option>
            {DEPARTEMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {BAREMES_VERIFIES[d.code] ? "✓ " : ""}
                {d.code} — {d.nom}
              </option>
            ))}
          </select>
        </div>

        {bareme && (
          <div className="champ" style={{ gridColumn: "span 2" }}>
            <label htmlFor="categorie">Catégorie de bien</label>
            <span className="aide">Nature / culture concernée</span>
            <select
              id="categorie"
              value={categorieId}
              onChange={(e) => choisirCategorie(e.target.value)}
            >
              {bareme.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bandeau d'information selon le département choisi */}
      {departement && bareme && (
        <p
          className="intro"
          style={{ fontSize: "0.85rem", marginBottom: "1rem" }}
        >
          Barème vérifié : {bareme.arrete} ({bareme.campagne}).{" "}
          <a href={bareme.sourceUrl} target="_blank" rel="noopener noreferrer">
            Source officielle
          </a>
          {categorieActive?.note ? ` — ${categorieActive.note}` : ""} Vérifiez
          toujours l'arrêté en vigueur avant toute décision.
        </p>
      )}

      {departement && !bareme && (
        <div className="info" style={{ marginBottom: "1rem" }}>
          Les bornes de la {departement.nom} ne sont pas encore intégrées.
          Consultez l'arrêté préfectoral officiel puis saisissez les
          minima/maxima ci-dessous.{" "}
          <a href={rechercheUrl} target="_blank" rel="noopener noreferrer">
            Trouver l'arrêté officiel ({departement.code})
          </a>
        </div>
      )}

      <div className="grille">
        <div className="champ">
          <label htmlFor="surface">Surface louée (ha)</label>
          <input
            id="surface"
            inputMode="decimal"
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="min-ha">Minimum (€/ha/an)</label>
          <span className="aide">Borne basse de l'arrêté</span>
          <input
            id="min-ha"
            inputMode="decimal"
            value={minHa}
            onChange={(e) => {
              setMinHa(e.target.value);
              setCategorieId("");
            }}
          />
        </div>
        <div className="champ">
          <label htmlFor="max-ha">Maximum (€/ha/an)</label>
          <span className="aide">Borne haute de l'arrêté</span>
          <input
            id="max-ha"
            inputMode="decimal"
            value={maxHa}
            onChange={(e) => {
              setMaxHa(e.target.value);
              setCategorieId("");
            }}
          />
        </div>
        <div className="champ">
          <label htmlFor="loyer-propose">Loyer à vérifier (€/an)</label>
          <span className="aide">Montant total proposé</span>
          <input
            id="loyer-propose"
            inputMode="decimal"
            value={loyer}
            onChange={(e) => setLoyer(e.target.value)}
          />
        </div>
      </div>

      {"erreur" in calcul && calcul.erreur ? (
        <p className="erreur">{calcul.erreur}</p>
      ) : (
        "resultat" in calcul &&
        calcul.resultat && (
          <div className="resultat">
            <span className={`badge ${calcul.resultat.conformite}`}>
              {LIBELLE_CONFORMITE[calcul.resultat.conformite]}
            </span>

            <div className="detail-calcul" style={{ marginTop: "1rem" }}>
              <div>
                Fourchette autorisée pour {formaterNombre(calcul.resultat.surfaceHa)}{" "}
                ha :{" "}
                <strong>
                  {formaterEuros(calcul.resultat.minTotal)} —{" "}
                  {formaterEuros(calcul.resultat.maxTotal)}
                </strong>{" "}
                / an
              </div>
              <div style={{ marginTop: "0.4rem" }}>
                Loyer proposé : {formaterEuros(calcul.resultat.loyerPropose)} /an
                — soit{" "}
                <strong>
                  {formaterEuros(calcul.resultat.loyerProposeParHa)} /ha/an
                </strong>
              </div>
            </div>
          </div>
        )
      )}
    </section>
  );
}
