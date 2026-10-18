# Rapport QA frontend V2

Date: 18 octobre 2026

## Controles automatises

- Syntaxe JavaScript avec `node --check`.
- Generation des types Cloudflare avec `wrangler types`.
- Tests Node du design system, de la securite de la carte et du workflow.
- Verification de la session, des publications et de l'arrondi des coordonnees lors de la V1.

## Controles navigateur

- Accueil visiteur: 1440 x 900 et 320 x 700.
- Absence de debordement horizontal du document.
- Logo lisible a 44 px et 52 px.
- Scroll vers la deuxieme scene et rencontre des personnages.
- Noyau Plus, FAQ et fermeture de dialogue.
- Arabe RTL et anglais sur les surfaces publiques critiques.
- Carte membre plein ecran et navigation existante.
- Journal console sans erreur critique.

## Exceptions

- La vue Relief est un traitement visuel Leaflet, pas une carte topographique 3D.
- Les textes d'erreur provenant du backend restent en francais.
- Le test d'envoi Resend et le test R2 sont bloques par l'absence de secrets et de bucket.
- Les informations legales definitives doivent etre fournies et validees par le proprietaire.

