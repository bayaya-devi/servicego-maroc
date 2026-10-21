# Stockage des médias ServiceGo

## État actuel

Les médias privés utilisent le namespace Cloudflare KV `UPLOADS`. Ils ne sont jamais exposés directement : le Worker contrôle la session, la propriété ou la référence métier avant de servir `/api/files/:key`.

À l'envoi, le Worker vérifie la taille, le type MIME déclaré et la signature binaire réelle. La clé est générée côté serveur et son extension découle du type validé. Les métadonnées contiennent le propriétaire, l'usage, la taille et la date d'envoi.

La route administrateur `POST /api/v1/admin/uploads/cleanup` inspecte au maximum 100 clés par appel et supprime uniquement les objets âgés de plus de 24 heures qui ne sont référencés ni par un profil, ni par une demande, ni par un message. Elle est volontairement bornée et idempotente.

## Limites de KV

KV convient au faible volume actuel mais n'est pas conçu comme une bibliothèque multimédia à fort débit. Le nettoyage n'est pas planifié automatiquement tant qu'un environnement de préproduction isolé et une supervision d'exécution ne sont pas disponibles.

## Migration R2

Avant une montée en charge significative :

1. Créer un bucket R2 privé distinct en préproduction et en production.
2. Introduire un binding `MEDIA` sans retirer immédiatement `UPLOADS`.
3. Écrire les nouveaux objets dans R2 et conserver une lecture de repli KV.
4. Copier les objets existants en vérifiant taille, type, signature et somme de contrôle.
5. Basculer les lectures après comparaison et conserver le retour arrière KV pendant une période définie.
6. Supprimer le repli seulement après validation des sauvegardes, de la rétention et des coûts.

Les URL publiques restent des routes Worker afin de préserver les contrôles d'accès pendant et après la migration.
