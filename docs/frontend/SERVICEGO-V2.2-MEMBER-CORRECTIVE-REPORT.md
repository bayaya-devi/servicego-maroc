# ServiceGO V2.2 - Rapport du correctif expérience membre

Date de publication : 20 octobre 2026

## Production

- URL : https://servicego-maroc.aetbconseil.workers.dev
- Commit applicatif : `685cd0d`
- Version Cloudflare Workers : `0063d076-6da6-407f-94a7-657595504da6`
- Base D1 : inchangée, aucune migration exécutée

## Retour arrière

- Version Cloudflare précédente : `e5ea0ae6-c0fc-4e45-b66f-e7f6a22567ad`
- Tag Git : `servicego-production-before-member-corrective-20261020`
- Commit Git sauvegardé : `71e45c7`

## Correctifs publiés

- Carte membre en plein écran avec actions flottantes compactes.
- Bulles bleues pour les demandes et vert menthe pour les services, prix réel ou indication à convenir, détails et actions connectées.
- Regroupement adaptatif des annonces selon le niveau de zoom.
- Localisation volontaire, conservée dans le navigateur, avec gestion du refus et des erreurs.
- Messagerie restructurée, conversation plein écran et retour sur mobile.
- Tableau de bord organisé à partir de données réelles du compte.
- Identité ServiceGO renforcée, thèmes clair et sombre, FR/EN/AR et RTL.
- Suppression du débordement horizontal décoratif en arabe sur mobile.

## Vérifications

- `npm test` : 16 tests réussis sur 16.
- `npm run check` : types Cloudflare générés sans erreur.
- `node --check public/app.js` : réussi.
- `git diff --check` : réussi.
- Parcours navigateur local et production : desktop clair et mobile sombre/RTL réussis.
- Création de demande et de service : requêtes POST vérifiées par le test de parcours.
- Carte : regroupement, détail, action et géolocalisation acceptée/refusée vérifiés.
- Messages : liste, conversation mobile et retour vérifiés.
- Tableau de bord : sections, données réelles et absence de débordement vérifiées.
- Routes publiques de production : accueil, carte, messages, profil, configuration, catégories et contexte HTTP 200.
- Routes privées : protection sans session vérifiée.

Les captures de validation se trouvent dans `docs/frontend/screenshots-v22-member-corrective`.

## Limites connues

- Les services externes restent soumis aux secrets et réglages déjà présents dans l'environnement Cloudflare.
- La validation n'a créé, modifié ni supprimé aucune donnée utilisateur de production.
