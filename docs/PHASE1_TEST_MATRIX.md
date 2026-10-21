# Phase 1 - matrice de tests

| Ressource | Action | Identite | Attendu | Resultat observe |
| --- | --- | --- | --- | --- |
| Demandes | Creer 4 demandes en 24 h | Compte de test verifie | 201, 201, 201, puis 429 | Verifie localement par requetes HTTP reelles. |
| Demandes | Creations concurrentes | Compte de test | Au plus trois insertions dans la fenetre | Protege par un unique `INSERT ... SELECT ... WHERE COUNT(*) < 3`; test de regression source ajoute. |
| Demandes | Annuler une demande | Proprietaire | Le quota ne se libere pas | Le quota compte toutes les publications, quel que soit leur statut. |
| Session | Lire une conversation et envoyer un message | Participant / non-participant | Autorise / 404 | Couvert par les controles de participation existants; audit multi-comptes HTTP complet reste a automatiser. |
| Administration | Lire les rapports | Membre / administrateur | 403 / autorise | Controle serveur existant sur `is_admin` lu depuis D1. |
| Mot de passe | Reinitialiser | Jeton valide | Nouveau mot de passe, sessions precedentes revoquees | Couvert par lecture et test de regression; reception e-mail reelle non relancee durant cette phase. |
| Mot de passe | Reutiliser un jeton | Meme compte | Refuse | `used_at IS NULL`, jeton hache et invalidation apres usage. |
| Turnstile | Jeton absent lorsque le secret est configure | Visiteur | Refus | Le serveur refuse le jeton vide; widget rendu seulement avec site key et secret. |
| En-tetes | Accueil et API health | Public | CSP, HSTS, nosniff, Referrer, Permissions | Verifie localement sur `/` et `/api/health`. |

## Notes

- Les tests sont effectues exclusivement sur une D1 locale isolee et des comptes de test.
- Aucune requete de creation, de suppression ou de modification n'a ete envoyee vers D1 de production.
- Un audit HTTP multi-comptes exhaustif avec trois comptes isoles reste a ajouter avant de marquer SG-002 termine.
