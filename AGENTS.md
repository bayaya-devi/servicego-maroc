# Garde-fous ServiceGO

Ces regles s'appliquent a toute intervention sur ce depot.

1. Ne jamais reinitialiser D1 de production, supprimer des donnees utilisateur, ni lancer une migration destructive sans instruction explicite et sauvegarde verifiee.
2. Ne jamais exposer une cle, un mot de passe, un jeton, une session ou un e-mail prive dans le code, les logs, les captures ou les comptes rendus.
3. Ne jamais modifier un contrat API sans identifier le frontend et les tests qui le consomment; privilegier la compatibilite descendante.
4. Toute route qui ecrit des donnees doit verifier l'identite, le statut actif, la propriete de la ressource et, si necessaire, la verification d'e-mail.
5. Toute route d'administration doit lire les droits depuis D1, jamais depuis le navigateur.
6. Toute nouvelle entree doit etre validee cote serveur; les requetes D1 restent parametrees.
7. Les donnees publiques doivent etre projetees explicitement: ne jamais retourner une ligne de profil complete pour ensuite masquer des champs dans le frontend.
8. Toute nouvelle interaction sensible doit prevoir limitation de debit, erreurs explicites et test negatif d'autorisation.
9. Toute migration doit etre additive, versionnee, testee localement et accompagnee d'une strategie de retour compatible avec les donnees deja appliquees.
10. Ne jamais deployer avec les controles critiques en echec. Executer au minimum tests, typecheck, controle de configuration et smoke test de production.
11. Preserver FR, EN et AR, ainsi que les parcours mobile, desktop, clair et sombre lorsque l'interface est touchee.
12. Produire un rapport final verifiable indiquant les tests executes, les limites connues, le commit, la version Worker et le point de retour arriere.
