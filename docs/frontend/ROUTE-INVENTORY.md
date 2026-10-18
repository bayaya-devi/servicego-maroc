# Inventaire des routes et vues

| Route ou vue | Visiteur | Membre | Admin | Etats principaux |
| --- | --- | --- | --- | --- |
| `/` accueil narratif | Oui | Retour possible | Retour possible | trois scenes, mouvement reduit, clair/sombre |
| Authentification | Oui | Non | Non | connexion, inscription, erreur, email a confirmer |
| Carte | Non | Oui | Oui | vide, filtres, selection, relief, liste clavier |
| Demande | Non | Oui | Oui | formulaire, validation, succes, erreur |
| Offre de service | Non | Oui | Oui | formulaire, validation, succes, erreur |
| Reponses | Non | Proprietaire | Proprietaire | vide, attente, acceptee |
| Messages | Non | Oui | Oui | liste vide, conversation, envoi |
| Profil | Non | Oui | Oui | verifie, non verifie, modification |
| Administration | Non | Non | Oui | statistiques, acces refuse par API |
| FAQ | Oui | Oui via information | Oui | accordions clavier |
| Informations legales | Oui | Oui via information | Oui | ancres, champs manquants signales |
| Verification email | Lien public | Oui | Oui | succes, expire, invalide |

Les routes de recuperation de compte, paiement, moderation avancee et OAuth Google n'existent pas dans le backend actuel. Elles ne sont pas simulees dans l'interface.

