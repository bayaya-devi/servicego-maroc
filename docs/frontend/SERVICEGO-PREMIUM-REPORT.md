# ServiceGO Premium

## État initial

La modernisation part de la V2.3 déployée au commit `6367f64`. Les parcours existants ont été conservés : compte unique, authentification, carte mondiale, appui long, demandes, services proposés, réponses, conversations, médias, géolocalisation, profils, préférences et évaluations mutuelles.

La référence visuelle antérieure reste disponible dans `docs/frontend/screenshots-v23/`. Le point de retour Git est le tag `servicego-production-before-premium-20261020`.

## Design system

La couche `public/premium.css` est chargée après le socle validé. Elle peut donc être retirée sans modifier les contrats fonctionnels.

Trois niveaux de verre sont centralisés :

- `--sg-glass-1` : commandes flottantes et navigation.
- `--sg-glass-2` : panneaux, fiches et zones de travail.
- `--sg-glass-3` : fenêtres, messages et surfaces prioritaires.

Chaque niveau possède une transparence, une bordure, une profondeur et un flou distincts. Les navigateurs sans `backdrop-filter` reçoivent une surface opaque lisible. Le bleu reste réservé aux demandes et actions principales, le vert menthe aux services et à l'entraide, et l'orange aux accents ponctuels.

## Typographie

Manrope reste la famille latine afin d'éviter le poids réseau d'une nouvelle police. Les titres utilisent sa graisse expressive 800 avec des tailles fixes par palier d'écran. Noto Sans Arabic reste la famille arabe. Le RTL, les longueurs de textes et les alignements sont vérifiés dans la matrice visuelle.

## Mouvement

Les boutons, noyaux, bulles, conversations, cartes et fenêtres disposent de retours courts fondés sur `transform` et `opacity`. Les mouvements ambiants existants des lignes ServiceGO sont conservés. `prefers-reduced-motion` désactive les animations non essentielles.

## Écrans modernisés

- Accueil : hiérarchie renforcée, téléphone plus net, CTA d'urgence en verre et personnages préservés.
- Authentification : fenêtre immersive sur ordinateur, feuille basse sur mobile, contrastes sombre et clair corrigés.
- Carte : navigation, localisation, bulles, regroupements, panneau de détail et aide discrète affinés sans ajouter de panneau permanent.
- Messagerie : lignes identitaires bleues et vertes, conversations, avatars, pièces jointes et zone de saisie mieux hiérarchisés.
- Profil : couverture, identité, activités, échanges, suivi et évaluations harmonisés avec les données réelles.
- Paramètres, FAQ, informations légales, notifications et états vides : même profondeur et mêmes règles typographiques.

## Adaptation par appareil

L'ordinateur conserve plusieurs zones visibles simultanément. La tablette utilise une composition intermédiaire à deux zones. Sur mobile, les fenêtres deviennent des feuilles basses, la carte reste plein écran, la navigation demeure accessible au pouce et la messagerie réserve une zone dédiée pour que la barre membre ne recouvre pas la saisie.

## Validation

Contrôles automatisés :

- Tests Node : contenu, routes, traductions FR/EN/AR, UTF-8 et règles Premium.
- TypeScript : Worker Cloudflare vérifié sans émission.
- Wrangler : types et préparation du déploiement.
- Sécurité des dépendances : audit de production.
- Test média réel : connexion et envoi multipart vers Cloudflare KV en production.
- Matrice Playwright : 320, 360, 390, 768, 1280 et 1440 px ; FR, EN et AR ; clair et sombre.
- Contrôles visuels : page non vide, absence de débordement horizontal et absence de texte débordant dans les boutons.

Les captures finales sont dans `docs/frontend/screenshots-premium/`.

## Régressions corrigées

- Titre d'accueil masqué par le noyau de navigation sur mobile étroit.
- Zone de composition de message recouverte par la navigation mobile.
- Champs trop clairs et peu cohérents dans les fenêtres sombres.
- Débordement horizontal de la page profil à 768 px.
- Captures effectuées avant la fin des animations d'entrée.

## Limites restantes

- L'envoi de courriels transactionnels nécessite toujours les secrets Cloudflare `RESEND_API_KEY` et `RESEND_FROM_EMAIL`. Ils ne sont pas présents dans le compte de production ; l'inscription et la récupération ne peuvent donc pas envoyer de message réel tant qu'ils ne sont pas fournis.
- Les mentions légales indiquées comme « à compléter » doivent être validées par le propriétaire avant une commercialisation complète.
- Cloudflare R2 n'est pas activé sur le compte. Les médias utilisent actuellement le namespace KV `UPLOADS`, testé avec succès.
