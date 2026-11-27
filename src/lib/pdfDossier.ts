/**
 * Enregistrement du dossier en PDF.
 *
 * Le PDF est un document ordinaire, lisible et imprimable : la fiche
 * Renseignements généraux (année, bailleur, communes, exploitants et terres
 * louées) et le résumé des résultats. Il contient aussi les données du
 * dossier : en pièce jointe « dossier-fermages.json » et, par précaution, dans
 * ses propriétés. « Ouvrir un dossier… » relit ces données : le PDF sert à la
 * fois de document à conserver et de fichier à rouvrir dans le calculateur.
 *
 * La bibliothèque pdf-lib n'est chargée qu'au moment d'enregistrer ou
 * d'ouvrir un PDF : le reste du site n'en a pas besoin.
 */

import type { PDFDict, PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import { indicePourAnnee } from "../data/indices";
import type { ResultatBail, ResultatDossier, Totaux } from "./calculDossier";
import { aujourdhuiIso, dateEnLettres } from "./dates";
import {
  FORMAT_DOSSIER,
  exporterDossier,
  nomAffiche,
  nomCommune,
  nomExploitant,
  type Bail,
  type Coordonnees,
  type Dossier,
} from "./dossier";
import {
  formaterEuros,
  formaterEurosPrecis,
  formaterNombre,
  formaterNombrePrecis,
  formaterTaux,
  parseNombre,
  saisieVide,
} from "./format";

/** Nom de la pièce jointe qui contient les données du dossier. */
export const NOM_PIECE_JOINTE = "dossier-fermages.json";
/** Propriété du PDF qui reprend les données (copie de secours). */
const CLE_PROPRIETES = "FnpprDossierFermages";

export const MESSAGE_PDF_SANS_DONNEES =
  "Ce PDF ne contient pas de dossier du calculateur : seuls les PDF créés par « Enregistrer le dossier » peuvent être rouverts.";

type PdfLib = typeof import("pdf-lib");

// ---------------------------------------------------------------------------
// Mise en page
// ---------------------------------------------------------------------------

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = { gauche: 45, droite: 45, haut: 52, bas: 58 };

/** Couleurs du site (variables CSS), en fractions RVB. */
const TEINTES = {
  bleuFonce: [8, 47, 80],
  bleu: [13, 72, 119],
  bleuClair: [230, 237, 244],
  texte: [58, 63, 69],
  doux: [103, 112, 120],
  bord: [215, 220, 226],
  fond: [244, 246, 248],
  rouge: [179, 38, 30],
  orange: [184, 106, 0],
  encadre: [255, 248, 236],
} as const;

type Teinte = keyof typeof TEINTES;

interface Colonne {
  titre: string;
  /** Part de la largeur utile (les parts d'un tableau font 1). */
  part: number;
  droite?: boolean;
}

interface LigneTableau {
  cellules: string[];
  style?: "normal" | "sous-total" | "total";
}

/**
 * Remplace les caractères que la police standard du PDF ne sait pas écrire :
 * signe moins « − » → « - », espace fine → espace insécable, lettres rares →
 * sans accent, le reste → « ? ». Les données jointes, elles, restent exactes.
 */
function preparateurTexte(police: PDFFont): (texte: string) => string {
  const permis = new Set(police.getCharacterSet());
  const remplacements: Record<string, string> = {
    "−": "-",
    " ": " ",
    " ": " ",
    "\t": " ",
    "\r": "",
    "→": "->",
    "≈": "~",
    "≤": "<=",
    "≥": ">=",
    "…": "...",
  };
  return (texte) => {
    let r = "";
    for (const c of texte.normalize("NFC")) {
      if (c === "\n" || permis.has(c.codePointAt(0) ?? 0)) {
        r += c;
        continue;
      }
      const remplacement = remplacements[c];
      if (remplacement !== undefined) {
        r += [...remplacement].every((x) => permis.has(x.codePointAt(0) ?? 0)) ? remplacement : "?";
        continue;
      }
      const sansAccent = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
      r += sansAccent && [...sansAccent].every((x) => permis.has(x.codePointAt(0) ?? 0)) ? sansAccent : "?";
    }
    return r;
  };
}

/** Coupe un texte (déjà préparé) en lignes d'une largeur donnée. */
function couper(texte: string, largeur: number, police: PDFFont, taille: number): string[] {
  const lignes: string[] = [];
  const mesure = (s: string) => police.widthOfTextAtSize(s, taille);
  for (const paragraphe of texte.split("\n")) {
    let ligne = "";
    for (const mot of paragraphe.split(" ")) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (mesure(essai) <= largeur) {
        ligne = essai;
        continue;
      }
      if (ligne) lignes.push(ligne);
      let reste = mot;
      while (reste.length > 1 && mesure(reste) > largeur) {
        let n = reste.length - 1;
        while (n > 1 && mesure(reste.slice(0, n)) > largeur) n--;
        // De préférence après un trait d'union : « SAINT-ÉTIENNE- / DU-GRÈS ».
        const tiret = reste.lastIndexOf("-", n - 1);
        if (tiret > 0) n = tiret + 1;
        lignes.push(reste.slice(0, n));
        reste = reste.slice(n);
      }
      ligne = reste;
    }
    lignes.push(ligne);
  }
  return lignes;
}

class Redaction {
  page!: PDFPage;
  /** Haut de la prochaine ligne. */
  y = 0;
  readonly largeur = A4.largeur - MARGE.gauche - MARGE.droite;
  private readonly t: (texte: string) => string;

  constructor(
    private readonly lib: PdfLib,
    private readonly doc: PDFDocument,
    private readonly normal: PDFFont,
    private readonly gras: PDFFont,
  ) {
    this.t = preparateurTexte(normal);
    this.nouvellePage();
  }

  couleur(teinte: Teinte): RGB {
    const [r, v, b] = TEINTES[teinte];
    return this.lib.rgb(r / 255, v / 255, b / 255);
  }

  nouvellePage(): void {
    this.page = this.doc.addPage([A4.largeur, A4.hauteur]);
    this.y = A4.hauteur - MARGE.haut;
  }

  /** Passe à la page suivante s'il reste moins de `hauteur` points. */
  place(hauteur: number): void {
    if (this.y - hauteur < MARGE.bas) this.nouvellePage();
  }

  /**
   * Garde un bloc d'une seule pièce : s'il tient sur une page mais pas dans
   * la place restante, il commence en haut de la page suivante.
   */
  garderEnsemble(hauteur: number): void {
    if (hauteur <= A4.hauteur - MARGE.haut - MARGE.bas && this.y - hauteur < MARGE.bas) this.nouvellePage();
  }

  /** Hauteur qu'occupera un tableau (même calcul que `tableau`). */
  mesurerTableau(colonnes: Colonne[], lignes: LigneTableau[], { taille = 8.3, entete = true } = {}): number {
    const pad = 3.5;
    const interligne = taille * 1.3;
    const largeurs = colonnes.map((c) => c.part * this.largeur);
    const hauteurDe = (cellules: string[], police: PDFFont) =>
      Math.max(1, ...cellules.map((c, i) => couper(this.t(c), largeurs[i] - 2 * pad, police, taille).length)) *
        interligne +
      2 * pad -
      (interligne - taille) +
      1;
    let total = entete ? hauteurDe(colonnes.map((c) => c.titre), this.gras) : 0;
    for (const l of lignes) {
      const gras = l.style === "total" || l.style === "sous-total";
      total += hauteurDe(l.cellules, gras ? this.gras : this.normal);
    }
    return total + 8;
  }

  ecrire(
    texte: string,
    x: number,
    ligneDeBase: number,
    { taille = 9, gras = false, teinte = "texte" as Teinte } = {},
  ): void {
    this.page.drawText(this.t(texte), {
      x,
      y: ligneDeBase,
      size: taille,
      font: gras ? this.gras : this.normal,
      color: this.couleur(teinte),
    });
  }

  paragraphe(
    texte: string,
    { taille = 9, gras = false, teinte = "texte" as Teinte, retrait = 0, apres = 4 } = {},
  ): void {
    const police = gras ? this.gras : this.normal;
    const interligne = taille * 1.35;
    for (const ligne of couper(this.t(texte), this.largeur - retrait, police, taille)) {
      this.place(interligne);
      this.ecrire(ligne, MARGE.gauche + retrait, this.y - taille, { taille, gras, teinte });
      this.y -= interligne;
    }
    this.y -= apres;
  }

  titre(texte: string): void {
    this.paragraphe(texte, { taille: 17, gras: true, teinte: "bleuFonce", apres: 2 });
  }

  section(texte: string): void {
    this.place(60);
    this.y -= 10;
    this.ecrire(texte, MARGE.gauche, this.y - 12, { taille: 12, gras: true, teinte: "bleu" });
    this.y -= 18;
    this.page.drawLine({
      start: { x: MARGE.gauche, y: this.y },
      end: { x: MARGE.gauche + this.largeur, y: this.y },
      thickness: 0.8,
      color: this.couleur("bleu"),
    });
    this.y -= 8;
  }

  sousSection(texte: string): void {
    this.place(50);
    this.y -= 4;
    this.paragraphe(texte, { taille: 10, gras: true, teinte: "bleuFonce", apres: 2 });
  }

  /** Texte dans un cadre coloré. */
  encadre(texte: string, { taille = 8.5, fond = "encadre" as Teinte, bord = "orange" as Teinte } = {}): void {
    const pad = 7;
    const interligne = taille * 1.35;
    const lignes = couper(this.t(texte), this.largeur - 2 * pad, this.normal, taille);
    const hauteur = lignes.length * interligne + 2 * pad - (interligne - taille);
    this.place(hauteur + 6);
    this.page.drawRectangle({
      x: MARGE.gauche,
      y: this.y - hauteur,
      width: this.largeur,
      height: hauteur,
      color: this.couleur(fond),
    });
    this.page.drawRectangle({ x: MARGE.gauche, y: this.y - hauteur, width: 3, height: hauteur, color: this.couleur(bord) });
    let base = this.y - pad - taille * 0.82;
    for (const ligne of lignes) {
      this.ecrire(ligne, MARGE.gauche + pad + 2, base, { taille });
      base -= interligne;
    }
    this.y -= hauteur + 8;
  }

  tableau(colonnes: Colonne[], lignes: LigneTableau[], { taille = 8.3, entete = true } = {}): void {
    const pad = 3.5;
    const interligne = taille * 1.3;
    const largeurs = colonnes.map((c) => c.part * this.largeur);
    const decoupe = (cellules: string[], police: PDFFont) =>
      cellules.map((c, i) => couper(this.t(c), largeurs[i] - 2 * pad, police, taille));
    const hauteurDe = (blocs: string[][]) =>
      Math.max(1, ...blocs.map((b) => b.length)) * interligne + 2 * pad - (interligne - taille) + 1;

    const dessinerLigne = (
      blocs: string[][],
      { gras = false, fond, teinte = "texte" as Teinte }: { gras?: boolean; fond?: Teinte; teinte?: Teinte },
    ) => {
      const hauteur = hauteurDe(blocs);
      if (fond) {
        this.page.drawRectangle({
          x: MARGE.gauche,
          y: this.y - hauteur,
          width: this.largeur,
          height: hauteur,
          color: this.couleur(fond),
        });
      }
      let x = MARGE.gauche;
      const police = gras ? this.gras : this.normal;
      blocs.forEach((bloc, i) => {
        let base = this.y - pad - taille * 0.82;
        for (const ligne of bloc) {
          const largeurTexte = police.widthOfTextAtSize(ligne, taille);
          const xTexte = colonnes[i].droite ? x + largeurs[i] - pad - largeurTexte : x + pad;
          this.ecrire(ligne, xTexte, base, { taille, gras, teinte });
          base -= interligne;
        }
        x += largeurs[i];
      });
      this.y -= hauteur;
    };

    const dessinerEntete = () => {
      if (!entete) return;
      const blocs = decoupe(
        colonnes.map((c) => c.titre),
        this.gras,
      );
      dessinerLigne(blocs, { gras: true, fond: "bleuClair", teinte: "bleuFonce" });
      this.page.drawLine({
        start: { x: MARGE.gauche, y: this.y },
        end: { x: MARGE.gauche + this.largeur, y: this.y },
        thickness: 0.9,
        color: this.couleur("bleu"),
      });
    };

    const hauteurEntete = entete ? hauteurDe(decoupe(colonnes.map((c) => c.titre), this.gras)) : 0;
    const premiere = lignes[0] ? hauteurDe(decoupe(lignes[0].cellules, this.normal)) : 0;
    this.place(hauteurEntete + premiere);
    dessinerEntete();
    for (const ligne of lignes) {
      const gras = ligne.style === "total" || ligne.style === "sous-total";
      const blocs = decoupe(ligne.cellules, gras ? this.gras : this.normal);
      const hauteur = hauteurDe(blocs);
      if (this.y - hauteur < MARGE.bas) {
        this.nouvellePage();
        dessinerEntete();
      }
      if (ligne.style === "total") {
        this.page.drawLine({
          start: { x: MARGE.gauche, y: this.y },
          end: { x: MARGE.gauche + this.largeur, y: this.y },
          thickness: 1.2,
          color: this.couleur("bleuFonce"),
        });
      }
      dessinerLigne(blocs, {
        gras,
        fond: ligne.style === "total" ? "bleuClair" : ligne.style === "sous-total" ? "fond" : undefined,
        teinte: ligne.style === "total" ? "bleuFonce" : "texte",
      });
      this.page.drawLine({
        start: { x: MARGE.gauche, y: this.y },
        end: { x: MARGE.gauche + this.largeur, y: this.y },
        thickness: 0.4,
        color: this.couleur("bord"),
      });
    }
    this.y -= 8;
  }

  /** Pied de chaque page : titre du dossier et numéro de page. */
  pieds(texte: string): void {
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      const numero = `Page ${i + 1} / ${pages.length}`;
      const taille = 7.5;
      const couleur = this.couleur("doux");
      page.drawLine({
        start: { x: MARGE.gauche, y: MARGE.bas - 18 },
        end: { x: MARGE.gauche + this.largeur, y: MARGE.bas - 18 },
        thickness: 0.4,
        color: this.couleur("bord"),
      });
      page.drawText(this.t(texte), { x: MARGE.gauche, y: MARGE.bas - 30, size: taille, font: this.normal, color: couleur });
      page.drawText(numero, {
        x: MARGE.gauche + this.largeur - this.normal.widthOfTextAtSize(numero, taille),
        y: MARGE.bas - 30,
        size: taille,
        font: this.normal,
        color: couleur,
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Présentation des saisies (telles que tapées, mises en forme si ce sont des nombres)
// ---------------------------------------------------------------------------

const TIRET = "—";
const illisible = (s: string) => `« ${s.trim()} »`;

function montant(s: string): string {
  if (saisieVide(s)) return TIRET;
  const v = parseNombre(s);
  return Number.isFinite(v) ? formaterEurosPrecis(v) : illisible(s);
}

function taux(s: string): string {
  if (saisieVide(s)) return TIRET;
  const v = parseNombre(s);
  return Number.isFinite(v) ? formaterTaux(v / 100) : illisible(s);
}

function nombre(s: string, unite = ""): string {
  if (saisieVide(s)) return TIRET;
  const v = parseNombre(s);
  return Number.isFinite(v) ? `${formaterNombrePrecis(v)}${unite}` : illisible(s);
}

function lignesAdresse(c: Coordonnees): string[] {
  const lignes: string[] = [];
  const nom = [c.civilite, c.nom, c.prenom].map((x) => x.trim()).filter(Boolean).join(" ");
  if (nom) lignes.push(nom);
  for (const l of c.adresse.split("\n").map((x) => x.trim()).filter(Boolean)) lignes.push(l);
  const ville = [c.codePostal.trim(), c.ville.trim()].filter(Boolean).join(" ");
  if (ville) lignes.push(ville);
  if (c.telephone.trim()) lignes.push(`Tél. ${c.telephone.trim()}`);
  if (c.email.trim()) lignes.push(c.email.trim());
  return lignes;
}

/** Paquets de `n` éléments (colonnes d'un tableau trop large). */
function paquets<T>(liste: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < liste.length; i += n) r.push(liste.slice(i, i + n));
  return r;
}

/** Lignes du tableau des résultats : un bail par ligne, sous-totaux par exploitant, total. */
function lignesDesResultats(resultat: ResultatDossier): LigneTableau[] {
  const ligneBail = (b: ResultatBail, premier: boolean): LigneTableau => ({
    cellules: [
      premier ? nomExploitant(b.exploitant, b.rangExploitant) : "",
      nomCommune(b.commune, b.rangCommune),
      formaterEuros(b.fermagePrecedent),
      formaterEuros(b.fermage),
      formaterEuros(b.totalTaxes),
      formaterEuros(b.totalDeductions),
      formaterEuros(b.resteDu),
    ],
  });
  const ligneTotaux = (libelle: string, t: Totaux, style: "sous-total" | "total"): LigneTableau => ({
    style,
    cellules: [
      libelle,
      "",
      formaterEuros(t.fermagePrecedent),
      formaterEuros(t.fermage),
      formaterEuros(t.taxes),
      formaterEuros(t.deductions),
      formaterEuros(t.resteDu),
    ],
  });
  if (resultat.baux.length === 0) return [];
  const lignes: LigneTableau[] = [];
  for (const g of resultat.parExploitant) {
    g.baux.forEach((b, i) => lignes.push(ligneBail(b, i === 0)));
    if (g.baux.length > 1) {
      lignes.push(ligneTotaux(`Total ${nomExploitant(g.exploitant, g.rang)}`, g.totaux, "sous-total"));
    }
  }
  lignes.push(ligneTotaux("Total de la propriété", resultat.totaux, "total"));
  return lignes;
}

// ---------------------------------------------------------------------------
// Création du PDF
// ---------------------------------------------------------------------------

/**
 * Crée le PDF du dossier : document lisible (fiche et résultats) contenant
 * les données, à rouvrir avec `lireDonneesPdf`.
 */
export async function creerPdfDossier(
  dossier: Dossier,
  resultat: ResultatDossier,
  maintenant: Date = new Date(),
): Promise<Uint8Array> {
  const lib = await import("pdf-lib");
  const doc = await lib.PDFDocument.create();
  const normal = await doc.embedFont(lib.StandardFonts.Helvetica);
  const gras = await doc.embedFont(lib.StandardFonts.HelveticaBold);
  const r = new Redaction(lib, doc, normal, gras);

  const annee = dossier.annee;
  const proprietaire = nomAffiche(dossier.bailleur, "");
  const titre = `Dossier de fermages ${annee}${proprietaire ? ` — ${proprietaire}` : ""}`;

  // En-tête
  r.titre(`Dossier de fermages ${annee}`);
  if (proprietaire) r.paragraphe(`Propriétaire : ${proprietaire}`, { taille: 11, gras: true, apres: 2 });
  r.paragraphe(
    `Enregistré le ${dateEnLettres(aujourdhuiIso(maintenant))} avec le calculateur de fermage de la Fédération Nationale de la Propriété Privée Rurale.`,
    { taille: 8.5, teinte: "doux", apres: 8 },
  );
  r.encadre(
    "Ce PDF contient les données du dossier. Pour le reprendre dans le calculateur (corriger une saisie, préparer l'année suivante…), ouvrez l'onglet Renseignements généraux, cliquez sur « Ouvrir un dossier… » et choisissez ce fichier. Conservez-le tel quel : un PDF réimprimé ou modifié par un autre logiciel peut perdre ces données.",
  );

  // 1. Année de calcul
  r.section("1. Année de calcul");
  const indice = indicePourAnnee(annee);
  const indicePrecedent = indicePourAnnee(annee - 1);
  r.tableau(
    [
      { titre: "", part: 0.42 },
      { titre: "", part: 0.58 },
    ],
    [
      { cellules: ["Année du fermage", String(annee)] },
      { cellules: ["Échéance", dossier.echeance.trim() ? dateEnLettres(dossier.echeance) : TIRET] },
      {
        cellules: [
          "Indice national des fermages",
          indice !== undefined && indicePrecedent !== undefined
            ? `${annee - 1} : ${formaterNombre(indicePrecedent)} ; ${annee} : ${formaterNombre(indice)}`
            : TIRET,
        ],
      },
      { cellules: ["Revalorisation des revenus cadastraux", taux(dossier.revalorisationRevenuCadastral)] },
      { cellules: ["Dégrèvement de la TFNB", taux(dossier.tauxDegrevement)] },
    ],
    { entete: false, taille: 9 },
  );

  // 2. Bailleur
  r.section("2. Bailleur");
  const adresseBailleur = lignesAdresse(dossier.bailleur);
  r.paragraphe(adresseBailleur.length ? adresseBailleur.join("\n") : "Non renseigné.", { taille: 9.5 });

  // 3. Communes
  r.section("3. Communes");
  if (dossier.communes.length === 0) {
    r.paragraphe("Aucune commune.");
  } else {
    r.paragraphe("Taux votés (avis de taxes foncières), frais de rôle (TF : taxes foncières et GEMAPI), remembrement et taxes syndicales.", {
      taille: 8.5,
      teinte: "doux",
    });
    r.tableau(
      [
        { titre: "Commune", part: 0.19 },
        { titre: "Taux communal", part: 0.1, droite: true },
        { titre: "Taux intercomm.", part: 0.11, droite: true },
        { titre: "Taux chambre", part: 0.1, droite: true },
        { titre: "Taux GEMAPI", part: 0.1, droite: true },
        { titre: "Frais de rôle TF / chambre", part: 0.14, droite: true },
        { titre: "Remembrement, taxes syndicales", part: 0.26 },
      ],
      dossier.communes.map((c, rang) => {
        const annexes: string[] = [];
        if (!saisieVide(c.remembrementParHa) || !saisieVide(c.remembrementPartPreneur)) {
          annexes.push(`Remembrement : ${montant(c.remembrementParHa)}/ha, part du preneur ${taux(c.remembrementPartPreneur)}`);
        }
        if (!saisieVide(c.syndicalesParHa) || !saisieVide(c.syndicalesPartPreneur)) {
          annexes.push(`Syndicales : ${montant(c.syndicalesParHa)}/ha, part du preneur ${taux(c.syndicalesPartPreneur)}`);
        }
        return {
          cellules: [
            [nomCommune(c, rang), c.codePostal.trim()].filter(Boolean).join("\n"),
            taux(c.tauxCommunal),
            taux(c.tauxIntercommunal),
            taux(c.tauxChambre),
            taux(c.tauxGemapi),
            `${taux(c.fraisRoleTaxesFoncieres)} / ${taux(c.fraisRoleChambre)}`,
            annexes.length ? annexes.join("\n") : TIRET,
          ],
        };
      }),
    );
  }

  // 4. Exploitants et terres louées
  r.section("4. Exploitants et terres louées");
  if (dossier.exploitants.length === 0) r.paragraphe("Aucun exploitant.");
  dossier.exploitants.forEach((exploitant, rang) => {
    const adresse = lignesAdresse(exploitant.coordonnees);
    const baux: { bail: Bail; commune: string }[] = dossier.communes.flatMap((c, rangCommune) =>
      dossier.baux
        .filter((b) => b.exploitantId === exploitant.id && b.communeId === c.id)
        .map((b) => ({ bail: b, commune: nomCommune(c, rangCommune) })),
    );
    const champs: [string, (b: Bail) => string][] = [
      ["Surface louée", (b) => nombre(b.surface, " ha")],
      [`Fermage ${annee - 1}`, (b) => montant(b.fermagePrecedent)],
      [`Revenu cadastral ${annee - 1}`, (b) => montant(b.revenuCadastralPrecedent)],
      ["Taux du bail (taxes foncières)", (b) => taux(b.tauxBail)],
      ["Taux du bail (GEMAPI)", (b) => taux(b.tauxBailGemapi)],
      ["Acompte déjà versé", (b) => montant(b.acompteVerse)],
      ["Dégrèvement", (b) => montant(b.degrevement)],
      ["Indemnité sécheresse", (b) => montant(b.secheresse)],
      ["Autre déduction", (b) => montant(b.autreDeduction)],
      ["Autre taxe à ajouter", (b) => montant(b.autreTaxe)],
      [`Acomptes à prévoir en ${annee + 1}`, (b) => nombre(b.nombreAcomptes)],
    ];
    const tableaux = paquets(baux, 4).map((groupe) => {
      const part = 0.64 / groupe.length;
      return {
        colonnes: [
          { titre: "Terres louées", part: 0.36 },
          ...groupe.map((g) => ({ titre: g.commune, part, droite: true })),
        ] as Colonne[],
        lignes: champs.map(([libelle, valeur]) => ({ cellules: [libelle, ...groupe.map((g) => valeur(g.bail))] })),
      };
    });
    // Le nom de l'exploitant ne reste pas seul en bas de page.
    r.garderEnsemble(
      40 + (tableaux[0] ? r.mesurerTableau(tableaux[0].colonnes, tableaux[0].lignes) : 20),
    );
    r.sousSection(nomExploitant(exploitant, rang));
    if (adresse.length) r.paragraphe(adresse.join(" · "), { taille: 8.5, teinte: "doux" });
    if (tableaux.length === 0) r.paragraphe("Aucune terre louée indiquée.", { taille: 8.5 });
    for (const t of tableaux) {
      r.garderEnsemble(r.mesurerTableau(t.colonnes, t.lignes));
      r.tableau(t.colonnes, t.lignes);
    }
  });

  // 5. Résultats
  const colonnesResultats: Colonne[] = [
    { titre: "Exploitant", part: 0.19 },
    { titre: "Commune", part: 0.16 },
    { titre: `Fermage ${annee - 1}`, part: 0.12, droite: true },
    { titre: `Fermage ${annee}`, part: 0.12, droite: true },
    { titre: "Taxes imputées", part: 0.12, droite: true },
    { titre: "Déductions", part: 0.13, droite: true },
    { titre: "Reste à devoir", part: 0.16, droite: true },
  ];
  const lignesResultats = resultat.sansErreur ? lignesDesResultats(resultat) : [];
  if (lignesResultats.length) {
    r.garderEnsemble(110 + r.mesurerTableau(colonnesResultats, lignesResultats));
  }
  r.section(`5. Résultats ${annee}`);
  const erreurs = resultat.problemes.filter((p) => p.gravite === "erreur");
  if (!resultat.sansErreur) {
    r.paragraphe(
      `Résultats non calculés : la fiche comporte ${
        erreurs.length > 1 ? `${erreurs.length} points` : "un point"
      } à corriger.`,
      { gras: true, teinte: "rouge" },
    );
    for (const p of erreurs) r.paragraphe(`• ${p.ou} : ${p.message}`, { taille: 8.5, retrait: 8, apres: 1 });
  } else if (resultat.baux.length === 0) {
    r.paragraphe("Aucune terre louée n'est renseignée : pas de résultat.");
  } else {
    r.paragraphe(
      `Fermages ${annee} réévalués selon l'indice national des fermages ; taxes imputées aux preneurs calculées sur le revenu cadastral de chaque exploitant${
        resultat.arrondiRevenuCadastral ? ", actualisé et arrondi à l'euro le plus proche" : ""
      } ; reste à devoir à l'échéance du ${dateEnLettres(resultat.echeance)}. Le détail figure dans les onglets Répartition des taxes, Appels de fermage et Récapitulatif du calculateur.`,
      { taille: 8.5, teinte: "doux" },
    );
    r.tableau(colonnesResultats, lignesResultats);
  }
  const avertissements = resultat.problemes.filter((p) => p.gravite === "avertissement");
  if (avertissements.length) {
    r.paragraphe("Points à vérifier (ils n'empêchent pas le calcul) :", { taille: 8.5, gras: true });
    for (const p of avertissements) r.paragraphe(`• ${p.ou} : ${p.message}`, { taille: 8.5, retrait: 8, apres: 1 });
  }

  r.pieds(`${titre} · calculateur de fermage FNPPR`);

  // Propriétés du document
  doc.setTitle(titre);
  doc.setSubject("Dossier du calculateur de fermage de la FNPPR (données jointes)");
  doc.setCreator("Calculateur de fermage — Fédération Nationale de la Propriété Privée Rurale");
  doc.setProducer("Calculateur de fermage — FNPPR");
  doc.setLanguage("fr-FR");
  doc.setCreationDate(maintenant);
  doc.setModificationDate(maintenant);

  // Données du dossier : pièce jointe, et copie dans les propriétés.
  const donnees = exporterDossier(dossier);
  await doc.attach(new TextEncoder().encode(donnees), NOM_PIECE_JOINTE, {
    mimeType: "application/json",
    description: "Données du dossier, à rouvrir avec « Ouvrir un dossier… » dans le calculateur de fermage",
    creationDate: maintenant,
    modificationDate: maintenant,
  });
  (doc as unknown as { getInfoDict(): PDFDict })
    .getInfoDict()
    .set(lib.PDFName.of(CLE_PROPRIETES), lib.PDFHexString.fromText(donnees));

  return doc.save();
}

// ---------------------------------------------------------------------------
// Lecture d'un PDF enregistré
// ---------------------------------------------------------------------------

/** Vrai si les octets sont ceux d'un fichier PDF. */
export function estUnPdf(octets: Uint8Array): boolean {
  const debut = Array.from(octets.subarray(0, 1024), (o) => String.fromCharCode(o)).join("");
  return debut.includes("%PDF-");
}

/**
 * Relit les données d'un dossier dans un PDF créé par `creerPdfDossier` :
 * pièce jointe d'abord, propriétés du document ensuite.
 * @throws si le PDF est illisible ou ne contient pas de dossier.
 */
export async function lireDonneesPdf(octets: Uint8Array): Promise<unknown> {
  const lib = await import("pdf-lib");
  const { PDFArray, PDFDict, PDFHexString, PDFName, PDFRawStream, PDFString } = lib;
  const ILLISIBLE = "Ce fichier PDF est illisible.";
  let doc: PDFDocument;
  try {
    doc = await lib.PDFDocument.load(octets, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new Error(ILLISIBLE);
  }
  if (!doc.catalog) throw new Error(ILLISIBLE);

  const dossierDans = (texte: string): unknown => {
    try {
      const o: unknown = JSON.parse(texte);
      return o && typeof o === "object" && (o as { format?: unknown }).format === FORMAT_DOSSIER ? o : undefined;
    } catch {
      return undefined;
    }
  };

  // 1. Pièces jointes : arbre de noms « EmbeddedFiles », à plat ou en sous-arbres.
  const fichiers: PDFDict[] = [];
  const parcourir = (noeud: PDFDict | undefined, profondeur: number) => {
    if (!noeud || profondeur > 16) return;
    const noms = noeud.lookupMaybe(PDFName.of("Names"), PDFArray);
    if (noms) {
      for (let i = 1; i < noms.size(); i += 2) {
        const spec = noms.lookupMaybe(i, PDFDict);
        if (spec) fichiers.push(spec);
      }
    }
    const enfants = noeud.lookupMaybe(PDFName.of("Kids"), PDFArray);
    if (enfants) {
      for (let i = 0; i < enfants.size(); i++) parcourir(enfants.lookupMaybe(i, PDFDict), profondeur + 1);
    }
  };
  try {
    parcourir(
      doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict)?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict),
      0,
    );
  } catch {
    // structure inattendue : on cherche encore dans les propriétés
  }
  const decodeur = new TextDecoder("utf-8");
  for (const spec of fichiers) {
    const flux = spec.lookupMaybe(PDFName.of("EF"), PDFDict)?.lookup(PDFName.of("F"));
    if (!(flux instanceof PDFRawStream)) continue;
    try {
      const trouve = dossierDans(decodeur.decode(lib.decodePDFRawStream(flux).decode()));
      if (trouve) return trouve;
    } catch {
      // pièce jointe illisible : on essaie la suivante
    }
  }

  // 2. Copie dans les propriétés du document.
  try {
    const info = (doc as unknown as { getInfoDict(): PDFDict }).getInfoDict();
    const copie = info.lookup(PDFName.of(CLE_PROPRIETES));
    if (copie instanceof PDFHexString || copie instanceof PDFString) {
      const trouve = dossierDans(copie.decodeText());
      if (trouve) return trouve;
    }
  } catch {
    // propriétés illisibles
  }

  throw new Error(MESSAGE_PDF_SANS_DONNEES);
}
