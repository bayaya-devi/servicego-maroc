# Couverture des routes

| Surface | Route / vue | Etat | Notes |
| --- | --- | --- | --- |
| Visiteur | Accueil | Implemente | Apercu fictif non interactif |
| Visiteur | Connexion / inscription | Implemente | Meme point d'entree |
| Membre | Carte | Implemente | Session requise, positions approximatives |
| Membre | Demander | Implemente | Publication apres verification email |
| Membre | Proposer | Implemente | Meme compte utilisateur |
| Membre | Repondre a une demande | Implemente | Ouvre le parcours d'offre |
| Membre | Demander un service | Implemente | Cree une demande directe et une conversation |
| Membre | Messages | Implemente | Conversations et envoi |
| Membre | Activite / profil | Implemente | Demandes, services, identite, email et mot de passe |
| Admin | Tableau de bord | Implemente | Statistiques disponibles uniquement pour `is_admin` |
| Systeme | Verification email | Implemente | Envoi externe conditionne par les secrets Resend |
| Systeme | Photos | Bloque | R2 indisponible dans le compte Cloudflare actuel |
| Systeme | Google OAuth | Non implemente | Fournisseur non configure |
| Systeme | 3D geographique WebGL | Non implemente | Vue relief visuelle fournie, sans pretention topographique |

