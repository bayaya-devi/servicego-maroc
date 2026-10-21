# E-mails transactionnels ServiceGo avec Brevo

Date de contrôle : 21 octobre 2026.

## État constaté

Le Worker `servicego-maroc` ne possède actuellement aucun secret d'envoi listé par Cloudflare. Aucun expéditeur Brevo vérifié ni clé API n'est donc utilisable depuis le Worker. Les parcours de vérification et de réinitialisation restent volontairement indisponibles tant que cette configuration externe n'est pas fournie : ils ne simulent pas un envoi.

Le fournisseur retenu par le code est **Brevo**. Resend n'est plus utilisé par le Worker.

## Configuration requise

1. Ouvrir le compte Brevo de l'éditeur A&B TECHNOLOGIES, sans souscrire d'offre payante.
2. Ajouter l'expéditeur `ServiceGo — A&B TECHNOLOGIES <aetbconseil@gmail.com>` dans **Senders, domains, IPs**, puis confirmer le lien reçu dans cette boîte Gmail.
3. L'absence de domaine personnel est admise, mais l'expéditeur Gmail n'est pas un domaine authentifié. Brevo peut remplacer l'adresse affichée pour certains destinataires afin de respecter les règles Gmail/Yahoo/Microsoft. Ne pas modifier les DNS de `gmail.com` ni de `workers.dev`.
4. Créer une clé API Brevo dédiée à ServiceGo dans **SMTP & API > API keys & MCP**.
5. Depuis le dépôt, saisir les secrets sans les copier dans Git ni dans `.dev.vars` :

```powershell
npx wrangler secret put BREVO_API_KEY --name servicego-maroc
npx wrangler secret put BREVO_FROM_EMAIL --name servicego-maroc
```

Pour `BREVO_FROM_EMAIL`, utiliser l'adresse d'expédition vérifiée par Brevo :

```text
aetbconseil@gmail.com
```

`aetbconseil@gmail.com` demeure le `Reply-To` et le contact confidentialité officiel. Son utilisation comme expéditeur est autorisée seulement après la confirmation Brevo.

## Parcours couverts

- Vérification de compte et renvoi du lien : lien aléatoire, hashé, à usage unique, valide 24 heures.
- Modification d'adresse e-mail : même mécanisme, adressé uniquement à la nouvelle adresse.
- Réinitialisation de mot de passe : lien aléatoire, hashé, à usage unique, valide une heure ; les sessions existantes sont invalidées après le changement.
- Limitation D1 des inscriptions, connexions, renvois et réinitialisations.

Les modèles HTML et texte sont intégrés en français, anglais et arabe (RTL). Ils n'exposent ni mot de passe ni jeton dans les journaux. Les notifications de demandes et de messages restent dans l'application : aucun e-mail secondaire n'est envoyé sans préférence explicite de l'utilisateur.

## Vérification après configuration

1. Confirmer la présence des noms de secrets avec `npx wrangler secret list --name servicego-maroc` ; ne jamais afficher leurs valeurs.
2. Créer un compte de test avec une boîte accessible, vérifier la réception et suivre le lien sur desktop et mobile.
3. Tester un renvoi, un lien expiré, un lien déjà utilisé et une adresse inexistante.
4. Tester une réinitialisation : réception, modification du mot de passe, connexion avec le nouveau mot de passe et rejet de l'ancien lien.
5. Conserver seulement les identifiants techniques d'envoi fournis par Brevo dans les journaux Cloudflare, jamais le lien complet ni le jeton.

Tant que ces étapes ne sont pas réalisées avec une boîte réellement accessible, le statut reste **bloqué**, et non « opérationnel ».
