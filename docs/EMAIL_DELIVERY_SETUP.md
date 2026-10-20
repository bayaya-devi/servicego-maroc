# E-mails transactionnels ServiceGo

Date de contrôle : 21 octobre 2026.

## État constaté

Le Worker `servicego-maroc` ne possède actuellement aucun secret d'envoi listé par Cloudflare. Aucun expéditeur Resend ou Brevo, ni domaine vérifié, n'est donc vérifiable depuis ce dépôt. Les parcours de vérification et de réinitialisation restent volontairement indisponibles tant que cette configuration externe n'est pas fournie : ils ne simulent pas un envoi.

Le fournisseur retenu par le code est **Resend**, déjà intégré au Worker. Aucun deuxième fournisseur n'est activé.

## Configuration requise

1. Créer ou ouvrir le compte Resend de l'éditeur A&B TECHNOLOGIES, sans souscrire d'offre payante sans validation préalable.
2. Ajouter un domaine réellement contrôlé par l'éditeur dans Resend et suivre la validation DNS proposée par Resend (SPF et DKIM ; DMARC recommandé). Ne modifier aucun enregistrement existant sans en vérifier l'impact.
3. Attendre la confirmation de Resend : le domaine et l'adresse d'expédition ne sont pas considérés comme vérifiés avant cette étape.
4. Créer une clé API Resend limitée à l'envoi transactionnel.
5. Depuis le dépôt, saisir les secrets sans les copier dans Git ni dans `.dev.vars` :

```powershell
npx wrangler secret put RESEND_API_KEY --name servicego-maroc
npx wrangler secret put RESEND_FROM_EMAIL --name servicego-maroc
```

Pour `RESEND_FROM_EMAIL`, utiliser une valeur autorisée par Resend, par exemple :

```text
ServiceGo — A&B TECHNOLOGIES <bonjour@votre-domaine.tld>
```

`aetbconseil@gmail.com` demeure le `Reply-To` et le contact confidentialité officiel ; ce n'est pas automatiquement une adresse d'expédition Resend autorisée.

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
5. Conserver seulement les identifiants techniques d'envoi fournis par Resend dans les journaux Cloudflare, jamais le lien complet ni le jeton.

Tant que ces étapes ne sont pas réalisées avec un domaine et une boîte réellement accessibles, le statut reste **bloqué**, et non « opérationnel ».
