import { useState } from "react";
import { IndexationCalculator } from "./components/IndexationCalculator";
import { BornesPrefectorales } from "./components/BornesPrefectorales";
import { TaxeFonciere } from "./components/TaxeFonciere";
import { IndicesTable } from "./components/IndicesTable";
import { RevueAd } from "./components/RevueAd";
import { ANNEE_MAX } from "./data/indices";
import logoUrl from "./assets/logo-fnppr.jpg";

const FNPPR = {
  site: "https://www.propriete-rurale.com",
  linkedin:
    "https://www.linkedin.com/company/f%C3%A9d%C3%A9ration-nationale-de-la-propri%C3%A9t%C3%A9-priv%C3%A9e-rurale/",
  x: "https://x.com/FNPPROfficiel",
  youtube: "https://www.youtube.com/channel/UCFz3OZlSKkXUpyieafRTqDg",
};

type Onglet = "indexation" | "bornes" | "taxe" | "indices";

const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: "indexation", libelle: "Réévaluation" },
  { id: "bornes", libelle: "Minimas et Maximas" },
  { id: "taxe", libelle: "Répartition des taxes foncières et assimilées" },
  { id: "indices", libelle: "Tableau des indices" },
];

export function App() {
  const [onglet, setOnglet] = useState<Onglet>("indexation");

  return (
    <>
      <header className="app-header">
        <div className="inner">
          <img
            className="logo"
            src={logoUrl}
            alt="Logo Fédération Nationale de la Propriété Privée Rurale"
          />
          <div>
            <h1>Calculateur de fermage</h1>
            <p>
              Pour les propriétaires ruraux — réévaluation selon l'indice
              national, minimas et maximas et répartition des taxes foncières
              et assimilées.
            </p>
          </div>
        </div>
      </header>

      <main>
        <div className="layout">
          <RevueAd />

          <div className="contenu">
            <nav className="tabs" aria-label="Modules de calcul">
              {ONGLETS.map((o) => (
                <button
                  key={o.id}
                  className={onglet === o.id ? "active" : undefined}
                  onClick={() => setOnglet(o.id)}
                  aria-pressed={onglet === o.id}
                >
                  {o.libelle}
                </button>
              ))}
            </nav>

            {onglet === "indexation" && <IndexationCalculator />}
            {onglet === "bornes" && <BornesPrefectorales />}
            {onglet === "taxe" && <TaxeFonciere />}
            {onglet === "indices" && <IndicesTable />}
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p style={{ margin: "0 0 0.3rem", fontWeight: 600, color: "var(--bleu-fonce)" }}>
          Fédération Nationale de la Propriété Privée Rurale
        </p>
        <nav className="reseaux" aria-label="Liens FNPPR">
          <a href={FNPPR.site} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.93 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14a7.96 7.96 0 0 1 0-4h3.38a16.6 16.6 0 0 0 0 4H4.26Zm.81 2h2.95c.34 1.27.81 2.48 1.38 3.56A8.03 8.03 0 0 1 5.07 16Zm2.95-8H5.07a8.03 8.03 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.02 8ZM12 19.96A13.7 13.7 0 0 1 10.09 16h3.82A13.7 13.7 0 0 1 12 19.96ZM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4Zm.28 5.56c.57-1.08 1.04-2.29 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56ZM16.36 14a16.6 16.6 0 0 0 0-4h3.38a7.96 7.96 0 0 1 0 4h-3.38Z" />
            </svg>
            Site officiel
          </a>
          <a href={FNPPR.linkedin} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21H9V9Z" />
            </svg>
            LinkedIn
          </a>
          <a href={FNPPR.x} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.24 2H21.5l-7.5 8.57L22.5 22h-6.6l-5.17-6.76L4.8 22H1.54l8.02-9.17L1.5 2h6.77l4.67 6.18L18.24 2Zm-1.16 18h1.8L7.02 3.9H5.1L17.08 20Z" />
            </svg>
            X (Twitter)
          </a>
          <a href={FNPPR.youtube} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.5 3.56 12 3.56 12 3.56s-7.5 0-9.38.52A3 3 0 0 0 .5 6.2C0 8.08 0 12 0 12s0 3.92.5 5.8a3 3 0 0 0 2.12 2.12c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 0 0 2.12-2.12C24 15.92 24 12 24 12s0-3.92-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
            </svg>
            YouTube
          </a>
        </nav>
        <div className="avertissement">
          <strong>Avertissement.</strong> Ce calculateur est fourni à titre
          indicatif. Les montants obtenus ne se substituent pas aux arrêtés
          préfectoraux ni à la réglementation en vigueur (Code rural et de la
          pêche maritime, art. L411-11 et suivants). En cas de doute, rapprochez-vous
          de votre chambre d'agriculture, d'un notaire ou des services de l'État.
        </div>
        <p style={{ margin: "0 0 0.3rem" }}>
          <strong>Sources des indices</strong> (mis à jour jusqu'à l'indice{" "}
          {ANNEE_MAX}) :
        </p>
        <ul>
          <li>
            Arrêté du 11 août 2026 constatant l'indice national des fermages
            2026 —{" "}
            <a
              href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054673171"
              target="_blank"
              rel="noopener noreferrer"
            >
              Légifrance
            </a>
          </li>
          <li>
            Arrêté du 23 juillet 2025 constatant l'indice national des fermages
            2025 —{" "}
            <a
              href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051987943"
              target="_blank"
              rel="noopener noreferrer"
            >
              Légifrance
            </a>
          </li>
        </ul>
      </footer>
    </>
  );
}
