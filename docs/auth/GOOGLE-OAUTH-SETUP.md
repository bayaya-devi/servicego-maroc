# Google OAuth pour ServiceGO

Google OAuth n'est pas configuré dans le dépôt ni dans l'environnement Cloudflare actuel. Le bouton « Continuer avec Google » reste donc masqué afin de ne pas présenter un parcours factice.

## Éléments à fournir

- Un projet Google Cloud appartenant au propriétaire de ServiceGO.
- Un client OAuth 2.0 de type application Web.
- L'identifiant client Google.
- Le secret client Google, stocké avec `wrangler secret put` et jamais dans Git.
- Les origines JavaScript autorisées pour la prévisualisation et la production.
- Les URI de redirection autorisées pour la prévisualisation et la production.
- Une adresse de support et un écran de consentement Google validés.

## Travail technique restant

1. Ajouter les variables publiques nécessaires à `/api/config` sans exposer le secret.
2. Créer la route de démarrage OAuth avec un `state` signé et une protection PKCE.
3. Créer le callback serveur et échanger le code côté Worker.
4. Vérifier l'identité Google et associer l'adresse à un compte existant sans doublon.
5. Créer la session ServiceGO avec le cookie sécurisé existant.
6. Gérer les refus, expirations, erreurs de callback et comptes déjà associés.
7. Ajouter des tests d'intégration sur les environnements de prévisualisation et de production.

L'activation ne doit intervenir qu'après fourniture des identifiants officiels et validation des URI de redirection.
