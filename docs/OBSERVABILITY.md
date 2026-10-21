# Observabilite et incidents ServiceGO

## Signaux disponibles

- `/api/health` confirme que le Worker repond.
- `/api/health/ready` controle reellement D1 et KV sans retourner de donnee utilisateur.
- Chaque requete API produit un evenement JSON `request_completed` avec identifiant, methode, chemin sans query string, statut, duree et environnement.
- Une exception produit `request_failed`. Les statuts 5xx sont journalises au niveau erreur.
- `wrangler.jsonc` active Cloudflare Workers Observability avec un echantillonnage complet.

Aucun corps de requete, e-mail, jeton, cookie, message, adresse IP ou parametre d'URL n'est inclus dans ces evenements.

## Verification

```powershell
Invoke-RestMethod https://servicego-maroc.aetbconseil.workers.dev/api/health
Invoke-RestMethod https://servicego-maroc.aetbconseil.workers.dev/api/health/ready
npx wrangler tail servicego-maroc --format json
```

## Alerte externe a configurer

Le moniteur externe doit appeler `/api/health/ready`, considerer uniquement HTTP 200 comme sain et alerter apres deux echecs consecutifs. Les destinataires, le fournisseur et l'escalade doivent etre configures dans le compte Cloudflare ou dans un service de supervision autorise. Aucun test d'alerte externe ne peut etre declare reussi tant que cette configuration de compte n'a pas ete observee.

## Reponse a incident

1. Relever `X-Request-Id`, l'heure UTC, le chemin et le statut, sans demander de secret a l'utilisateur.
2. Rechercher cet identifiant dans Workers Observability.
3. Verifier la sonde de disponibilite et les changements de version ou de migration recents.
4. En cas de regression critique, restaurer la version Worker precedente sans annuler une migration additive deja appliquee.
5. Documenter la cause, l'impact, la correction et les controles de non-regression.
