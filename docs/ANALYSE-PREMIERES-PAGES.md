# Analyse bibliographique — 1.7.5
PDF : texte des trois premières pages, lignes regroupées par coordonnées et taille de caractères; titre explicite ou texte de grande taille, auteur explicitement indiqué ou métadonnées, ISBN avec contrôle de la clé ISBN-10/13, éditeur, édition et année copyright si présents. Les titres génériques des métadonnées sont écartés. Aucun service externe ni IA distante ni OCR : un scan image doit être renseigné manuellement. Les suggestions peuvent être incorrectes et nécessitent validation.

EPUB : métadonnées Dublin Core et texte des trois premiers éléments de lecture. Un EPUB n’a pas de pagination fixe; ces éléments peuvent être des chapitres. Auteur, titre, éditeur, identifiant ISBN validé et édition sont récupérés si disponibles.

Formulaire individuel : ISBN et année préremplis, catégorie suggérée par mots-clés parmi les catégories existantes. Imports multiples PDF/EPUB : titre, auteur, ISBN, éditeur, édition et catégorie modifiables avant import. La catégorie est une suggestion heuristique, pas une classification scientifique. Les modifications manuelles pendant l’analyse sont conservées. Le système peut laisser des champs vides plutôt que d’inventer des informations absentes.

Déployer le projet complet sans remplacer data. Tests avec un lecteur PDF simulé : exactement trois pages analysées, extraction bibliographique, ISBN invalide rejeté, destruction du lecteur. Les tests ne garantissent pas l’exactitude sur toutes les mises en page.
