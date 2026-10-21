Réparation de la base JSON — version 1.6.6

Diagnostic : les captures indiquent JSON.parse dans chargerDB, avec une chaîne non terminée. Le serveur ne peut pas lire data/db.json. La cause de la corruption doit être vérifiée : écriture interrompue, arrêt forcé, disque plein ou modification manuelle.

Avant toute intervention, copier le dossier data entier depuis le disque persistant : db.json et tous les PDF, EPUB, couvertures et médias. Ne pas supprimer db.json, ne pas remplacer data par un dossier vierge. Conserver les fichiers de paiement et les comptes.

Déployer le projet complet sans remplacer data. Le correctif écrit dans un fichier temporaire, synchronise le fichier, puis remplace la base. Trois générations db.json.bak, .bak.2 et .bak.3 sont conservées. Au démarrage, une base illisible peut être restaurée depuis db.json.tmp valide ou une sauvegarde valide ; le fichier endommagé est copié sous db.json.corrompu-DATE. Vérifier les imports et paiements récents après toute restauration. Ces copies locales ne remplacent pas une sauvegarde externe régulière.

Si aucune copie valide n’existe, le serveur refuse de créer une base vide et conserve les fichiers. Exporter le db.json endommagé et toute sauvegarde disponible pour récupération. Le correctif ne peut pas récupérer les données tronquées à partir des images des logs. Une réparation partielle du fichier peut perdre les derniers enregistrements ; elle doit être examinée avant remplacement.

Une erreur disque est journalisée sans faire tomber le processus depuis le minuteur. Les modifications non sauvegardées restent en mémoire jusqu’à la prochaine tentative, et ne sont pas garanties en cas d’arrêt. Surveiller les logs SAUVEGARDE ÉCHOUÉE et l’espace disque.
