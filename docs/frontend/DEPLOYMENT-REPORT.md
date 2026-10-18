# Rapport de deploiement V2

Plateforme: Cloudflare Workers avec D1 et ressources statiques.

## Conditions

- Aucune migration destructive.
- Aucun changement de contrat API.
- Assets de scene et polices servis localement.
- Deploiement manuel par Wrangler disponible avec la session Cloudflare locale.
- Pipeline GitHub vert; la publication CI reste conditionnelle aux secrets Cloudflare du depot.

## Dependances externes

- Resend: secrets absents.
- R2: bucket non active.
- OpenStreetMap public: acceptable pour la validation, pas un engagement de capacite commerciale.

L'URL de production reste `https://servicego-maroc.aetbconseil.workers.dev`.

## Publication V2

- Version Cloudflare: `12b8fc01-82b8-4c97-956a-464f8616bfe4`.
- Accueil public verifie apres publication: trois scenes, trois commandes du noyau et logo cadre a 52 px.
- Connexion membre de test, carte et statistiques administrateur verifiees sur la production.
