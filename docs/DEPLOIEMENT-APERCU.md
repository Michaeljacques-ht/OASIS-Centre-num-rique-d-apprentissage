# Corriger « Route introuvable » sur Render

La version du serveur doit correspondre à celle de l’interface. La mise à jour du dossier public seule ne suffit pas.

1. Extraire cette archive et remplacer dans le dépôt GitHub les fichiers du projet complet, notamment `server.js`, `modules/abonnement.js`, `modules/pdf-lib.js`, `lib/plopplop.js` et le dossier `public`. Conserver les données et PDF existants sur le disque persistant : ne pas remplacer `data`.
2. Vérifier que le répertoire racine du service Render est le dossier contenant `package.json` et `server.js`. La commande de démarrage est `npm start` (ou `node server.js`).
3. Enregistrer les changements dans GitHub, puis dans Render lancer **Manual Deploy → Deploy latest commit**. Attendre que le déploiement soit terminé.
4. Ouvrir `/api/version` sur le domaine du site. La réponse doit afficher `version: "1.5.1"`, `apercuGratuit: true` et `abonnements: true`. Un message « Route introuvable » indique que l’ancien serveur tourne encore : vérifier le dépôt, la branche et le répertoire racine configurés dans Render.
5. Actualiser la page puis ouvrir un livre PDF : l’aperçu public contient au maximum cinq pages. Les fichiers complets restent réservés aux abonnés et à l’administrateur.

Les tests comprennent la création d’un PDF de huit pages, la récupération anonyme de l’aperçu de cinq pages et le refus de téléchargement complet sans abonnement.
