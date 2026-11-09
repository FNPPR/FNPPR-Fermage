import { useRef, useState, type ReactNode } from "react";
import {
  exporterDossier,
  lireDossier,
  nomCommune,
  nomExploitant,
  nomFichierDossier,
  nouveauBail,
  nouveauDossier,
  nouvelExploitant,
  nouvelleCommune,
  type Bail,
  type Commune,
  type Coordonnees,
  type Dossier,
  type Exploitant,
} from "../lib/dossier";
import type { Probleme, ResultatDossier } from "../lib/calculDossier";
import { dossierEntame, type EtatDossier } from "../lib/etatDossier";
import { dossierExemple } from "../lib/exempleDossier";
import { ANNEE_MAX, ANNEE_MIN, indicePourAnnee } from "../data/indices";
import { formaterEuros, formaterNombre, formaterNombrePrecis } from "../lib/format";

const CIVILITES = [
  "Madame",
  "Monsieur",
  "Madame, Monsieur",
  "M. et Mme",
  "Mesdames",
  "Messieurs",
  "Mademoiselle",
];

/** Années de calcul possibles : il faut l'indice de l'année et celui de l'année précédente. */
const ANNEES: number[] = [];
for (let a = ANNEE_MAX; a > ANNEE_MIN; a--) ANNEES.push(a);

// ---------------------------------------------------------------------------
// Petits éléments de formulaire
// ---------------------------------------------------------------------------

function Champ({
  id,
  label,
  aide,
  valeur,
  onChange,
  nombre = false,
  placeholder,
  type = "text",
  liste,
  large = false,
}: {
  id: string;
  label: string;
  aide?: ReactNode;
  valeur: string;
  onChange: (v: string) => void;
  nombre?: boolean;
  placeholder?: string;
  type?: "text" | "date" | "email" | "tel";
  liste?: string;
  large?: boolean;
}) {
  return (
    <div className="champ" style={large ? { gridColumn: "1 / -1" } : undefined}>
      <label htmlFor={id}>{label}</label>
      {aide && <span className="aide">{aide}</span>}
      <input
        id={id}
        type={type}
        inputMode={nombre ? "decimal" : undefined}
        value={valeur}
        placeholder={placeholder}
        list={liste}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Bouton de suppression avec confirmation sur place (pas de fenêtre surgissante). */
function BoutonSupprimer({ libelle, onConfirmer }: { libelle: string; onConfirmer: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  if (!confirmer) {
    return (
      <button type="button" className="btn-lien" onClick={() => setConfirmer(true)}>
        {libelle}
      </button>
    );
  }
  return (
    <span className="confirmation">
      <button type="button" className="btn-danger" onClick={onConfirmer}>
        Confirmer
      </button>
      <button type="button" className="btn-lien" onClick={() => setConfirmer(false)}>
        Annuler
      </button>
    </span>
  );
}

function Problemes({ liste }: { liste: Probleme[] }) {
  if (liste.length === 0) return null;
  return (
    <ul className="problemes">
      {liste.map((p, i) => (
        <li key={i} className={p.gravite === "erreur" ? "probleme-erreur" : "probleme-avertissement"}>
          {p.gravite === "erreur" ? "Erreur" : "À vérifier"} : {p.message}
        </li>
      ))}
    </ul>
  );
}

function FormulaireCoordonnees({
  prefixe,
  c,
  maj,
}: {
  prefixe: string;
  c: Coordonnees;
  maj: (champ: keyof Coordonnees, v: string) => void;
}) {
  return (
    <div className="grille">
      <Champ id={`${prefixe}-civilite`} label="Civilité" valeur={c.civilite} liste="liste-civilites"
        placeholder="Madame, Monsieur…" onChange={(v) => maj("civilite", v)} />
      <Champ id={`${prefixe}-nom`} label="Nom" valeur={c.nom} onChange={(v) => maj("nom", v)} />
      <Champ id={`${prefixe}-prenom`} label="Prénom" valeur={c.prenom} onChange={(v) => maj("prenom", v)} />
      <Champ id={`${prefixe}-adresse`} label="Adresse" valeur={c.adresse} onChange={(v) => maj("adresse", v)} />
      <Champ id={`${prefixe}-cp`} label="Code postal" valeur={c.codePostal} onChange={(v) => maj("codePostal", v)} />
      <Champ id={`${prefixe}-ville`} label="Commune" valeur={c.ville} onChange={(v) => maj("ville", v)} />
      <Champ id={`${prefixe}-tel`} label="Téléphone" type="tel" valeur={c.telephone} onChange={(v) => maj("telephone", v)} />
      <Champ id={`${prefixe}-mail`} label="E-mail" type="email" valeur={c.email} onChange={(v) => maj("email", v)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commune
// ---------------------------------------------------------------------------

function CarteCommune({
  commune,
  rang,
  annee,
  problemes,
  maj,
  supprimer,
}: {
  commune: Commune;
  rang: number;
  annee: number;
  problemes: Probleme[];
  maj: (champ: keyof Commune, v: string) => void;
  supprimer: () => void;
}) {
  const p = `commune-${commune.id}`;
  const champ = (cle: keyof Commune, label: string, aide?: ReactNode, placeholder?: string) => (
    <Champ id={`${p}-${cle}`} label={label} aide={aide} placeholder={placeholder} nombre
      valeur={commune[cle]} onChange={(v) => maj(cle, v)} />
  );
  return (
    <div className="fiche-carte">
      <div className="fiche-carte-titre">
        <span>{nomCommune(commune, rang)}</span>
        <BoutonSupprimer libelle="Supprimer la commune" onConfirmer={supprimer} />
      </div>
      <div className="grille">
        <Champ id={`${p}-nom`} label="Nom de la commune" valeur={commune.nom} onChange={(v) => maj("nom", v)} />
        <Champ id={`${p}-cp`} label="Code postal" valeur={commune.codePostal} onChange={(v) => maj("codePostal", v)} />
      </div>
      <p className="fiche-sous-titre">
        Taux votés (%) — avis de taxes foncières {annee}, bas de colonne « Propriétés non bâties »
      </p>
      <div className="grille">
        {champ("tauxCommunal", "Commune", undefined, "ex. 42,89")}
        {champ("tauxIntercommunal", "Intercommunalité", undefined, "ex. 3,35")}
        {champ("tauxChambre", "Chambre d'agriculture", undefined, "ex. 15,24")}
        {champ("tauxGemapi", "Taxe GEMAPI", undefined, "ex. 2,15")}
      </div>
      <p className="fiche-sous-titre">Frais de rôle (%)</p>
      <div className="grille">
        {champ("fraisRoleTaxesFoncieres", "Taxes foncières et GEMAPI", "3 % en règle générale")}
        {champ("fraisRoleChambre", "Chambre d'agriculture", "8 % en règle générale")}
      </div>
      <details className="fiche-details">
        <summary>Remembrement et taxes syndicales (facultatif)</summary>
        <div className="grille">
          {champ("remembrementParHa", "Remembrement (€/ha)", "Taux à l'hectare du protocole départemental")}
          {champ("remembrementPartPreneur", "Part du preneur (%)")}
          {champ("syndicalesParHa", "Taxes syndicales / de marais (€/ha)")}
          {champ("syndicalesPartPreneur", "Part du preneur (%)", "Selon la clause du bail")}
        </div>
      </details>
      <Problemes liste={problemes} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exploitant et ses baux
// ---------------------------------------------------------------------------

function CarteBail({
  bail,
  libelle,
  annee,
  problemes,
  maj,
  retirer,
}: {
  bail: Bail;
  libelle: string;
  annee: number;
  problemes: Probleme[];
  maj: (champ: keyof Bail, v: string) => void;
  retirer: () => void;
}) {
  const p = `bail-${bail.id}`;
  const champ = (cle: keyof Bail, label: string, aide?: ReactNode, placeholder?: string) => (
    <Champ id={`${p}-${cle}`} label={label} aide={aide} placeholder={placeholder} nombre
      valeur={bail[cle]} onChange={(v) => maj(cle, v)} />
  );
  return (
    <div className="fiche-sous-carte">
      <div className="fiche-carte-titre">
        <span>Terres louées à {libelle}</span>
        <BoutonSupprimer libelle="Retirer" onConfirmer={retirer} />
      </div>
      <div className="grille">
        {champ("surface", "Surface louée (ha)", undefined, "ex. 15,23")}
        {champ("fermagePrecedent", `Fermage ${annee - 1} (€)`, "Réévalué automatiquement", "ex. 1729,42")}
        {champ(
          "revenuCadastralPrecedent",
          `Revenu cadastral ${annee - 1} (€)`,
          "Relevé de propriété, parcelles louées à cet exploitant ici",
          "ex. 719",
        )}
      </div>
      <p className="fiche-sous-titre">Taux du bail (%) — part des taxes remboursée par le preneur</p>
      <div className="grille">
        {champ("tauxBail", "Taxes foncières", "Parts communale et intercommunale")}
        {champ("tauxBailGemapi", "Taxe GEMAPI", "0 % si le bail ne prévoit rien")}
      </div>
      <p className="fiche-sous-titre">À déduire (€)</p>
      <div className="grille">
        {champ("acompteVerse", "Acompte déjà versé", `Sur le fermage ${annee}`)}
        {champ("degrevement", "Dégrèvement", "Obtenu par le bailleur, à reverser")}
        {champ("secheresse", "Indemnité sécheresse")}
        {champ("autreDeduction", "Autre déduction")}
      </div>
      <p className="fiche-sous-titre">Divers</p>
      <div className="grille">
        {champ("autreTaxe", "Autre taxe à ajouter (€)", "Toute autre somme due par le preneur")}
        {champ("nombreAcomptes", `Acomptes à prévoir en ${annee + 1}`, "Nombre, avant l'échéance", "0")}
      </div>
      <Problemes liste={problemes} />
    </div>
  );
}

function CarteExploitant({
  dossier,
  exploitant,
  rang,
  problemes,
  majCoordonnees,
  majBail,
  ajouterBail,
  retirerBail,
  supprimer,
}: {
  dossier: Dossier;
  exploitant: Exploitant;
  rang: number;
  problemes: Probleme[];
  majCoordonnees: (champ: keyof Coordonnees, v: string) => void;
  majBail: (id: string, champ: keyof Bail, v: string) => void;
  ajouterBail: (communeId: string) => void;
  retirerBail: (id: string) => void;
  supprimer: () => void;
}) {
  const baux = dossier.communes.flatMap((c, rangCommune) =>
    dossier.baux
      .filter((b) => b.exploitantId === exploitant.id && b.communeId === c.id)
      .map((b) => ({ bail: b, commune: c, rangCommune })),
  );
  const communesLibres = dossier.communes
    .map((c, r) => ({ c, r }))
    .filter(({ c }) => !baux.some((b) => b.commune.id === c.id));
  const [choix, setChoix] = useState("");
  const choixValide = communesLibres.some(({ c }) => c.id === choix) ? choix : communesLibres[0]?.c.id ?? "";

  return (
    <div className="fiche-carte">
      <div className="fiche-carte-titre">
        <span>{nomExploitant(exploitant, rang)}</span>
        <BoutonSupprimer libelle="Supprimer l'exploitant" onConfirmer={supprimer} />
      </div>
      <FormulaireCoordonnees prefixe={`exploitant-${exploitant.id}`} c={exploitant.coordonnees} maj={majCoordonnees} />
      <Problemes liste={problemes.filter((p) => !p.bailId)} />

      {baux.map(({ bail, commune, rangCommune }) => (
        <CarteBail
          key={bail.id}
          bail={bail}
          libelle={nomCommune(commune, rangCommune)}
          annee={dossier.annee}
          problemes={problemes.filter((p) => p.bailId === bail.id)}
          maj={(champ, v) => majBail(bail.id, champ, v)}
          retirer={() => retirerBail(bail.id)}
        />
      ))}

      {dossier.communes.length === 0 ? (
        <p className="aide-bloc">Ajoutez d'abord une commune pour y indiquer les terres louées.</p>
      ) : communesLibres.length === 0 ? null : (
        <div className="ajout-bail">
          <label htmlFor={`ajout-${exploitant.id}`}>Ajouter des terres louées dans</label>
          <select id={`ajout-${exploitant.id}`} value={choixValide} onChange={(e) => setChoix(e.target.value)}>
            {communesLibres.map(({ c, r }) => (
              <option key={c.id} value={c.id}>
                {nomCommune(c, r)}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ajouter" onClick={() => ajouterBail(choixValide)}>
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barre du dossier : nouveau, ouvrir, enregistrer, exemple
// ---------------------------------------------------------------------------

function BarreDossier({ etat }: { etat: EtatDossier }) {
  const { dossier, remplacer } = etat;
  const entree = useRef<HTMLInputElement>(null);
  const [attente, setAttente] = useState<null | "nouveau" | "ouvrir" | "exemple">(null);
  const [message, setMessage] = useState<{ erreur: boolean; texte: string } | null>(null);

  function executer(action: "nouveau" | "ouvrir" | "exemple") {
    setAttente(null);
    setMessage(null);
    if (action === "nouveau") remplacer(nouveauDossier());
    if (action === "exemple") remplacer(dossierExemple());
    if (action === "ouvrir") entree.current?.click();
  }
  function demander(action: "nouveau" | "ouvrir" | "exemple") {
    if (dossierEntame(dossier)) setAttente(action);
    else executer(action);
  }

  function enregistrer() {
    const blob = new Blob([exporterDossier(dossier)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichierDossier(dossier);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage({ erreur: false, texte: `Dossier enregistré sous « ${a.download} » (dossier Téléchargements).` });
  }

  async function ouvrirFichier(fichier: File | undefined) {
    if (!fichier) return;
    try {
      const d = lireDossier(JSON.parse(await fichier.text()));
      remplacer(d);
      setMessage({ erreur: false, texte: `Dossier « ${fichier.name} » ouvert.` });
    } catch (e) {
      setMessage({
        erreur: true,
        texte:
          e instanceof SyntaxError
            ? `« ${fichier.name} » n'est pas un dossier du calculateur (fichier illisible).`
            : e instanceof Error
              ? e.message
              : "Fichier illisible.",
      });
    } finally {
      if (entree.current) entree.current.value = "";
    }
  }

  const libelles = {
    nouveau: "Effacer le dossier en cours pour en commencer un nouveau ?",
    ouvrir: "Le dossier ouvert remplacera le dossier en cours.",
    exemple: "L'exemple remplacera le dossier en cours.",
  };

  return (
    <div className="dossier-barre">
      <div className="dossier-boutons">
        <button type="button" className="btn-ajouter" onClick={() => demander("nouveau")}>
          Nouveau dossier
        </button>
        <button type="button" className="btn-ajouter" onClick={() => demander("ouvrir")}>
          Ouvrir un dossier…
        </button>
        <button type="button" className="btn-ajouter" onClick={enregistrer}>
          Enregistrer le dossier
        </button>
        <button type="button" className="btn-lien" onClick={() => demander("exemple")}>
          Charger l'exemple
        </button>
        <input
          ref={entree}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => ouvrirFichier(e.target.files?.[0])}
        />
      </div>
      {attente && (
        <p className="confirmation-bloc" role="alert">
          {libelles[attente]} Enregistrez-le d'abord si vous voulez le garder.{" "}
          <button type="button" className="btn-danger" onClick={() => executer(attente)}>
            Continuer
          </button>{" "}
          <button type="button" className="btn-lien" onClick={() => setAttente(null)}>
            Annuler
          </button>
        </p>
      )}
      {message && (
        <p className={message.erreur ? "erreur" : "message-ok"} role="status">
          {message.texte}
        </p>
      )}
      <p className="aide-bloc">
        Le dossier est conservé automatiquement sur cet ordinateur, dans ce
        navigateur. Pour le garder durablement, le transmettre ou le rouvrir
        ailleurs, utilisez « Enregistrer le dossier » : un fichier est créé
        dans vos téléchargements. Aucune donnée n'est envoyée sur Internet.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet
// ---------------------------------------------------------------------------

export function RenseignementsGeneraux({
  etat,
  resultat,
  allerA,
}: {
  etat: EtatDossier;
  resultat: ResultatDossier;
  /** Navigation vers les onglets de résultats (absente tant qu'ils n'existent pas). */
  allerA?: (onglet: "taxe" | "appel" | "recap") => void;
}) {
  const { dossier, modifier } = etat;

  const majDossier = <K extends keyof Dossier>(champ: K, v: Dossier[K]) =>
    modifier((d) => ({ ...d, [champ]: v }));
  const majBailleur = (champ: keyof Coordonnees, v: string) =>
    modifier((d) => ({ ...d, bailleur: { ...d.bailleur, [champ]: v } }));
  const majCommune = (id: string, champ: keyof Commune, v: string) =>
    modifier((d) => ({
      ...d,
      communes: d.communes.map((c) => (c.id === id ? { ...c, [champ]: v } : c)),
    }));
  const majExploitant = (id: string, champ: keyof Coordonnees, v: string) =>
    modifier((d) => ({
      ...d,
      exploitants: d.exploitants.map((e) =>
        e.id === id ? { ...e, coordonnees: { ...e.coordonnees, [champ]: v } } : e,
      ),
    }));
  const majBail = (id: string, champ: keyof Bail, v: string) =>
    modifier((d) => ({ ...d, baux: d.baux.map((b) => (b.id === id ? { ...b, [champ]: v } : b)) }));

  const indicePrec = indicePourAnnee(dossier.annee - 1);
  const indice = indicePourAnnee(dossier.annee);
  const erreurs = resultat.problemes.filter((p) => p.gravite === "erreur");
  const avertissements = resultat.problemes.filter((p) => p.gravite === "avertissement");
  const generaux = resultat.problemes.filter((p) => !p.communeId && !p.exploitantId && !p.bailId);

  return (
    <section className="card fiche" aria-labelledby="titre-dossier">
      <h2 id="titre-dossier">Renseignements généraux</h2>
      <p className="intro">
        Une seule fiche par propriétaire : ses communes, ses exploitants et
        les terres louées à chacun dans chaque commune. Les onglets
        Réévaluation, Répartition des taxes, Appels de fermage et
        Récapitulatif se remplissent ensuite automatiquement.
      </p>

      <datalist id="liste-civilites">
        {CIVILITES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <BarreDossier etat={etat} />

      <h3 className="fiche-titre">1. Année de calcul</h3>
      <div className="grille">
        <div className="champ">
          <label htmlFor="d-annee">Année du fermage</label>
          <span className="aide">Le fermage de l'année précédente est réévalué</span>
          <select id="d-annee" value={dossier.annee} onChange={(e) => majDossier("annee", Number(e.target.value))}>
            {ANNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <Champ id="d-echeance" label="Échéance" type="date" valeur={dossier.echeance}
          onChange={(v) => majDossier("echeance", v)} />
        <Champ id="d-revalo" label="Revalorisation des revenus cadastraux (%)" nombre
          aide="0,8 % pour 2026 (loi de finances)" valeur={dossier.revalorisationRevenuCadastral}
          onChange={(v) => majDossier("revalorisationRevenuCadastral", v)} />
        <Champ id="d-degrevement" label="Dégrèvement de la TFNB (%)" nombre
          aide="30 % depuis 2025" valeur={dossier.tauxDegrevement}
          onChange={(v) => majDossier("tauxDegrevement", v)} />
      </div>
      {indice !== undefined && indicePrec !== undefined && (
        <p className="aide-bloc">
          Indice national des fermages : {dossier.annee - 1} = {formaterNombre(indicePrec)}, {dossier.annee} ={" "}
          {formaterNombre(indice)}, soit un coefficient de{" "}
          {formaterNombrePrecis(Number((indice / indicePrec).toFixed(4)))}.
        </p>
      )}
      <Problemes liste={generaux} />

      <h3 className="fiche-titre">2. Bailleur</h3>
      <p className="aide-bloc">Repris en tête et en signature des appels de fermage.</p>
      <FormulaireCoordonnees prefixe="bailleur" c={dossier.bailleur} maj={majBailleur} />

      <h3 className="fiche-titre">3. Communes</h3>
      <p className="aide-bloc">
        Une commune par avis de taxes foncières. Les taux s'appliquent au
        revenu cadastral de chaque exploitant.
      </p>
      {dossier.communes.map((c, rang) => (
        <CarteCommune
          key={c.id}
          commune={c}
          rang={rang}
          annee={dossier.annee}
          problemes={resultat.problemes.filter((p) => p.communeId === c.id && !p.bailId)}
          maj={(champ, v) => majCommune(c.id, champ, v)}
          supprimer={() =>
            modifier((d) => ({
              ...d,
              communes: d.communes.filter((x) => x.id !== c.id),
              baux: d.baux.filter((b) => b.communeId !== c.id),
            }))
          }
        />
      ))}
      <button
        type="button"
        className="btn-ajouter"
        onClick={() => modifier((d) => ({ ...d, communes: [...d.communes, nouvelleCommune()] }))}
      >
        + Ajouter une commune
      </button>

      <h3 className="fiche-titre">4. Exploitants et terres louées</h3>
      <p className="aide-bloc">
        Pour chaque exploitant, ajoutez les terres qu'il loue dans chaque
        commune : un même exploitant peut louer dans plusieurs communes.
      </p>
      {dossier.exploitants.map((e, rang) => (
        <CarteExploitant
          key={e.id}
          dossier={dossier}
          exploitant={e}
          rang={rang}
          problemes={resultat.problemes.filter((p) => p.exploitantId === e.id)}
          majCoordonnees={(champ, v) => majExploitant(e.id, champ, v)}
          majBail={majBail}
          ajouterBail={(communeId) =>
            modifier((d) => ({ ...d, baux: [...d.baux, nouveauBail(e.id, communeId)] }))
          }
          retirerBail={(id) => modifier((d) => ({ ...d, baux: d.baux.filter((b) => b.id !== id) }))}
          supprimer={() =>
            modifier((d) => ({
              ...d,
              exploitants: d.exploitants.filter((x) => x.id !== e.id),
              baux: d.baux.filter((b) => b.exploitantId !== e.id),
            }))
          }
        />
      ))}
      <button
        type="button"
        className="btn-ajouter"
        onClick={() => modifier((d) => ({ ...d, exploitants: [...d.exploitants, nouvelExploitant()] }))}
      >
        + Ajouter un exploitant
      </button>

      <h3 className="fiche-titre">5. Contrôle</h3>
      {resultat.baux.length === 0 && erreurs.length === 0 ? (
        <p className="aide-bloc">
          Ajoutez au moins une commune et un exploitant avec ses terres
          louées, ou chargez l'exemple pour découvrir le calculateur.
        </p>
      ) : (
        <div className={erreurs.length > 0 ? "erreur" : "info"}>
          {erreurs.length > 0 ? (
            <>
              <strong>
                {erreurs.length === 1 ? "1 erreur à corriger" : `${erreurs.length} erreurs à corriger`}
              </strong>{" "}
              : les terres concernées ne sont pas calculées tant que la saisie n'est pas corrigée.
            </>
          ) : (
            <>
              <strong>Saisie complète.</strong> {dossier.communes.length}{" "}
              {dossier.communes.length > 1 ? "communes" : "commune"}, {resultat.parExploitant.length}{" "}
              {resultat.parExploitant.length > 1 ? "exploitants" : "exploitant"},{" "}
              {formaterNombrePrecis(Number(resultat.totaux.surface.toFixed(4)))} ha ; fermages {resultat.annee} :{" "}
              {formaterEuros(resultat.totaux.fermage)}, taxes imputées : {formaterEuros(resultat.totaux.taxes)}.
            </>
          )}
          {avertissements.length > 0 && (
            <> {avertissements.length === 1 ? "1 point à vérifier" : `${avertissements.length} points à vérifier`} (signalés ci-dessus).</>
          )}
        </div>
      )}
      {allerA && resultat.baux.length > 0 && (
        <div className="dossier-suite">
          <button type="button" className="btn-imprimer" onClick={() => allerA("taxe")}>
            Voir la répartition des taxes
          </button>
          <button type="button" className="btn-imprimer" onClick={() => allerA("appel")}>
            Voir les appels de fermage
          </button>
          <button type="button" className="btn-imprimer" onClick={() => allerA("recap")}>
            Voir le récapitulatif
          </button>
        </div>
      )}
    </section>
  );
}
