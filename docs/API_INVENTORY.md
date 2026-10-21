# Inventaire API ServiceGO

Ce registre decrit les contrats actuellement exposes. Les routes restent sans version afin de preserver le frontend en production; toute future API v1 devra etre introduite en parallele et migree progressivement.

| Methode | Chemin | Proprietaire | Authentification | Controle principal |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | Auth | Non | E-mail, mot de passe >= 8, limitation IP, Turnstile si configure |
| POST | `/api/auth/login` | Auth | Non | Limitation IP, session HTTPOnly |
| POST | `/api/auth/logout` | Auth | Session optionnelle | Revocation de la session courante |
| GET | `/api/auth/verify-email` | Auth | Jeton signe | Jeton hache, usage unique, expiration |
| POST | `/api/auth/forgot-password` | Auth | Non | Reponse neutre, limitation IP, jeton hache |
| POST | `/api/auth/reset-password` | Auth | Jeton | Expiration, usage unique, revocation des sessions |
| POST | `/api/auth/resend-verification` | Auth | Session | Compte non confirme, 3/h |
| GET/PATCH/DELETE | `/api/me` | Compte | Session | Proprietaire uniquement |
| POST | `/api/me/password` | Compte | Session | Mot de passe courant, rotation des sessions |
| POST | `/api/me/email` | Compte | Session | Mot de passe courant, 3/h, confirmation par e-mail |
| GET | `/api/map` | Geo | Session | Positions arrondies, maximum 100 elements |
| GET/POST | `/api/requests` | Demandes | Session | Lecture proprietaire, e-mail confirme pour creer |
| PATCH/DELETE | `/api/requests/:id` | Demandes | Session | Proprietaire et demande ouverte |
| GET/POST | `/api/services` | Services | Session | Lecture proprietaire, e-mail confirme pour creer |
| PATCH/DELETE | `/api/services/:id` | Services | Session | Proprietaire uniquement |
| GET/POST | `/api/requests/:id/offers` | Mise en relation | Session | Demandeur pour lire, membre confirme pour repondre |
| POST | `/api/offers/:id/accept` | Mise en relation | Session | Demandeur, transition conditionnelle ouverte -> attribuee |
| POST | `/api/services/:id/request` | Mise en relation | Session | Membre confirme, service tiers disponible |
| GET/POST | `/api/conversations/:id/messages` | Messages | Session | Participant uniquement |
| POST | `/api/uploads` | Media | Session | Membre confirme, type/taille, quota |
| GET | `/api/files/:key` | Media | Session | Proprietaire ou reference autorisee |
| POST | `/api/reports` | Confiance | Session | Membre confirme, deduplication et quota |
| GET/PATCH | `/api/admin/*` | Administration | Session administrateur | `is_admin` lu exclusivement depuis D1 |

Les reponses d'erreur restent compatibles avec le frontend actuel: `{ "error": "message" }`. La normalisation avec codes stables et `requestId` est planifiee avant une migration d'API versionnee.
