# Sécurité — correctif 1.13.1

Corrections issues de l'audit de cybersécurité du 3 novembre 2026. Le module `modules/securite.js` les regroupe ; `tests/securite.cjs` les vérifie.

| Faille de l'audit | Correction |
|---|---|
| 1. Compte de démonstration `admin@oasis.ht` / `admin123` | Base neuve : mot de passe aléatoire affiché une fois dans les journaux, ou `OASIS_ADMIN_MDP`. Les mots de passe publiés `admin123` et `demo123` sont refusés hors mode démo (`OASIS_DEMO=1`). `OASIS_ADMIN_MDP` remplace le mot de passe de l'administrateur principal au démarrage et ferme ses anciennes sessions. |
| 2. Connexion sans limite | 5 échecs par compte et par adresse IP, ou 20 par adresse IP, bloquent 15 minutes (réponse 429). Mot de passe des apprenants : 8 caractères minimum. |
| 3. XSS par l'icône ou la couleur | Couleur : code `#rrggbb` uniquement. Icône : 16 caractères au plus, sans `< > " ' & = ; ( ) { }`. Les valeurs dangereuses déjà enregistrées sont remplacées au démarrage. |
| 4. pdf.js (CVE-2024-4367) | `isEvalSupported: false` sur tous les appels ; pdf.js n'est plus chargé depuis un CDN. Mise à niveau vers pdf.js 4.x prévue en 1.14. |
| 6. Sessions dans la sauvegarde | La sauvegarde exporte `sessions: {}`. |
| 7. En-têtes HTTP | `Content-Security-Policy` (scripts et connexions limités au site), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. |
| 11. Mot de passe `oasis123` | Le formulaire « membre » exige un mot de passe de 8 caractères ; `oasis123` est refusé. |

Le point 8 de l'audit (lien `javascript:` des ressources) était un faux positif : le serveur n'acceptait déjà que `http://` et `https://`. Un nettoyage au démarrage le garantit aussi pour les anciennes données.

## Si l'administrateur ne peut plus se connecter

Le message « Ce mot de passe de démonstration est désactivé » signifie que le compte utilisait encore `admin123`. Sur Render : **Environment → Add Environment Variable**, `OASIS_ADMIN_MDP` = un mot de passe d'au moins 10 caractères, puis **Save** (le service redémarre). Connectez-vous ensuite avec ce mot de passe.

## Reste à faire (version 1.14)

Expiration des sessions, liste des apprenants limitée à l'établissement, groupes réservés aux membres, une note par lecteur, jeton à usage unique pour l'audio et la vidéo, pdf.js 4.x, changement de mot de passe depuis le profil, et remplacement des comptes créés avec `oasis123`.
