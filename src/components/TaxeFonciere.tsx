import { useMemo, useState } from "react";
import {
  calculerLigneTaxe,
  totalImputePreneur,
  totalMontant,
  revaloriserRevenuCadastral,
  PARAMS_DEGREVEMENT_2025,
  type Assiette,
  type ModeAssiette,
  type MethodeTaxe,
  type ResultatTaxe,
} from "../lib/taxeFonciere";
import { formaterEuros } from "../lib/format";

type CalculTaxe =
  | { erreur: string }
  | {
      resultats: { ligne: LigneUI; res: ResultatTaxe }[];
      totalPreneur: number;
      totalGeneral: number;
    };

interface LigneUI {
  id: string;
  libelle: string;
  methode: MethodeTaxe;
  /** Le mode de calcul de l'assiette initialement proposé pour cette ligne. */
  modeAssiette: ModeAssiette;
  /** L'assiette « revenu cadastral » de cette taxe bénéficie-t-elle du
   * dégrèvement de 30 % ? (oui pour TFNB et GEMAPI, non pour la chambre
   * d'agriculture). */
  assietteDegrevee: boolean;
  note?: string;
  aideMontantAppele: string;
  aidePartExploitee: string;
  aideTauxImposition: string;
  // Champs de saisie (tous en texte, convertis à l'usage)
  montantAppele: string;
  partExploitant: string; // %
  revenuCadastral: string;
  tauxImposition: string; // %
  tauxHectare: string;
  surfaceLouee: string;
  tauxBail: string; // %
  fraisDeRole: string; // %
}

const LIBELLES_MODE: Record<ModeAssiette, string> = {
  montantGlobal: "Montant global de l'avis + % de surface",
  revenuCadastral: "Revenu cadastral propre à l'exploitant",
  hectare: "Taux à l'hectare × surface louée",
};

const LIGNES_INITIALES: LigneUI[] = [
  {
    id: "commune",
    libelle: "TFNB – part communale",
    methode: "tfnb",
    modeAssiette: "montantGlobal",
    assietteDegrevee: true,
    aideMontantAppele:
      "Imposition de la Commune : revenu cadastral dégrevé (−30 %) × taux communal (bas de colonne « Commune / Propriétés non bâties »)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée au taux communal",
    aideTauxImposition: "Taux communal (bas de colonne « Commune »)",
    montantAppele: "200",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "20",
    fraisDeRole: "3",
  },
  {
    id: "interco",
    libelle: "TFNB – part intercommunale",
    methode: "tfnb",
    modeAssiette: "montantGlobal",
    assietteDegrevee: true,
    aideMontantAppele:
      "Imposition de l'Intercommunalité : revenu cadastral dégrevé (−30 %) × taux intercommunal (bas de colonne « Intercommunalité / Propriétés non bâties »)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée au taux intercommunal",
    aideTauxImposition: "Taux intercommunal (bas de colonne « Intercommunalité »)",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "20",
    fraisDeRole: "3",
  },
  {
    id: "chambre",
    libelle: "Frais de chambre d'agriculture",
    methode: "simple",
    modeAssiette: "montantGlobal",
    assietteDegrevee: false,
    note:
      "Le taux de 50 % ne résulte pas d'une clause du bail : c'est une disposition d'ordre public du Code général des impôts (art. 1509), non négociable entre les parties.",
    aideMontantAppele:
      "Imposition de la Chambre d'agriculture : revenu cadastral NON dégrevé × taux de chambre d'agriculture (bas de colonne « Chambre d'agriculture / Propriétés non bâties »)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée au taux de chambre d'agriculture",
    aideTauxImposition:
      "Taux de chambre d'agriculture (bas de colonne « Chambre d'agriculture »)",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "50",
    fraisDeRole: "8",
  },
  {
    id: "gemapi",
    libelle: "Taxe GEMAPI",
    methode: "simple",
    modeAssiette: "montantGlobal",
    assietteDegrevee: true,
    note:
      "Taxe récente : vérifiez d'abord que le bail comporte bien une clause de remboursement de la taxe GEMAPI avant d'en imputer une part au preneur.",
    aideMontantAppele:
      "Imposition Taxe GEMAPI : revenu cadastral dégrevé (−30 %) × taux Taxe GEMAPI (bas de colonne « Taxe GEMAPI / Propriétés non bâties »)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée à la taxe GEMAPI",
    aideTauxImposition: "Taux Taxe GEMAPI (bas de colonne « Taxe GEMAPI »)",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "",
    surfaceLouee: "",
    tauxBail: "0",
    fraisDeRole: "3",
  },
  {
    id: "remembrement",
    libelle: "Taxe de remembrement",
    methode: "simple",
    modeAssiette: "hectare",
    assietteDegrevee: false,
    note:
      "Frais de rôle à vérifier : ils ne s'appliquent pas systématiquement à cette taxe — reportez-vous à l'avis et au protocole départemental de partage.",
    aideMontantAppele:
      "Imposition Taxe de remembrement : taux à l'hectare × surface louée, suivant le partage contractuellement défini (protocole départemental)",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée à la taxe de remembrement",
    aideTauxImposition: "Taux à l'hectare fixé par le protocole départemental",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "0",
    surfaceLouee: "0",
    tauxBail: "0",
    fraisDeRole: "0",
  },
  {
    id: "syndicales",
    libelle: "Taxes syndicales / de marais",
    methode: "simple",
    modeAssiette: "hectare",
    assietteDegrevee: false,
    note:
      "Perçue par une association syndicale de propriétaires (marais, drainage, irrigation…) : le remboursement par le preneur dépend d'une clause expresse du bail, à vérifier au cas par cas.",
    aideMontantAppele:
      "Imposition de l'association syndicale (marais, drainage…) : taux ou cotisation à l'hectare × surface louée",
    aidePartExploitee:
      "% de la surface louée sur la surface totale imposée par l'association syndicale",
    aideTauxImposition: "Taux ou cotisation à l'hectare de l'association syndicale",
    montantAppele: "0",
    partExploitant: "100",
    revenuCadastral: "",
    tauxImposition: "",
    tauxHectare: "0",
    surfaceLouee: "0",
    tauxBail: "0",
    fraisDeRole: "0",
  },
];

const num = (s: string) => Number(s.replace(",", ".").trim());

/** Construit l'assiette à calculer à partir des champs saisis pour une ligne. */
function assietteDeLaLigne(l: LigneUI): Assiette {
  switch (l.modeAssiette) {
    case "montantGlobal":
      return {
        mode: "montantGlobal",
        montantAppele: num(l.montantAppele),
        partExploitant: num(l.partExploitant) / 100,
      };
    case "revenuCadastral":
      return {
        mode: "revenuCadastral",
        revenuCadastral: num(l.revenuCadastral),
        tauxImposition: num(l.tauxImposition) / 100,
        assietteDegrevee: l.assietteDegrevee,
      };
    case "hectare":
      return {
        mode: "hectare",
        tauxHectare: num(l.tauxHectare),
        surfaceLouee: num(l.surfaceLouee),
      };
  }
}

/** Petit outil autonome d'actualisation d'un revenu cadastral ancien. */
function OutilRevalorisation() {
  const [base, setBase] = useState("500");
  const [taux, setTaux] = useState("1.5");
  const [annees, setAnnees] = useState("3");

  const resultat = useMemo(() => {
    const b = num(base);
    const t = num(taux) / 100;
    const a = num(annees);
    if (![b, t, a].every(Number.isFinite)) {
      return { erreur: "Renseignez des valeurs numériques valides." };
    }
    try {
      return { valeur: revaloriserRevenuCadastral(b, t, a) };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
    }
  }, [base, taux, annees]);

  return (
    <details className="explication" style={{ marginBottom: "1.25rem" }}>
      <summary>Outil : actualiser un revenu cadastral ancien</summary>
      <p>
        Le revenu cadastral doit être réactualisé chaque année par
        l'application du <strong>taux fiscal d'évolution des bases</strong>
        , voté chaque année en loi de finances (valeur variable, à renseigner
        vous-même). Le revenu cadastral non dégrevé propre à un exploitant
        est en général le <strong>même montant</strong> pour la part
        communale, la part intercommunale, la chambre d'agriculture et la
        taxe GEMAPI : seuls le taux voté et l'application ou non du
        dégrèvement diffèrent d'une taxe à l'autre.
      </p>
      <div className="grille">
        <div className="champ">
          <label htmlFor="rc-base">Revenu cadastral de référence (€)</label>
          <input
            id="rc-base"
            inputMode="decimal"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="rc-taux">Taux d'évolution annuel (%)</label>
          <span className="aide">Un par année, en moyenne</span>
          <input
            id="rc-taux"
            inputMode="decimal"
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="rc-annees">Nombre d'années</label>
          <input
            id="rc-annees"
            inputMode="decimal"
            value={annees}
            onChange={(e) => setAnnees(e.target.value)}
          />
        </div>
      </div>
      {"erreur" in resultat ? (
        <p className="erreur">{resultat.erreur}</p>
      ) : (
        <p className="formule">
          Revenu cadastral actualisé :{" "}
          <strong>{formaterEuros(resultat.valeur.revenuCadastral)}</strong>{" "}
          — à reporter dans le champ « Revenu cadastral de l'exploitant »
          des lignes concernées.
        </p>
      )}
    </details>
  );
}

export function TaxeFonciere() {
  const [lignes, setLignes] = useState<LigneUI[]>(LIGNES_INITIALES);
  const [tauxDegrevement, setTauxDegrevement] = useState("30");
  const [coefficient, setCoefficient] = useState("1.43");

  function maj(id: string, champ: keyof LigneUI, valeur: string) {
    setLignes((arr) =>
      arr.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)),
    );
  }

  const calcul = useMemo<CalculTaxe>(() => {
    const params = {
      tauxDegrevement: num(tauxDegrevement) / 100,
      coefficientCorrecteur: num(coefficient),
    };
    if (!Number.isFinite(params.tauxDegrevement) || !Number.isFinite(params.coefficientCorrecteur)) {
      return { erreur: "Paramètres réglementaires invalides." };
    }
    try {
      const resultats = lignes.map((l) => {
        const res = calculerLigneTaxe(
          assietteDeLaLigne(l),
          {
            tauxBail: num(l.tauxBail) / 100,
            fraisDeRole: num(l.fraisDeRole) / 100,
          },
          l.methode,
          params,
        );
        return { ligne: l, res };
      });
      return {
        resultats,
        totalPreneur: totalImputePreneur(resultats.map((r) => r.res)),
        totalGeneral: totalMontant(resultats.map((r) => r.res)),
      };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Erreur de calcul." };
    }
  }, [lignes, tauxDegrevement, coefficient]);

  return (
    <section className="card" aria-labelledby="titre-taxe">
      <h2 id="titre-taxe">Répartition des taxes foncières et assimilées</h2>
      <p className="intro">
        La taxe foncière est payée par le <strong>bailleur</strong>, mais le bail
        peut prévoir que le <strong>preneur</strong> en rembourse une part.
        Depuis 2006, les terres agricoles bénéficient d'un{" "}
        <strong>dégrèvement</strong> sur la part communale et intercommunale de
        la taxe foncière non bâtie (TFNB) au profit du preneur ; la loi
        n°2025-127 du 14/02/2025 l'a porté de 20 % à <strong>30 %</strong>.
      </p>

      <div className="info" style={{ marginBottom: "1rem", borderLeftColor: "var(--orange-warning)" }}>
        <strong>⚠️ Plusieurs exploitants sur un même avis d'imposition.</strong>{" "}
        Le mode « Montant global + % de surface » répartit chaque taxe au
        prorata de la surface louée : c'est une approximation qui peut
        s'écarter sensiblement de la réalité dès que plusieurs exploitants se
        partagent le même avis, car leurs parcelles n'ont pas forcément la
        même valeur cadastrale. Dans ce cas, préférez pour chaque ligne le
        mode <strong>« Revenu cadastral propre à l'exploitant »</strong>, qui
        calcule l'assiette à partir du revenu cadastral propre à
        l'exploitant concerné (actualisé chaque année — voir l'outil
        ci-dessous).
      </div>

      <OutilRevalorisation />

      {/* Paramètres réglementaires */}
      <div className="info" style={{ marginBottom: "1rem" }}>
        <strong>Paramètres réglementaires (réforme 2025).</strong> Le dégrèvement
        de 30 % s'applique aux parts communale et intercommunale de la TFNB ; le
        coefficient correcteur (1,43 = 100 ÷ 70) reconstitue la taxe théorique à
        partir du montant appelé (base abattue de 30 %).
        <div className="grille" style={{ marginTop: "0.75rem" }}>
          <div className="champ">
            <label htmlFor="degrevement">Taux de dégrèvement preneur (%)</label>
            <input
              id="degrevement"
              inputMode="decimal"
              value={tauxDegrevement}
              onChange={(e) => setTauxDegrevement(e.target.value)}
            />
          </div>
          <div className="champ">
            <label htmlFor="coef">Coefficient correcteur</label>
            <input
              id="coef"
              inputMode="decimal"
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
            />
          </div>
        </div>
      </div>

      {"erreur" in calcul && calcul.erreur && (
        <p className="erreur">{calcul.erreur}</p>
      )}

      {"resultats" in calcul &&
        calcul.resultats.map(({ ligne, res }) => (
          <div className="taxe-bloc" key={ligne.id}>
            <div className="taxe-bloc-titre">
              <span>{ligne.libelle}</span>
              <span className={`badge ${ligne.methode === "tfnb" ? "conforme" : "inferieur"}`}>
                {ligne.methode === "tfnb" ? "TFNB · dégrèvement 2025" : "taxe annexe"}
              </span>
            </div>

            {ligne.note && (
              <p className="intro" style={{ fontSize: "0.85rem", marginTop: "-0.4rem" }}>
                ℹ️ {ligne.note}
              </p>
            )}

            <div className="champ" style={{ marginBottom: "0.75rem" }}>
              <label htmlFor={`mode-${ligne.id}`}>Méthode de calcul de l'assiette</label>
              <select
                id={`mode-${ligne.id}`}
                value={ligne.modeAssiette}
                onChange={(e) => maj(ligne.id, "modeAssiette", e.target.value as ModeAssiette)}
              >
                {(Object.keys(LIBELLES_MODE) as ModeAssiette[]).map((m) => (
                  <option key={m} value={m}>
                    {LIBELLES_MODE[m]}
                    {m === "revenuCadastral" ? " (recommandé si plusieurs exploitants)" : ""}
                  </option>
                ))}
              </select>
            </div>

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
                <>
                  <div className="champ">
                    <label htmlFor={`rc-${ligne.id}`}>Revenu cadastral de l'exploitant (€)</label>
                    <span className="aide">
                      Non dégrevé, propre à ses parcelles (relevé de propriété), actualisé
                    </span>
                    <input
                      id={`rc-${ligne.id}`}
                      inputMode="decimal"
                      value={ligne.revenuCadastral}
                      onChange={(e) => maj(ligne.id, "revenuCadastral", e.target.value)}
                    />
                  </div>
                  <div className="champ">
                    <label htmlFor={`ti-${ligne.id}`}>Taux voté (%)</label>
                    <span className="aide">{ligne.aideTauxImposition}</span>
                    <input
                      id={`ti-${ligne.id}`}
                      inputMode="decimal"
                      value={ligne.tauxImposition}
                      onChange={(e) => maj(ligne.id, "tauxImposition", e.target.value)}
                    />
                  </div>
                </>
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
                    <input
                      id={`sl-${ligne.id}`}
                      inputMode="decimal"
                      value={ligne.surfaceLouee}
                      onChange={(e) => maj(ligne.id, "surfaceLouee", e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="champ">
                <label htmlFor={`tb-${ligne.id}`}>Taux du bail (%)</label>
                <span className="aide">
                  {ligne.id === "chambre"
                    ? "Fixé par la loi (CGI), non contractuel"
                    : "Remboursement prévu au bail"}
                </span>
                <input
                  id={`tb-${ligne.id}`}
                  inputMode="decimal"
                  value={ligne.tauxBail}
                  onChange={(e) => maj(ligne.id, "tauxBail", e.target.value)}
                />
              </div>
              <div className="champ">
                <label htmlFor={`fr-${ligne.id}`}>Frais de rôle (%)</label>
                <span className="aide">{ligne.methode === "tfnb" ? "si taux > dégrèvement" : "frais de recouvrement"}</span>
                <input
                  id={`fr-${ligne.id}`}
                  inputMode="decimal"
                  value={ligne.fraisDeRole}
                  onChange={(e) => maj(ligne.id, "fraisDeRole", e.target.value)}
                />
              </div>
            </div>

            <div className="taxe-resultat">
              <span>
                Montant total : <strong>{formaterEuros(res.montantTotal)}</strong>
              </span>
              {res.imputePreneur < 0 ? (
                <span className="taxe-faveur">
                  En faveur du preneur (réduction de fermage) :{" "}
                  <strong>{formaterEuros(res.imputePreneur)}</strong>
                </span>
              ) : (
                <span>
                  Imputé au preneur :{" "}
                  <strong className="pos">{formaterEuros(res.imputePreneur)}</strong>
                </span>
              )}
            </div>
          </div>
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

      {/* Explication détaillée */}
      <details className="explication">
        <summary>Comment ce calcul fonctionne-t-il&nbsp;?</summary>
        <p>
          <strong>1. L'assiette</strong> (montant de taxe concernant la
          surface louée) peut se calculer de trois façons, au choix sur
          chaque ligne :
        </p>
        <ul>
          <li>
            <strong>Montant global de l'avis + % de surface</strong> : montant
            appelé (totalité de la propriété) × part de surface louée.
            Approximation simple, adaptée à un exploitant unique.
          </li>
          <li>
            <strong>Revenu cadastral propre à l'exploitant</strong> : revenu
            cadastral de l'exploitant (dégrevé de 30 % pour la TFNB et la taxe
            GEMAPI, non dégrevé pour la chambre d'agriculture) × taux voté.
            Méthode recommandée dès qu'il y a plusieurs exploitants sur le
            même avis.
          </li>
          <li>
            <strong>Taux à l'hectare × surface louée</strong> : pour les taxes
            assises directement sur la surface (remembrement, taxes
            syndicales / de marais), suivant le protocole départemental.
          </li>
        </ul>
        <p>
          <strong>2. La répartition</strong> entre preneur et bailleur, une
          fois l'assiette connue :
        </p>
        <p className="formule">
          TFNB (parts communale et intercommunale) — méthode de la réforme
          2025 :<br />
          Imputé au preneur = Montant total × (Taux du bail − Taux de
          dégrèvement) × Coefficient correcteur × (1 + frais de rôle si Taux du
          bail &gt; dégrèvement)
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
            <strong>Taux du bail &gt; 30 %</strong> : remboursement du preneur au
            bailleur, majoré des frais de rôle.
          </li>
        </ul>
        <p>
          <strong>Autres taxes</strong> (chambre d'agriculture, GEMAPI,
          remembrement, taxes syndicales…), non concernées par la formule de
          dégrèvement ci-dessus :
        </p>
        <p className="formule">
          Imputé au preneur = Montant total × Taux du bail × (1 + frais de rôle)
        </p>
        <p>
          Pour la chambre d'agriculture, la loi prévoit un remboursement de
          50 % majoré de 8 % de frais de rôle — taux d'ordre public, non
          modifiable par le bail.
        </p>
      </details>

      <p className="intro" style={{ marginTop: "1.25rem", marginBottom: 0, fontSize: "0.82rem" }}>
        Source : Fédération Nationale de la Propriété Privée Rurale — loi
        n°2025-127 du 14/02/2025, art. L415-3 du Code rural et de la pêche
        maritime. Calcul indicatif, à adapter aux clauses de votre bail. Valeurs
        de référence 2025 : dégrèvement {PARAMS_DEGREVEMENT_2025.tauxDegrevement * 100}
        %, coefficient {PARAMS_DEGREVEMENT_2025.coefficientCorrecteur}.
      </p>
    </section>
  );
}
