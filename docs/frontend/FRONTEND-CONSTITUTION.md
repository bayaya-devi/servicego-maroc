# Constitution frontend ServiceGO

## Principes

1. Un seul compte permet de demander et de proposer.
2. La carte operationnelle appartient a l'espace connecte.
3. Chaque action principale doit etre comprise sans texte long.
4. Le bleu identifie une demande, l'orange une offre et le menthe une mise en relation ou une confirmation.
5. Les interfaces restent utilisables au clavier, au toucher, avec lecteur d'ecran et en RTL.
6. Une fonction non branchee au backend ne doit jamais etre presentee comme active.

## Navigation

- Visiteur: accueil, presentation concise, connexion et creation de compte.
- Membre: carte, messages, activite, profil et creation rapide par le bouton `C+`.
- Administrateur: meme espace membre, complete par une vue admin reservee.
- Le noyau flottant est la navigation principale. Le panneau `C+` contient les actions secondaires.
- Le bouton d'information donne acces aux mentions produit sans footer lourd.

## Design system

Les sources de verite sont `public/tokens.css` et les composants de `public/styles.css`.

- Primaire bleu: `#2585E6`
- Accent orange: `#FF9138`
- Connexion menthe: `#43C6A5`
- Rayon composant: 8 px maximum, sauf bulles, avatars et controles circulaires.
- Cible interactive: 44 x 44 px minimum.
- Police latine: Manrope auto-hebergee. Police arabe: Noto Sans Arabic auto-hebergee.
- Effet verre: reserve a la navigation et aux panneaux flottants; toujours avec bordure et solution de repli.

## Contenu

- Une action, un verbe: Demander, Proposer, Repondre, Contacter.
- Les titres sont courts; les details restent dans le panneau de selection.
- Les erreurs expliquent la prochaine etape sans exposer de detail technique.
- Les traductions FR, EN et AR couvrent toute la coque et les parcours critiques.

## Carte et confidentialite

- Les positions affichees sont approximatives.
- La liste associee a la carte constitue l'alternative clavier.
- Les filtres de type et categorie sont disponibles sans cacher l'action principale.
- La vue relief est un effet de presentation, pas une mesure geographique 3D.

## Qualite

- Toute nouvelle vue doit fonctionner a 320, 768, 1024 et 1440 px.
- Toute modale doit avoir un titre, `role=dialog`, fermeture Echap et restauration du focus.
- Les changements de vue mettent a jour le titre du document.
- Les animations respectent `prefers-reduced-motion`.
- Une route admin doit etre protegee a la fois dans l'interface et dans l'API.

## ServiceGO Ambient Light

- La lumiere bleue accompagne la decouverte et les demandes.
- La lumiere peche accompagne les offres.
- La lumiere menthe apparait au moment de la rencontre.
- Les ombres suivent quatre niveaux: contact, flottante, panneau et profondeur.
- Les surfaces translucides sont reservees aux noyaux et panneaux flottants.
- Les photographies restent lisibles derriere des couches atmospheriques qui garantissent le contraste.

## Mouvement

- Les scenes apparaissent avec `IntersectionObserver`; le scroll reste naturel.
- Les personnages se rapprochent une seule fois par entree dans la scene.
- Le retour en haut n'apparait qu'apres 72 % du parcours public.
- `prefers-reduced-motion` remplace les mouvements par une composition statique.

## Logo

Le PNG officiel demeure la reference. Les variantes d'interface utilisent des masques et positions CSS sur ce meme fichier. Aucun trait, personnage ou symbole n'est recree.

