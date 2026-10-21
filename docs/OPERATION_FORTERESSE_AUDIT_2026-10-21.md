# ServiceGO - Operation Forteresse: audit initial

Date: 21 octobre 2026

Ce document est la photographie du depot avant toute restructuration de l'Operation Forteresse. Il ne remplace pas les controles de production : les secrets Cloudflare, la configuration Brevo et les donnees D1 ne sont volontairement pas affiches ici.

## Architecture constatee

| Surface | Etat | Observation |
| --- | --- | --- |
| Runtime | Verifie et operationnel | Un Cloudflare Worker sert l'API et les assets statiques. |
| Backend | A ameliorer | `worker/index.ts` concentre routes, validation, auth, D1, stockage KV, e-mail et erreurs. |
| Frontend | Verifie et operationnel | Application statique dans `public/`, avec Leaflet fourni localement. |
| Base de donnees | Verifie et operationnel | D1, migrations additives `0001` a `0007`. |
| Fichiers | Verifie et operationnel | KV prive, accessible uniquement via la route Worker. Ce n'est pas R2. |
| E-mail | Verifie et operationnel | Brevo est configure hors depot; les contenus FR/EN/AR sont generes dans le Worker. |
| Observabilite | Implemente mais non verifie | Observabilite Workers activee; logs JSON limites dans le Worker. Aucune alerte externe n'est configuree dans le depot. |
| Deploiement | A ameliorer | GitHub Actions valide les tests puis peut appliquer les migrations et deployer. Il manque le typecheck, un environnement de previsualisation et des tests API de securite. |

## Points d'entree et proprietes

| Module logique | Routes actuelles | Stockage principal |
| --- | --- | --- |
| Authentification | `/api/auth/register`, `/login`, `/logout`, `/verify-email`, `/forgot-password`, `/reset-password`, `/resend-verification` | `profiles`, `sessions`, `email_verifications`, `password_resets` |
| Compte | `/api/me`, `/api/me/password`, `/api/me/email` | `profiles`, `sessions` |
| Catalogue et carte | `/api/categories`, `/api/map`, `/api/requests`, `/api/services` | `categories`, `service_requests`, `user_services` |
| Mise en relation | `/api/requests/:id/offers`, `/api/offers/:id/accept`, `/api/services/:id/request` | `offers`, `conversations`, `messages` |
| Messagerie | `/api/conversations`, `/api/conversations/:id/messages` | `conversations`, `messages`, `conversation_reads` |
| Confiance | `/api/requests/:id/complete`, `/api/requests/:id/reviews`, `/api/reports` | `reviews`, `reports`, `notifications` |
| Fichiers | `/api/uploads`, `/api/files/:key` | KV `UPLOADS` |
| Administration | `/api/admin/overview`, `/api/admin/reports`, `/api/admin/reports/:id` | `profiles`, `reports` |

## Controles existants a preserver

- Mots de passe derives par PBKDF2-SHA-256 avec sel aleatoire et comparaison a temps constant.
- Cookies de session `HttpOnly`, `Secure` en HTTPS et `SameSite=Lax`.
- Requetes D1 parametrees; aucune interpolation d'entree utilisateur dans les requetes SQL auditees.
- Jetons d'e-mail et de reinitialisation stockes sous forme de hachage et a duree limitee.
- Autorisation serveur pour les ressources personnelles, conversations, fichiers et administration.
- Positions publiques de la carte arrondies a deux decimales.
- Contraintes D1 utiles: unicite des e-mails, offres, avis, signalements et conversations.
- `npm audit --omit=dev` ne remonte aucune vulnerabilite connue au 21 octobre 2026.

## Constats classes par criticite

### Elevee

1. **Acceptation concurrente d'offres** - `worker/index.ts:924-945`.
   Deux requetes paralleles peuvent lire deux offres encore `pending`, puis les accepter successivement. La mise a jour de la demande ne conditionne pas la transition sur `status = 'open'`. Resultat possible: deux offres acceptees pour une seule demande. Correctif: transition conditionnelle atomique de la demande avant l'acceptation de l'offre, avec test concurrentiel.

2. **Sessions existantes conservees apres changement de mot de passe** - `worker/index.ts:578-592`.
   Le parcours de reinitialisation invalide deja toutes les sessions, mais le changement depuis les parametres ne le fait pas. Un appareil dont la session a ete volee peut donc rester connecte. Correctif: rotation de session et revocation de toutes les autres sessions apres changement du mot de passe.

### Moyenne

1. **Quotas de publication incomplets** - les routes de creation de demandes et de services n'appliquent pas encore le quota produit des nouveaux comptes. Correctif: quota D1 atomique et test de publications paralleles.
2. **Reenvoi de verification et changement d'e-mail sans limite dediee** - ces flux peuvent solliciter Brevo sans garde-fou applicatif. Correctif: limiter par compte et adresse cible.
3. **Module Worker monolithique** - `worker/index.ts` reunit au moins huit responsabilites sur plus de 1 100 lignes. Correctif progressif: extraire d'abord les primitives d'authentification, validation, erreurs et repositories sans changer les contrats publics.
4. **Erreurs sans identifiant de correlation** - un message generique est renvoye, mais aucune correlation stable n'est fournie a l'utilisateur ou aux logs. Correctif: ajouter `requestId` et un contrat d'erreur stable.
5. **Pas de timeout explicite pour Brevo et Turnstile** - une dependance externe lente peut consommer inutilement le budget d'execution. Correctif: `AbortSignal.timeout` et journalisation structuree minimale.

### Faible / a ameliorer

1. Le pipeline CI n'execute pas `npm run typecheck`, de tests d'API d'autorisation, ni de controle de migrations en base isolee.
2. L'inventaire API et les contrats sont implicites dans le Worker; aucun registre versionne ni schema OpenAPI n'existe.
3. La restriction de taille JSON est delegatee au runtime; des limites applicatives explicites faciliteraient la resistance aux abus.
4. KV convient au volume actuel mais R2 sera preferable avant une montee en charge media significative.

## Risques non confirmes

- La configuration de production Turnstile ne peut pas etre deduite du code: si le secret n'est pas configure, l'inscription reste volontairement possible. Cela doit etre controle dans Cloudflare avant de declarer le captcha actif.
- Les migrations `0006` contiennent une consolidation historique de conversations. Elles ne doivent jamais etre rejouees manuellement ni modifiees.
- Aucun systeme de blocage entre membres n'est present dans le schema ou les routes actuelles; cette exigence reste a planifier avant toute promesse produit correspondante.

## Plan de correction progressif

1. Corriger les deux constats eleves et ajouter les tests de non-regression.
2. Introduire un petit noyau `worker/lib/` pour la securite commune et un registre d'API, sans renommer les routes actuelles.
3. Ajouter les quotas de publication et les limites e-mail.
4. Ajouter erreurs structurees, timeouts externes, tests API negatifs et CI renforcee.
5. Decouper ensuite le Worker par domaines, un domaine a la fois, avec compatibilite complete du frontend.

## Point de retour arriere

Avant tout deploiement Forteresse, creer un tag Git et noter la version Worker active. Un retour arriere Worker ne restaure pas les donnees D1; les migrations futures seront donc additives et testees localement avant toute application distante.
