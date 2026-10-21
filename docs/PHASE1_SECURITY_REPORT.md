# ServiceGO - rapport Phase 1 securite

## Statut des chantiers

| ID | Statut | Etat |
| --- | --- | --- |
| SG-001 | IMPLEMENTE MAIS NON DEPLOYE | Quota glissant serveur de trois publications sur 24 heures, insert conditionnel atomique, annulation sans liberation immediate. |
| SG-002 | PARTIEL | Les controles de propriete et de participation existants ont ete revus; une suite HTTP complete A/B/admin reste a automatiser. |
| SG-003 | IMPLEMENTE MAIS NON DEPLOYE | CSP, HSTS, nosniff, Referrer-Policy et Permissions-Policy appliques a l'API et aux assets. |
| SG-004 | PARTIEL | Jetons haches, usage unique, expiration, limitations et revocation des sessions presents; aucun test de reception Brevo nouveau n'a ete possible sans boite de test autorisee. |
| SG-005 | IMPLEMENTE MAIS NON VERIFIE | Support frontend et verification serveur prets; aucune paire Turnstile de production ni domaine autorise n'a ete constate durant cette phase. |

## Risques residuels

- La CSP conserve `style-src 'unsafe-inline'` pour Leaflet et les styles dynamiques existants. `unsafe-eval` n'est pas autorise. Une migration nonce/hash devra retirer cette exception.
- Le quota s'applique actuellement a tous les comptes afin de bloquer les contournements par type de demande. Une politique de confiance configurable releve d'une phase ulterieure.
- Le comportement de production de Turnstile et Brevo doit etre confirme sur de vrais identifiants et une boite de test autorisee avant publication.
