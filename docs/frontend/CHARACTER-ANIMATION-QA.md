# ServiceGO - Controle de l'animation des personnages

Date : 19 octobre 2026  
Branche : `servicego-v2.1-preview`  
Statut : correction validee localement et prete au deploiement

## Correction

- Le logo matriciel complet n'est plus utilise par l'animation.
- Le personnage bleu et le personnage vert disposent chacun d'un SVG autonome et transparent.
- Le fond blanc, le cercle orange central et les fragments de l'autre personnage sont absents.
- Le mouvement est pilote par la progression du scroll et reste reversible.
- La sequence couvre l'apparition, la separation, le rapprochement, la rencontre, le retour et le rebond final.
- L'amplitude est calculee selon la largeur disponible afin d'eviter tout chevauchement ou debordement sur mobile.

## Verification automatique

- `npm test` : 15 tests reussis.
- `npm run check` : types Wrangler generes avec succes.
- Suite Playwright complete : reussie sur 1440 x 900 et 390 x 844.
- Six positions de scroll controlees par format.
- Aucun chevauchement, aucun debordement horizontal et aucune erreur JavaScript detectes.
- Le rebond final `character-greeting` est verifie automatiquement.

## Captures

Les captures desktop et mobile sont conservees dans `docs/frontend/screenshots-v21/` avec les suffixes suivants :

- `02-characters-emerge`
- `03-characters-separated`
- `04-characters-approach`
- `05-characters-meet`
- `06-characters-return`
- `07-characters-alive`

## Actifs

- `public/assets/servicego-character-blue.svg`
- `public/assets/servicego-character-green.svg`

La production et la previsualisation Cloudflare n'ont pas ete modifiees pendant cette preparation.
