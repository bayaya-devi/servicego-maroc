# Phase 1 - deploiement securise

## Pre-deploiement

- Migration `0008_phase1_request_quota.sql` additive uniquement.
- Aucun schema existant, aucune donnee utilisateur et aucun role ne sont modifies.
- Retour arriere compatible : le code peut etre restaure sans retirer l'index ajoute; l'index est sans effet sans le nouveau code.
- Le point de retour Worker existant doit etre releve avec `wrangler deployments list` immediatement avant toute publication.

## Controles requis avant production

1. `npm test`
2. `npm run typecheck`
3. `npm run check`
4. Appliquer la migration sur une preproduction D1 isolee.
5. Verifier `/api/health`, `/`, `/api/config`, les en-tetes et l'inscription.
6. Verifier le reset avec une boite de test autorisee et confirmer la reception reelle.
7. Configurer et verifier une vraie paire Turnstile pour le domaine de production.
8. Deployer seulement si tous les controles critiques sont verts.

## Etat de cette phase

Pas de deploiement realise par ce document. La verification reelle Brevo et la configuration Turnstile de production sont des preconditions bloquantes pour annoncer SG-004 et SG-005 termines.
