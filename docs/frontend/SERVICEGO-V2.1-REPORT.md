# ServiceGO V2.1 - Rapport de livraison

Date de verification : 19 octobre 2026  
Branche : `master`  
Reference auditee : `b339c4b`  
Previsualisation : https://servicego-v21-preview.aetbconseil.workers.dev  
Version Cloudflare : `f7d7805e-9f5c-46f6-a552-77fbc3bbfa2f`  
Commit d'implementation : `ede9547` (`feat: preparer ServiceGO V2.1 immersive`)  
Production actuelle non remplacee : https://servicego-maroc.aetbconseil.workers.dev

## Perimetre livre

- Accueil public transforme en une scene persistante pilotee par le scroll, continue et reversible.
- Smartphone tridimensionnel avec carte geographique Leaflet/OpenStreetMap reelle et marqueurs fictifs traduits.
- Personnages officiels detoures sur fond transparent, rapprochement progressif, salut, lueur menthe et conclusion.
- Noyau public translucide qui s'etend horizontalement et remplace `+` par `-`.
- Connexion, inscription, recuperation, FAQ, informations legales et contact refondus en verre depoli.
- FR, EN et AR avec RTL complet sur les interfaces publiques.
- Catalogue photo local, optimise, documente et extensible par pays.

Les cartes membres, tableaux de bord, profils, annonces et administration n'ont pas ete refondus.

## Routes concernees

- `/` : scene publique V2.1 et toutes les fenetres publiques.
- `GET /api/public-context` : pays, region et ville approximatifs exposes par Cloudflare, sans adresse IP.
- `POST /api/auth/register` : adaptateur retrocompatible `prenom + nom -> full_name`, telephone international normalise.
- `POST /api/auth/forgot-password` : parcours reel cote API avec blocage explicite tant que l'envoi et le jeton de reinitialisation ne sont pas configures.
- `POST /api/auth/resend-verification` : ne pretend plus envoyer un message quand Resend n'est pas configure.

## Composants et fichiers

Crees :

- `public/photo-catalog.js`
- `public/assets/servicego-characters.png`
- Six variantes WebP locales dans `public/assets/scenes/`
- `tests/visual-v21.cjs`
- `docs/frontend/screenshots-v21/`

Modifies :

- `public/app.js`
- `public/styles.css`
- `public/tokens.css`
- `public/index.html`
- `worker/index.ts`
- `tests/frontend.test.mjs`

## Localisation et photos

Ordre applique : choix de langue enregistre, preferences du navigateur, repli francais. La langue n'est jamais remplacee par le pays Cloudflare.

Pour les photos, le Worker fournit d'abord le pays Cloudflare. En son absence, seule une region explicite de locale navigateur, par exemple `fr-FR`, peut servir de repli. Une langue seule ne produit pas de pays. Le catalogue selectionne deux photos du pays lorsqu'elles existent, sinon un ensemble international. Le melange a lieu une seule fois au chargement complet, reste stable pendant la visite et les deux images suivantes sont prechargees.

Catalogue actuel : Maroc, France et Espagne, avec identifiant, pays, region, sujet, lumiere, couleurs, orientation, resolution, credit, licence, source et textes alternatifs FR/EN/AR. L'architecture accepte de nouveaux pays sans modifier l'algorithme.

Sources sous licence Unsplash :

- Souhail BIDA : https://unsplash.com/photos/a-group-of-people-walking-down-a-street-next-to-a-train-track-YGqVa6LBuak
- Calin Stan : https://unsplash.com/photos/people-walking-on-street-during-daytime-7a_PHX91su8
- Barthelemy de Mazenod : https://unsplash.com/photos/people-walking-on-street-during-daytime-rukoSoqUNvM
- Elena Jiang : https://unsplash.com/photos/a-group-of-people-walking-across-a-street-In8ZnvROgHg
- Igor Oliyarnik : https://unsplash.com/photos/people-in-a-street-during-daytime-ufm2_BJBRGc
- ZEIHLUND : https://unsplash.com/photos/a-busy-street-with-many-people-qxOpHALiWQA

## Animation

La page utilise une scene `sticky` dans un parcours de `390svh`. Le gestionnaire de scroll calcule une progression normalisee et derive directement l'opacite, la rotation du telephone, la position des personnages, la revelation du titre, le salut, la lueur et la conclusion. Aucun scroll n'est bloque. La remontee reproduit exactement le mouvement inverse. `prefers-reduced-motion` remplace ce parcours par trois compositions lisibles sans animation.

## Noyau public

Le noyau contient Accueil, Connexion et Plus. Plus etend la meme capsule, revele les icones Langue, FAQ, Juridique et Contact, puis devient Moins. Le noyau se ferme avec le bouton, Echap ou un clic exterieur. Les commandes conservent une cible tactile de 40 a 46 px et restent dans l'ecran a 320 px.

## Fenetres publiques

- Fermeture par croix, Echap et clic sur l'arriere-plan.
- Piege de focus et restauration vers la commande d'origine.
- Connexion avec affichage du mot de passe et lien de recuperation.
- Inscription avec prenom/nom separes, email, indicatif modifiable, telephone et mot de passe.
- FAQ de huit questions en accordeon.
- Juridique dans une seule fenetre dont le contenu change par onglet.
- Contact public `aetbconseil@gmail.com` avec lien `mailto:`.

Les informations juridiques absentes sont marquees a completer. Aucune identite d'entreprise, juridiction ou promesse contractuelle n'a ete inventee.

## Cartographie

Google Maps n'a pas ete utilise car aucune cle ni integration officielle n'est configuree. La maquette du telephone reutilise Leaflet avec les tuiles OpenStreetMap deja configurees par le projet. Les annonces du telephone sont exclusivement des composants visuels et ne touchent jamais D1.

## Tests et captures

- `npm test` : 11 tests passes.
- `npm run check` : generation des types Wrangler reussie.
- `node --check public/app.js` : reussi.
- Tests visuels automatises : 23 captures.
- Matrice responsive validee : 320, 375, 390, 768, 1024 et 1440 px.
- Langues verifiees : FR, EN et AR/RTL.
- Themes verifies : clair et sombre.
- Aucun debordement horizontal ni erreur JavaScript detecte dans la matrice.

Les captures avant V2.1 restent celles de V2 documentees dans `QA-REPORT.md`. Les captures apres correction sont dans `docs/frontend/screenshots-v21/` : premier moment, deuxieme moment, rencontre, conclusion, noyau ferme/ouvert, connexion, inscription, FAQ, juridique et contact, sur desktop et mobile, plus un controle arabe RTL.

## Performance

- Les six photos WebP totalisent environ 1,12 Mio; seules deux sont chargees par visite.
- Les images sont servies localement par Cloudflare Assets et peuvent etre mises en cache.
- La carte n'est instanciee qu'une fois par rendu public et est detruite avant remontage.
- Les animations modifient principalement `transform` et `opacity`.
- Les polices restent auto-hebergees.

## Regressions

Les tests existants sur la carte membre privee, l'arrondi des coordonnees, la base D1 et le workflow de deploiement restent verts. Aucun contrat d'annonce, de conversation ou d'administration n'a ete modifie.

## Limitations restantes

- Le catalogue photo ne contient actuellement que MA, FR et ES; les autres pays utilisent l'ensemble international.
- OpenStreetMap public ne fournit pas de SLA commercial. Un fournisseur de tuiles avec contrat sera necessaire avant une montee en charge importante.
- Resend n'est pas configure sur l'environnement. La recuperation de mot de passe et la confirmation email annoncent donc clairement leur indisponibilite au lieu de simuler un envoi.
- Le flux complet de reinitialisation par jeton n'est pas encore deploye.
- Les textes juridiques definitifs et les donnees de l'editeur restent a valider par le proprietaire et un conseil juridique.
- Le backend metier conserve son perimetre operationnel Maroc; V2.1 retire uniquement les limitations marketing des interfaces publiques.

## Dependances externes

- Cloudflare Workers, Assets et D1.
- Leaflet 1.9.4.
- Tuiles et attribution OpenStreetMap.
- Resend, prevu mais non configure.
- Unsplash pour les sources photographiques, copiees et optimisees localement.

## Livraison

La previsualisation Cloudflare est distincte de la production. Elle est prete pour validation humaine. La production ne doit etre remplacee qu'apres accord explicite du proprietaire.
