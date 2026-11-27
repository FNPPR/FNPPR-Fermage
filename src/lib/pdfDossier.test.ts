import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { calculerDossier } from "./calculDossier";
import {
  lireDossier,
  nouveauBail,
  nouveauDossier,
  nouvelExploitant,
  nouvelleCommune,
  type Dossier,
} from "./dossier";
import { dossierExemple } from "./exempleDossier";
import { MESSAGE_PDF_SANS_DONNEES, creerPdfDossier, estUnPdf, lireDonneesPdf } from "./pdfDossier";

const pdfDe = (d: Dossier) => creerPdfDossier(d, calculerDossier(d), new Date(2026, 10, 27));

describe("dossier enregistré en PDF", () => {
  it("crée un vrai PDF, qui se rouvre avec exactement les mêmes données", async () => {
    const d = dossierExemple();
    const octets = await pdfDe(d);
    expect(new TextDecoder().decode(octets.subarray(0, 5))).toBe("%PDF-");
    expect(estUnPdf(octets)).toBe(true);
    const relu = lireDossier(await lireDonneesPdf(octets));
    expect(relu).toEqual(lireDossier(JSON.parse(JSON.stringify(d))));
    // Le dossier rouvert donne les mêmes résultats.
    expect(calculerDossier(relu).totaux).toEqual(calculerDossier(d).totaux);
  });

  it("donne au PDF un titre et plusieurs pages", async () => {
    const doc = await PDFDocument.load(await pdfDe(dossierExemple()), { updateMetadata: false });
    expect(doc.getTitle()).toBe("Dossier de fermages 2026 — PROPRIÉTAIRE Exemple");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("accepte tous les caractères saisis, et les conserve exactement dans les données", async () => {
    const d = dossierExemple();
    d.bailleur.nom = "ŁUKASZ Œuvre 🌾";
    d.bailleur.adresse = "Lieu-dit « Les Prés »\nBP 12 − cedex";
    d.exploitants[0].coordonnees.prenom = "Zoë Ğül";
    d.communes[0].nom = "SAINT-ÉTIENNE-DU-GRÈS";
    const relu = lireDossier(await lireDonneesPdf(await pdfDe(d)));
    expect(relu.bailleur.nom).toBe("ŁUKASZ Œuvre 🌾");
    expect(relu.bailleur.adresse).toBe("Lieu-dit « Les Prés »\nBP 12 − cedex");
    expect(relu.exploitants[0].coordonnees.prenom).toBe("Zoë Ğül");
    expect(relu.communes[0].nom).toBe("SAINT-ÉTIENNE-DU-GRÈS");
  });

  it("s'enregistre aussi quand la fiche est incomplète ou vide", async () => {
    const incomplet = dossierExemple();
    incomplet.communes[1].tauxGemapi = "";
    expect(lireDossier(await lireDonneesPdf(await pdfDe(incomplet))).communes[1].tauxGemapi).toBe("");
    const vide = nouveauDossier(2026);
    expect(lireDossier(await lireDonneesPdf(await pdfDe(vide)))).toEqual(vide);
  });

  it("tient sur plusieurs pages pour un grand dossier", async () => {
    const d = nouveauDossier(2026);
    d.communes = Array.from({ length: 6 }, (_, i) => {
      const c = nouvelleCommune(`c${i}`);
      [c.nom, c.tauxCommunal, c.tauxIntercommunal, c.tauxChambre, c.tauxGemapi] = [`COMMUNE ${i + 1}`, "40", "3", "15", "0"];
      return c;
    });
    d.exploitants = Array.from({ length: 25 }, (_, i) => {
      const e = nouvelExploitant(`e${i}`);
      e.coordonnees.nom = `EXPLOITANT ${i + 1}`;
      return e;
    });
    d.baux = d.exploitants.flatMap((e, i) =>
      d.communes.slice(0, 1 + (i % 6)).map((c) => {
        const b = nouveauBail(e.id, c.id, `${e.id}-${c.id}`);
        [b.surface, b.fermagePrecedent, b.revenuCadastralPrecedent] = ["10", "1000", "500"];
        return b;
      }),
    );
    const octets = await pdfDe(d);
    const doc = await PDFDocument.load(octets, { updateMetadata: false });
    expect(doc.getPageCount()).toBeGreaterThan(5);
    expect(lireDossier(await lireDonneesPdf(octets)).baux).toHaveLength(d.baux.length);
  });

  it("retrouve les données dans les propriétés du PDF si la pièce jointe a disparu", async () => {
    const doc = await PDFDocument.load(await pdfDe(dossierExemple()), { updateMetadata: false });
    doc.catalog.delete(PDFName.of("Names"));
    const sansPieceJointe = await doc.save();
    expect(lireDossier(await lireDonneesPdf(sansPieceJointe)).bailleur.nom).toBe("PROPRIÉTAIRE");
  });

  it("refuse un PDF qui ne vient pas du calculateur", async () => {
    const autre = await PDFDocument.create();
    autre.addPage();
    await expect(lireDonneesPdf(await autre.save())).rejects.toThrow(MESSAGE_PDF_SANS_DONNEES);
    const abime = new TextEncoder().encode("%PDF-1.7\nceci n'est pas un PDF");
    await expect(lireDonneesPdf(abime)).rejects.toThrow("Ce fichier PDF est illisible.");
  });

  it("distingue un PDF d'un ancien fichier de données .json", () => {
    expect(estUnPdf(new TextEncoder().encode('{"format":"fnppr-fermage-dossier"}'))).toBe(false);
  });
});
