# Audit frontend ServiceGO

Date: 18 octobre 2026 - revision V2

## Resume executif

L'application existante possede un socle metier exploitable: compte unique demandeur/prestataire, demandes, services, offres, conversations, verification d'email et statistiques administrateur. Le principal ecart concerne l'experience: interface uniquement en francais, navigation classique, accessibilite partielle, espace administrateur non separe et identite visuelle ancienne.

La refonte conserve les contrats API et les donnees. Elle introduit une coque responsive, une navigation flottante, FR/EN/AR avec RTL, des jetons visuels centralises, des parcours plus directs et une carte protegee apres connexion.

## Inventaire

| Zone | Etat initial | Decision |
| --- | --- | --- |
| Frontend | HTML/CSS/JavaScript natif, Leaflet 1.9.4 | Conserver le socle leger; structurer par vues et fonctions pures |
| Backend | Cloudflare Worker + D1 | Conserver les routes et renforcer la confidentialite de la carte |
| Authentification | Email/mot de passe, session HttpOnly, verification email | Conserver; ne pas simuler Google tant que le fournisseur n'est pas configure |
| Emails | Integration Resend presente | Reste inactive sans secrets de production |
| Fichiers | Route R2 presente | R2 indisponible dans le compte actuel; le champ photo est masque jusqu'a activation |
| Carte | Leaflet + OpenStreetMap | Conserver le mode 2D; ajouter une vue relief visuelle progressive |
| Internationalisation | Absente | Ajouter FR, EN et AR; memoriser la langue localement |
| Administration | Statistiques dans le profil | Ajouter une vue admin dediee, gardee par `is_admin` |
| Tests | Absents | Ajouter tests statiques, API locale et parcours navigateur |
| CI | Branche et base D1 incorrectes | Corriger vers `master` et `servicego-production` |

## Risques et ecarts

1. La route `/api/map` etait publique et exposait les coordonnees exactes. Elle doit exiger une session et ne renvoyer qu'une position arrondie.
2. Les dialogues n'avaient ni role semantique, ni fermeture par Echap, ni restauration du focus.
3. Les notifications n'etaient pas annoncees aux technologies d'assistance.
4. Le bleu, le vert et l'orange ne suivaient pas la semantique de marque demandee.
5. Le logo decrit dans le prompt ne correspond pas aux fichiers disponibles. Le fichier `Logo icone.png`, effectivement fourni, est integre sans modification de forme. Une nouvelle source validee reste necessaire pour changer le symbole.
6. Le mode 3D geographique reel demanderait un moteur WebGL et une source cartographique adaptee. La V1 fournit une vue relief progressive, desactivee avec la reduction des animations, sans la presenter comme une topographie exacte.
7. OpenStreetMap public ne constitue pas un SLA commercial. Un fournisseur de tuiles avec quota et conditions adaptees sera requis avant une montee en charge.

## Accessibilite initiale

- Absence de lien d'evitement.
- Contrastes et focus non systematiques.
- Navigation mobile textuelle mais sans etat annonce.
- Dialogues sans gestion du focus.
- Carte difficile a utiliser au clavier sans liste equivalente.
- Direction RTL absente.

## Performance initiale

- Frontend sans framework, favorable au temps de chargement.
- Logo source de 809 Ko trop lourd mais conserve comme master fourni.
- Leaflet charge des l'ouverture de l'application.
- Les vues utilisent un rendu complet du DOM; acceptable au volume actuel, a surveiller.

## Hors perimetre honnete

- Connexion Google: fournisseur OAuth non configure.
- Envoi reel d'emails: secrets Resend manquants.
- Photos: bucket R2 non active.
- Moderation complete, paiement, verification d'identite et support: APIs metier absentes.
- Vraie cartographie 3D WebGL: moteur et fournisseur de donnees absents.

## Revision V2

La capture `q.png` a confirme que le symbole officiel etait visuellement trop petit a cause des marges blanches internes du PNG. Le fichier source est conserve intact; son cadrage est corrige par un masque CSS reutilisable.

La V2 introduit un accueil continu en trois scenes, un noyau public a trois commandes, une FAQ et un espace legal public. Les deux personnages sont isoles visuellement a partir du fichier officiel par cadrage CSS, sans redessin. Deux photographies Unsplash libres d'utilisation sont stockees localement et creditees dans la scene finale.

La portee operationnelle reste le Maroc car le backend valide actuellement des coordonnees marocaines. La vocation mondiale decrite dans la vision produit n'est donc pas presentee comme une capacite deja disponible.

