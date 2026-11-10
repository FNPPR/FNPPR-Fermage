# FNPPR-Fermage — Calculateur de fermage

Application web destinée aux **propriétaires ruraux** pour calculer et
contrôler les fermages (loyers des baux ruraux). Construite en **React + Vite +
TypeScript**, sans backend : tout est calculé côté navigateur et peut être
hébergé sur n'importe quel hébergement statique (GitHub Pages, Netlify…).

## Fonctionnalités

Le calculateur travaille sur un **dossier de propriétaire** : un bailleur,
ses communes (une par avis de taxes foncières) et ses exploitants, dont
certains louent des terres dans plusieurs communes — sur le modèle de la
matrice FNPPR « calcul par revenu cadastral » (novembre 2026). Les onglets,
dans l'ordre de la note FNPPR d'octobre 2026 :

1. **Renseignements généraux** — la fiche du dossier : année de calcul
   (indices, revalorisation des revenus cadastraux, dégrèvement de la TFNB),
   bailleur, communes (taux votés, frais de rôle, remembrement et taxes
   syndicales), exploitants et, pour chacun, les terres louées dans chaque
   commune (surface, fermage et revenu cadastral de l'an dernier, taux du
   bail taxes foncières et GEMAPI, acompte versé, dégrèvement, indemnité
   sécheresse, autre taxe, autre déduction, acomptes de l'année suivante).
   Autant de communes et d'exploitants que nécessaire. Les erreurs de saisie
   sont signalées sur la commune ou les terres concernées. Le dossier est
   conservé automatiquement dans le navigateur, s'enregistre dans un
   fichier (`.json`) et se rouvre ; un exemple peut être chargé.
2. **Réévaluation** — tous les fermages du dossier réévalués selon l'indice
   national des fermages (`fermage = fermage de l'an dernier × indice de
   l'année ÷ indice de l'an dernier`), puis le calculateur simple d'un
   fermage, avec historique année par année.
3. **Minimas et Maximas** — contrôle d'un loyer par rapport à la fourchette
   de l'arrêté préfectoral du département (voir ci-dessous).
4. **Répartition des taxes foncières et assimilées** — commune par commune,
   les taxes imputées à chaque exploitant, calculées sur **son revenu
   cadastral** (relevé de propriété, non minoré de 30 %, revalorisé de
   l'année) : TFNB parts communale et intercommunale, chambre d'agriculture,
   GEMAPI, remembrement, taxes syndicales et autres taxes. Un **détail des
   calculs** imprimable donne pour chaque ligne la formule et les valeurs.
5. **Appels de fermage** — un appel par exploitant regroupant toutes ses
   communes (colonnes par commune et total), ou un appel par commune :
   fermage réévalué, impôts et taxes, déductions, reste à devoir et acomptes
   de l'année suivante. Impression d'un appel ou de tous (un par page A4).
6. **Récapitulatif** — fermages et charges de toute la propriété, par
   exploitant et par commune, pour le propriétaire (déclaration des revenus
   fonciers) ; imprimé en A4 paysage.
7. **Tableau des indices** — l'indice national des fermages de 2009 à 2026.

### Règles de calcul (`src/lib/calculDossier.ts`)

- TFNB, parts communale et intercommunale : revenu cadastral × taux voté ×
  (taux du bail − dégrèvement), majoré des frais de rôle seulement si le
  résultat est positif (négatif = réduction de fermage en faveur du preneur).
- Chambre d'agriculture : revenu cadastral × taux voté × 50 % × (1 + frais de
  rôle) ; part de 50 % fixe (art. 1604 du CGI, art. L514-1 du Code rural).
- GEMAPI : revenu cadastral × (1 − dégrèvement) × taux voté × taux du bail
  GEMAPI × (1 + frais de rôle) : base réduite comme la TFNB, mais sans
  soustraction du dégrèvement à la répartition (ce n'est pas une taxe
  foncière). Imposition récente : vérifier que le bail prévoit son
  remboursement.
- Remembrement, taxes syndicales : montant à l'hectare × surface × part du
  preneur.
- Reste dû = fermage + taxes − (acompte + dégrèvement + indemnité sécheresse
  + autre déduction) ; acompte de l'année suivante = fermage ÷ (nombre
  d'acomptes + 1).

### Garanties d'exactitude

- Aucun arrondi intermédiaire ; chaque montant retenu est arrondi au centime
  (arrondi commercial d'Excel, y compris pour les montants négatifs) et
  chaque total est la somme des montants arrondis : un appel de fermage est
  toujours égal à la somme de ses lignes.
- Deux **exemples de référence** sont rejoués à chaque modification par les
  tests automatiques (`src/lib/calculDossier.test.ts`) : les matrices FNPPR
  d'octobre et de novembre 2026 (2 communes × 3 exploitants, noms fictifs),
  retrouvées au centime — à l'exception, pour celle de novembre, de ses deux
  erreurs documentées dans `src/lib/exempleDossier.ts`.
- Le détail imprimé de chaque calcul, refait à la calculatrice, redonne
  exactement le montant retenu (vérifié par un test sur 2 000 cas).

Non traité à ce jour : la variation de surface en cours d'année (règle de
prorata à préciser).

## L'indice national des fermages

Base 100 en 2009. Depuis la loi de modernisation de l'agriculture du
27 juillet 2010, l'indice est national et unique : composé à 60 % de
l'évolution du revenu brut d'entreprise agricole à l'hectare (sur les cinq
années précédentes) et à 40 % de l'évolution du niveau général des prix de
l'année précédente. Il est constaté chaque année par arrêté ministériel.

Les valeurs sont stockées dans [`src/data/indices.ts`](src/data/indices.ts).
**Pour mettre à jour** lors de la publication de l'arrêté annuel (en général en
juillet), ajoutez une ligne au tableau `INDICES_FERMAGE`.

Sources :

- [Arrêté du 11 août 2026](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054673171) — indice 2026 = 127,04 (+3,23 %)
- [Arrêté du 23 juillet 2025](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051987943) — indice 2025 = 123,06 (+0,42 %)

## Barèmes préfectoraux

Les fourchettes de loyer (minima / maxima par hectare) sont fixées
**département par département** par arrêté préfectoral, révisé chaque année et
variable selon la nature et la catégorie des terres. Il n'existe pas de barème
national unique.

Les données sont dans [`src/data/baremes.ts`](src/data/baremes.ts), structuré
en deux parties :

- **`DEPARTEMENTS`** : la liste de **tous les départements français** (métropole
  + outre-mer). Le module Bornes propose chacun d'eux et, via
  `rechercheArreteUrl()`, un lien menant directement à l'arrêté préfectoral
  officiel du département (recherche ciblée sur les sites `.gouv.fr`, robuste
  aux refontes de sites).
- **`BAREMES_VERIFIES`** : un registre de barèmes **réels, sourcés et datés**,
  extraits des arrêtés officiels. Les minima/maxima ne sont pré-remplis (et
  signalés par ✓ dans la liste) que pour ces départements. Amorcé avec le
  **Cher** (arrêté DDT-2024-376 du 19 septembre 2024).

Il n'existe pas de base nationale unique : chaque préfecture publie son propre
arrêté, révisé chaque année et variable selon la nature des terres. **Pour
ajouter un barème vérifié**, ajoutez une entrée à `BAREMES_VERIFIES` (clé = code
département) en recopiant les valeurs de l'arrêté en vigueur, avec sa référence,
sa campagne et l'URL de la source. Pour les départements non encore intégrés,
l'utilisateur consulte l'arrêté officiel via le lien fourni et saisit les
valeurs manuellement.

## Déploiement

Un workflow GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
construit et publie le site sur **GitHub Pages** à chaque push sur `main`.

Pour l'activer : dans les réglages du dépôt, **Settings → Pages → Build and
deployment → Source : GitHub Actions**. Le site sera alors disponible sur
`https://<utilisateur>.github.io/FNPPR-Fermage/`. La configuration Vite utilise
un `base` relatif, compatible avec un hébergement en sous-répertoire.

### Versions conservées

- **Version du 27 octobre 2026** (un exploitant à la fois) : en ligne à
  l'adresse `…/FNPPR-Fermage/version-27-octobre/` (bandeau qui la signale,
  version compilée rangée dans `public/version-27-octobre/`) et sur la
  branche `claude/version-publiee-2026-10-27` (commit `e234cbe`). Pour
  retirer la copie en ligne, supprimer ce dossier.
- **Version de septembre 2026** : en ligne à l'adresse
  `…/FNPPR-Fermage/ancienne-version/` (bandeau qui la signale, version
  compilée rangée dans `public/ancienne-version/`, que Vite recopie telle
  quelle) et sur la branche `claude/ancienne-version-2026-10-27` (commit
  `fed3ad6`). Pour retirer la copie en ligne, supprimer ce dossier.

Pour revenir à une version précédente, annuler (« Revert ») sur GitHub la
fusion qui l'a remplacée : le site est republié automatiquement.

## Développement

Prérequis : Node.js 18+.

```bash
npm install        # installer les dépendances
npm run dev        # serveur de développement (http://localhost:5173)
npm test           # lancer les tests unitaires (Vitest)
npm run build      # vérification TypeScript + build de production (dossier dist/)
npm run preview    # prévisualiser le build de production
```

## Structure

```
src/
  data/indices.ts           Valeurs officielles de l'indice national des fermages
  data/baremes.ts           Départements et barèmes préfectoraux vérifiés
  lib/dossier.ts            Dossier d'un propriétaire : types, création, lecture d'un fichier
  lib/calculDossier.ts      Calcul du dossier : fermages, taxes, déductions, totaux
  lib/exempleDossier.ts     Exemple de référence (matrice FNPPR de novembre 2026, noms fictifs)
  lib/etatDossier.ts        Dossier en cours, partagé par les onglets et conservé dans le navigateur
  lib/taxeFonciere.ts       Formules de répartition d'une taxe et détail chiffré du calcul
  lib/fermage.ts            Réévaluation, historique, bornes préfectorales, arrondi
  lib/etatFermageBase.ts    État du calculateur simple de réévaluation
  lib/format.ts             Lecture des saisies et formatage € / % / nombres (fr-FR)
  components/               Un composant par onglet (+ communDossier.tsx, éléments partagés)
  App.tsx                   Mise en page et navigation par onglets
  main.tsx                  Point d'entrée React
```

## Avertissement

Ce calculateur est fourni à titre **indicatif**. Les montants obtenus ne se
substituent pas aux arrêtés préfectoraux ni à la réglementation en vigueur
(Code rural et de la pêche maritime, articles L411-11 et suivants). En cas de
doute, rapprochez-vous de votre chambre d'agriculture, d'un notaire ou des
services de l'État.
