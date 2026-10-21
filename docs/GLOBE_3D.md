# Globe 3D ServiceGO

Le mode 3D utilise Three.js, charge uniquement lorsqu'un membre ouvre la carte en mode globe. Les demandes bleues et les services verts sont positionnes a partir de leurs coordonnees reelles et peuvent etre selectionnes par raycasting.

Le globe prend en charge la rotation au pointeur, le zoom a la molette, le redimensionnement et la liberation explicite des ressources GPU. La rotation s'interrompt lorsque l'onglet est masque.

Leaflet reste le mode de secours. Il est selectionne automatiquement sur les petits ecrans, lorsque WebGL est indisponible ou lorsque `prefers-reduced-motion: reduce` est actif. Le membre peut aussi basculer manuellement entre 2D et 3D.

Verifications du 21 octobre 2026 :

- Chromium desktop 1440 x 900 : canvas WebGL present, mode 3D actif, aucune erreur JavaScript.
- Chromium mobile 390 x 844 avec reduction de mouvement : Leaflet actif, aucun canvas 3D, aucun debordement horizontal.
- Captures : `globe-desktop.png` et `globe-mobile-fallback.png`.
- Suite complete : 36 tests reussis.
- Lighthouse accueil apres chargement differe : performance 79, accessibilite 100, bonnes pratiques 96, SEO 92, CLS 0.
