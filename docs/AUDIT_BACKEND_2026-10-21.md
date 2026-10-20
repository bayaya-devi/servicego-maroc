# Audit backend ServiceGO

Date : 21 octobre 2026. Cet audit décrit l'etat du depot avant les correctifs de la mission « Integration backend complete ». Une fonctionnalite n'est consideree comme fonctionnelle que lorsqu'une route serveur et une persistance D1 etaient deja presentes dans le code.

| Fonctionnalite | Frontend | API / tables | Etat initial | Correctif necessaire | Validation prevue | Etat final |
| --- | --- | --- | --- | --- | --- | --- |
| Inscription, connexion, deconnexion | Modal d'authentification | `/api/auth/register`, `/login`, `/logout`; `profiles`, `sessions` | Fonctionnelle, e-mail non confirme autorise a se connecter | Ajouter limitation de frequence | Tests API multi-comptes | En cours |
| Confirmation et changement d'e-mail | Profil / lien e-mail | `email_verifications`, Resend | Partiellement fonctionnelle : depend des secrets Resend | Verifier secrets, limiter les envois | Tests conditionnels sans secret | En cours |
| Recuperation de mot de passe | Formulaire « Mot de passe oublie » | `/api/auth/forgot-password` | Non fonctionnelle : retourne 503 meme lorsque Resend est configure | Jeton, e-mail, confirmation, invalidation sessions | Test API complet | A faire |
| Profil et preferences | Editeur de profil | `/api/me`; `profiles`, KV uploads | Fonctionnelle | Conserver validation de propriete des fichiers | Test proprietaire / non-proprietaire | A verifier |
| Suppression de compte | Aucune commande existante | Aucune route | Non fonctionnelle | Ajout du parcours, anonymisation / desactivation, suppression sessions | Test de session invalidee | A faire |
| Demandes et offres de services | Carte et formulaires | `/api/requests`, `/api/services`; D1 | Creation et lecture fonctionnelles | Validation de propriete des photos, edition, fermeture / suppression | Test multi-comptes | A faire |
| Carte et confidentialite de position | Leaflet / bulles | `/api/map` | Fonctionnelle : arrondi a deux decimales | Conserver uniquement des coordonnees publiques arrondies | Test de precision | A verifier |
| Reponses et mise en relation | Modals reponse / demande directe | `/offers`, `/request`, `conversations` | Fonctionnelle | Limiter les abus | Test conversation unique | En cours |
| Messagerie et lectures | Vue messages | `/api/conversations/*/messages`; `messages`, `conversation_reads` | Fonctionnelle, persistante, pas de temps reel | Limitation de debit et notification persistante | Test autorisations | En cours |
| Medias prives | Pieces jointes, profil | `/api/uploads`, `/api/files`; KV | Fonctionnelle avec controle de proprietaire / participant | Verification de references d'annonce et anti-abus | Test acces croise | En cours |
| Evaluation mutuelle | Modal d'evaluation | `/complete`, `/reviews`; `reviews` | Fonctionnelle | Controle des transitions et test multi-comptes | Test E2E | En cours |
| Notifications | Aucune vue dediee | E-mails best effort uniquement | Partiellement fonctionnelle | Table et flux pour evenements representes | Test persistance | A faire |
| Signalements / moderation | Aucun composant existant | Aucun | Non fonctionnelle | Table, route, consultation administrateur | Test autorisation admin | A faire |
| Administration | Tableau admin existant | `/api/admin/overview` | Partiellement fonctionnelle | Ajouter lecture des signalements | Test role | A faire |
| Anti-abus et limitation | Turnstile optionnel | `verifyTurnstile` | Partiellement fonctionnelle | Limitation par session/IP, validation serveur | Tests 429 | A faire |

## Infrastructure constatee

- Worker Cloudflare et assets statiques : configures dans `wrangler.jsonc`.
- D1 de production : configuree et migrations 0001 a 0006 presentes.
- Stockage de fichiers : namespace KV `UPLOADS` configure. Aucun bucket R2 n'est configure, donc le code ne doit pas le presenter comme actif.
- E-mail : integration Resend presente, mais les secrets de production ne sont pas inspectables depuis le depot et ne doivent pas etre supposes configures.
- OAuth Google : absent ; aucune connexion Google factice n'est exposee.

## Risques identifies

1. Absence de limitation de frequence applicative sur les routes sensibles.
2. Recuperation de mot de passe non implementee malgre le formulaire expose.
3. Absence de suppression de compte, de signalement et de notifications persistantes.
4. Creation de demande acceptant initialement une cle de photo sans verifier sa propriete.
5. Absence de modification, fermeture ou suppression des annonces par leur auteur.

Les donnees de production ne sont pas modifiees pendant l'audit. Les migrations ulterieures devront etre additives et ne jamais ecraser les donnees existantes.

## Etat apres implementation locale

| Fonctionnalite | Etat final verifie |
| --- | --- |
| Authentification, sessions et profil | Fonctionnelle en local avec mots de passe PBKDF2, cookie HTTPOnly et autorisations serveur. |
| Recuperation de mot de passe | Fonctionnelle lorsque les secrets Resend sont configures ; le produit retourne une indisponibilite honnete lorsque l'envoi n'est pas configure. |
| Demandes, offres, carte et conversations | Fonctionnelle : scenario a deux comptes execute contre D1 locale. |
| Messages, lectures, medias et localisation volontaire | Fonctionnelle ; les medias sont verifies par proprietaire et usage avant association. |
| Evaluations et fin de prestation | Fonctionnelle : cloture par participant, evaluation mutuelle unique, revelation differee. |
| Edition et retrait d'annonce | Fonctionnelle pour l'auteur, avec controles serveur ; le retrait est une fermeture non destructive. |
| Suppression de compte | Fonctionnelle : desactivation, anonymisation des donnees de profil et invalidation des sessions. |
| Notifications | Fonctionnelle en persistance API pour reponses, messages et changements de prestation. Aucune promesse de push temps reel n'est exposee. |
| Signalements | Fonctionnelle cote API et administration : signalement deduplique, acces administrateur et statuts. |
| Limitation de debit | Fonctionnelle pour inscription, connexion, reinitialisation, reponses, messages, signalements et fichiers via fenetres D1. |

## Limites a maintenir transparentes

- Les secrets Resend et Turnstile ne sont pas lisibles depuis le depot. Leur presence en production doit etre verifiee dans Cloudflare ; aucun e-mail ou captcha ne doit etre presente comme actif sans cette verification.
- Le stockage configure est Cloudflare KV prive, et non R2. Les fichiers sont donc controles par la route Worker existante ; une migration vers R2 restera souhaitable avant une forte charge multimedia.
- La messagerie est persistante avec rafraichissement applicatif, mais aucun temps reel par WebSocket ou Durable Object n'est affiche ni pretendu.
