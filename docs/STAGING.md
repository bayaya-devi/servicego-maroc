# Environnement de préproduction ServiceGO

La préproduction utilise des ressources Cloudflare distinctes de la production :

- Worker : `servicego-maroc-staging`
- URL : `https://servicego-maroc-staging.aetbconseil.workers.dev`
- D1 : `servicego-staging`
- KV : `servicego-staging-uploads`
- configuration : environnement `staging` dans `wrangler.jsonc`

Les secrets ne sont jamais hérités de la production. Ils doivent être configurés explicitement avec `wrangler secret put <NOM> --env staging`. En leur absence, les parcours qui dépendent de Brevo ou Turnstile restent volontairement indisponibles et l'état de préparation le signale.

## Déploiement contrôlé

```powershell
npm test
npm run typecheck
npm run check
npx wrangler d1 migrations apply servicego-staging --remote --env staging
npx wrangler deploy --env staging
```

Après le déploiement, vérifier `/api/health`, `/api/health/ready`, les en-têtes de sécurité et les parcours sans écriture destructive.

Le 21 octobre 2026, les douze migrations ont été appliquées sur D1 staging et la version Worker `9aae9b2b-7be5-4e9d-bc4f-f56db111f0ee` a passé les contrôles suivants : accueil `200`, santé `200`, D1 `ready`, KV `ready`, CSP, HSTS, `nosniff`, `Referrer-Policy` et `Permissions-Policy`. L'e-mail staging reste `not_configured` tant que ses secrets dédiés ne sont pas fournis.

## Sauvegarde et retour arrière

Avant toute migration future, relever les migrations déjà appliquées et exporter D1 avec `wrangler d1 export servicego-staging --remote --output <fichier>`. Conserver l'export hors du dépôt. Les migrations doivent rester additives : un retour arrière du Worker ne retire pas une migration D1 déjà appliquée.

Pour revenir au code précédent, redéployer une version Worker connue depuis Cloudflare. Ne restaurer un export D1 qu'après analyse explicite de l'impact sur les données créées depuis la sauvegarde.
