# OASIS Centre numérique d’apprentissage — Fusion Diffusion

## Démarrer

Node.js 18 ou plus. Dans le dossier du projet : `node server.js`.
Le portail et l’administration sont servis par le même serveur et le même port.
Aucune installation npm ou base PostgreSQL n’est nécessaire pour cette version intégrée.

## Installer sur un OASIS existant

1. Sauvegarder le dossier actuel, en particulier `data` et les documents téléversés.
2. Remplacer le code par cette version et conserver le dossier `data` existant.
3. Redémarrer le serveur et recharger le navigateur. Les fichiers web utilisent la version 15 pour actualiser le cache.
4. Ouvrir « Ressources pédagogiques ». Au premier accès authentifié, la collection Diffusion est ajoutée à la base OASIS existante, sans modifier les livres, membres, prêts ou favoris de lecture.

Le dossier `seed` doit être déployé avec `modules` et `public`. Ne pas le confondre avec le dossier `data` : `seed` contient les fiches initiales nécessaires à la migration ; `data` contient vos données persistantes.

## Organisation du portail

| Groupe | Contenu |
| --- | --- |
| Bibliothèque | Catalogue, favoris de livres, emprunts, catégories, nouveautés et recommandations |
| Pédagogie & diffusion | Ressources pédagogiques, méthodes & guides, travaux dirigés, parcours personnel et outils d’étude |
| Médiathèque & communauté | Ressources documentaires, multimédia, collaboration, défis et places de lecture |

Un seul compte et une seule connexion OASIS donnent accès au portail. Les publics « élèves » et « enseignants » sont des filtres de contenu, pas des rôles d’autorisation supplémentaires. Le rôle bibliothécaire conserve les droits d’administration.

## Fonctions intégrées

- 36 fiches importées : 8 ressources pédagogiques, 8 méthodes élèves, 8 méthodes enseignants, 6 travaux dirigés, 6 ressources recommandées aux élèves.
- Filtres par public, discipline, niveau et mots recherchés ; favoris pédagogiques distincts des favoris de livres.
- Consultation de contenu texte ou de documents accessibles par lien HTTP/HTTPS.
- Contributions des utilisateurs en brouillon ou soumises à validation ; publication réservée au bibliothécaire.
- Administration → Pédagogie & diffusion : créer, modifier, classer et publier ; remettre une contribution « À revoir » ou en brouillon pour la retirer du catalogue public sans supprimer la fiche.
- Notes privées, ressources étudiées et tableau de parcours personnel.
- Planning d’étude individuel, séances terminées ou à réaliser, auto-évaluation des habitudes.
- Style partagé avec OASIS et adaptation mobile ; recherche du bandeau orientée vers le module ouvert.

Les fiches source sont illustratives : les fichiers PDF, vidéos et diaporamas annoncés dans les exemples ne sont pas présents dans le ZIP reçu. Aucun nombre de vues, note, taux de progression ou total fictif du prototype n’est repris comme résultat réel. L’administration peut compléter les fiches avec un contenu ou un lien, puis les publier. Une fiche sans contenu ne peut pas être marquée comme étudiée.

## Conservation du projet source

`integrations/educa-diffusion-original.zip` conserve intégralement le projet EDUCA Diffusion fourni, y compris sa documentation, son service, ses migrations et ses tests. Le fonctionnement courant utilise le module intégré `modules/diffusion.js`, pas un second service ni une seconde session.

Les capacités architecturales décrites dans les documents source (PostgreSQL multi-établissements, SSO externe, QR codes, statistiques sectorielles et fonctionnalités signalées comme en chantier) ne sont pas activées par cette fusion. Le dépôt de documents dans le module intégré se fait par lien ou texte ; le téléversement binaire du catalogue de livres reste celui d’OASIS.

## Données et validation

La collection `diffusion` est enregistrée dans `data/db.json` avec les autres collections OASIS. Les suivis, notes, contributions non publiées et séances sont cloisonnés par utilisateur. Sauvegarder ce fichier et les fichiers téléversés régulièrement.

Exécuter `node tests/diffusion.cjs` pour vérifier l’import, les droits et la modération, les liens, le suivi privé, la persistance après redémarrage, le rendu des cinq rubriques et la disponibilité du catalogue existant. Ces tests utilisent une base temporaire isolée. Vérifications exécutées avec succès. La vérification graphique dans un navigateur n’a pas pu être exécutée dans cet environnement.
