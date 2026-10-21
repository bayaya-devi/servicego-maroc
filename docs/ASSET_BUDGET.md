# Budget des ressources visuelles ServiceGO

## Limites

- Chaque image chargee par l'interface doit rester sous 350 Kio.
- Les photographies d'ambiance sont livrees en WebP.
- Le symbole et les personnages de marque sont livres en SVG transparent.
- Une image non referencee par l'interface ne doit pas rester dans le paquet de production.

Le test `runtime images respect the mobile asset budget` verifie les ressources critiques a chaque execution de `npm test`.

## Controle local du 21 octobre 2026

- Accueil controle dans Chromium en 1440 x 900 et 390 x 844.
- Aucun debordement horizontal observe.
- Aucune erreur JavaScript observee dans la console.
- Le symbole SVG repond en HTTP 200, occupe son cadre de 620 x 420 et conserve un fond transparent.
