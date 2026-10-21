# Détection des doublons — version 1.7.4
La route GET /api/doublons existe dans ce projet et exige un compte bibliothécaire global. Les apprenants et comptes établissements reçoivent 403. POST /api/doublons/fusionner exige également ce rôle et vérifie le doublon avant de fusionner.

Un message Route introuvable sur le site publié peut indiquer un ancien server.js encore exécuté avec un admin.js plus récent. Ce correctif regroupe les routes administratives de doublons avant les routes de contenu et expose la version réelle de package.json ainsi que detectionDoublons dans /api/version. Le bouton fournit une explication de déploiement si le serveur répond 404, sans simuler une détection réussie.

Déployer le contenu complet de cette archive dans le dépôt réellement connecté à Render, y compris server.js, package.json, modules et public. Ne pas remplacer ni supprimer data. Vérifier dans Events que le nouveau déploiement a réussi, puis ouvrir /api/version : version 1.7.4 et detectionDoublons true. Recharger ensuite /admin et essayer Détecter les doublons. Un déploiement échoué peut laisser fonctionner l’ancienne version.

Les tests HTTP vérifient 200 et tableau pour le bibliothécaire, 403 pour les autres comptes et 409 pour une fusion invalide. Aucune intervention sur la base en production n’a été effectuée.
