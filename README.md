# ServiceGO

ServiceGO est une marketplace de services a la demande ouverte a tout le Maroc. Les services ne sont pas limites.

Le principe est simple : un meme utilisateur peut demander un service et proposer ses propres services. Par exemple, une personne peut proposer des services de peinture, tout en demandant une intervention de plomberie.

## Lancement MVP

- Couverture : tout le Maroc
- Villes proposees : Casablanca, Rabat, Tanger, Fes, Meknes, Marrakech, Agadir, Oujda, Kenitra, Tetouan, Beni Mellal et Laayoune
- Paiement : prevu plus tard
- Plateforme recommandee : Cloudflare-first

## Stack Cloudflare

ServiceGO doit utiliser Cloudflare autant que possible :

- Cloudflare Workers pour l'API backend.
- Cloudflare Workers Static Assets ou Pages pour l'interface web.
- Cloudflare D1 pour la base relationnelle.
- Cloudflare R2 pour les photos et fichiers.
- Cloudflare Durable Objects pour les conversations temps reel, presence et etats de carte si necessaire.
- Cloudflare KV pour cache, configuration publique et donnees peu critiques.
- Cloudflare Queues pour les traitements asynchrones.
- Cloudflare Turnstile pour limiter les faux comptes et abus.
- Cloudflare WAF, cache et rate limiting pour la protection.
- Cloudflare Analytics/Logs pour le suivi technique.

Auth : Cloudflare ne fournit pas une authentification marketplace grand public cle en main. Le MVP utilise donc une auth custom dans Workers avec D1, sessions HTTP-only, hashing de mot de passe, confirmation d'email Resend et Turnstile.

## Application fonctionnelle

Le projet contient maintenant une application Workers deployable :

- compte unique avec mot de passe hashé et session HTTP-only ;
- publication de demandes et de services dans plusieurs villes marocaines ;
- carte Leaflet interactive avec marqueurs bleus pour les besoins et verts pour les services ;
- reponse a une demande, demande directe a un prestataire, messagerie et acceptation d'offre via l'API ;
- ajout d'une photo vers Cloudflare R2 des que le stockage est active sur le compte Cloudflare ;
- confirmation d'email a la creation, renvoi de lien, et changement d'adresse par lien Resend ;
- workflow GitHub Actions pour appliquer les migrations et deployer.

## Demarrage local

```powershell
npm install
npm run db:local
npm run dev
```

Ouvrir ensuite `http://127.0.0.1:8787`. Pour utiliser un autre port :

```powershell
npx wrangler dev --local --port 8788
```

## Mise en production

1. Se connecter a Cloudflare avec `npx wrangler login`.
2. Creer les ressources : `npx wrangler d1 create servicego-db` et `npx wrangler r2 bucket create servicego-uploads`.
3. Copier l'identifiant D1 renvoye par Cloudflare dans `wrangler.jsonc` a la place de `00000000-0000-0000-0000-000000000000`.
4. Dans Resend, verifier le domaine d'envoi puis choisir une adresse telle que `ServiceGO <bonjour@servicego.ma>`.
5. Configurer les secrets : `npx wrangler secret put RESEND_API_KEY` et `npx wrangler secret put RESEND_FROM_EMAIL`. Ajouter `TURNSTILE_SECRET_KEY` lorsque Turnstile est active.
6. Appliquer la base distante avec `npm run db:remote`, puis deployer avec `npm run deploy`.
7. Pour GitHub Actions, ajouter `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` et `TURNSTILE_SECRET_KEY` dans les secrets du depot.

Les liens de confirmation expirent au bout de 24 heures. Tant qu'une adresse n'est pas confirmee, le compte peut se connecter mais ne peut ni publier, ni repondre, ni lancer une discussion. Cela limite les faux comptes sans creer deux types d'utilisateurs.

La carte utilise Leaflet embarque dans le site. Par defaut, les tuiles OpenStreetMap sont adaptees au developpement et a un faible trafic. Pour un lancement commercial avec trafic significatif, remplacez `MAP_TILE_URL` et `MAP_ATTRIBUTION` dans `wrangler.jsonc` par un fournisseur de tuiles avec contrat/SLA ou par votre propre infrastructure; les tuiles publiques OpenStreetMap ne garantissent pas un service commercial a volume eleve.

## Modele utilisateur

Il n'y a pas deux comptes separes client/travailleur.

Il y a un seul compte utilisateur ServiceGO. Ce compte peut :

- publier une demande de service ;
- proposer un ou plusieurs services ;
- repondre aux demandes des autres ;
- discuter avec un autre utilisateur ;
- recevoir et laisser des notes ;
- passer d'un mode a l'autre tres simplement.

## Experience utilisateur

ServiceGO doit etre ultra simple et intuitif, avec une logique proche d'Uber : carte interactive au centre, grosses bulles visuelles pour les demandes et les prestataires disponibles, boutons tres explicites, pictogrammes, parcours courts et tres peu de texte. L'objectif est que tout le monde puisse l'utiliser, y compris des personnes peu alphabetisees.

## Parcours cible

1. L'utilisateur cree son compte.
2. S'il veut un service, il appuie sur Publier une demande.
3. Sa demande apparait en bulle sur la carte interactive.
4. Un autre utilisateur qui propose ce service clique sur la bulle.
5. Il peut accepter, proposer un prix, envoyer un message ou appeler si l'option existe.
6. Le demandeur choisit une reponse.
7. La messagerie s'ouvre.
8. La mission est terminee, puis chacun peut noter l'autre.

## Livrables du dossier

- [docs/RAPPORT_CONCEPTION.md](docs/RAPPORT_CONCEPTION.md) : cahier de conception complet, architecture, UML Mermaid, modele de donnees, securite.
- [docs/BACKLOG_MVP.md](docs/BACKLOG_MVP.md) : backlog par epics et sprints.
- [docs/PROMPT_MAITRE_CODEX.md](docs/PROMPT_MAITRE_CODEX.md) : prompt pret a coller dans Codex pour generer l'application.


