@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title OASIS - Envoyer le code sur GitHub

rem ============================================================
rem  OASIS Bibliotheque Numerique - envoi du code sur GitHub
rem  Double-cliquez sur ce fichier, place a la racine du projet
rem  (a cote de server.js). Le dossier de votre ordinateur devient
rem  la version de reference : ce qui manque ici est retire de GitHub.
rem  Le dossier data\ (livres, membres) n'est JAMAIS envoye.
rem ============================================================

set "DEPOT=https://github.com/Michaeljacques-ht/OASIS-Centre-num-rique-d-apprentissage.git"
set "BRANCHE=main"
cd /d "%~dp0"

echo.
echo  ==================================================
echo    OASIS - Envoi du code sur GitHub
echo  ==================================================
echo.

rem ---------- 1. Git est-il installe ? ----------
where git >nul 2>nul
if errorlevel 1 (
  echo  [ERREUR] Git n'est pas installe sur cet ordinateur.
  echo      La page de telechargement va s'ouvrir : installez Git
  echo      en gardant les choix proposes, puis relancez envoyer.bat.
  start "" "https://git-scm.com/download/win"
  goto :fin
)

rem ---------- 2. Est-ce bien le dossier du projet ? ----------
set "MANQUE="
for %%F in (server.js package.json manifeste.json) do if not exist "%%F" set "MANQUE=!MANQUE! %%F"
for %%D in (modules public lib) do if not exist "%%D\" set "MANQUE=!MANQUE! %%D\"
if defined MANQUE (
  echo  [ERREUR] Ce dossier n'est pas le projet OASIS complet.
  echo      Elements absents :!MANQUE!
  echo      Placez envoyer.bat a cote de server.js, dans le dossier
  echo      complet du projet, puis relancez-le.
  goto :fin
)
if exist "public\public\" (
  echo  [ERREUR] Un dossier public\public existe : il a ete copie au mauvais endroit.
  echo      Supprimez public\public puis relancez envoyer.bat.
  goto :fin
)

rem ---------- 3. Protection du dossier data ----------
if not exist ".gitignore" (echo data/>.gitignore& echo node_modules/>>.gitignore)
findstr /b /c:"data/" .gitignore >nul || (echo data/>>.gitignore)

rem ---------- 4. Premiere utilisation : relier le dossier a GitHub ----------
if not exist ".git\" (
  echo  Premiere utilisation : liaison de ce dossier avec GitHub...
  git init -q
  git checkout -q -b %BRANCHE% 2>nul
  git remote add origin "%DEPOT%"
)
git config core.autocrlf false
git config core.quotepath false

rem Nom et email affiches dans l'historique GitHub (demandes une seule fois)
git config user.name >nul 2>nul
if errorlevel 1 (
  set /p "NOM=Votre nom (pour l'historique GitHub) : "
  git config user.name "!NOM!"
)
git config user.email >nul 2>nul
if errorlevel 1 (
  set /p "COURRIEL=Votre email GitHub : "
  git config user.email "!COURRIEL!"
)

echo  Lecture de la version actuelle sur GitHub...
git fetch -q origin %BRANCHE%
if errorlevel 1 (
  echo  [ERREUR] Impossible de joindre GitHub. Verifiez Internet, puis relancez.
  echo      Si une fenetre de connexion GitHub s'est ouverte, connectez-vous.
  goto :fin
)
rem On part de la version en ligne, sans toucher a vos fichiers.
git reset -q --mixed origin/%BRANCHE%

rem ---------- 5. Mise a jour du manifeste (si Node.js est installe) ----------
where node >nul 2>nul
if not errorlevel 1 if exist "outils\manifeste.cjs" (
  node outils\manifeste.cjs
)

rem ---------- 6. Ce qui va changer ----------
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo  Rien a envoyer : GitHub a deja exactement ces fichiers.
  goto :fin
)
set /a AJOUTS=0, MODIFS=0, SUPPRS=0
for /f "tokens=1" %%S in ('git diff --cached --name-status') do (
  if "%%S"=="A" set /a AJOUTS+=1
  if "%%S"=="M" set /a MODIFS+=1
  if "%%S"=="D" set /a SUPPRS+=1
)
echo.
echo  Changements prets : !AJOUTS! ajout(s), !MODIFS! modification(s), !SUPPRS! suppression(s).
echo.
git diff --cached --name-status
echo.
if !SUPPRS! GTR 10 (
  echo  [ATTENTION] !SUPPRS! fichiers seraient SUPPRIMES de GitHub.
  echo  C'est normal seulement si vous avez volontairement retire ces fichiers.
  echo  Si ce dossier ne contient qu'une partie du projet, repondez N.
  echo.
)
set "OK="
set /p "OK=Envoyer ces changements sur GitHub ? (O/N) : "
if /i not "!OK!"=="O" (
  git reset -q
  echo  Envoi annule. Rien n'a ete modifie sur GitHub.
  goto :fin
)

for /f "tokens=1-3 delims=/" %%a in ("%date%") do set "AUJ=%%a-%%b-%%c"
set "MSG="
set /p "MSG=Description (Entree = Mise a jour du !AUJ!) : "
if not defined MSG set "MSG=Mise a jour du !AUJ!"
git commit -q -m "!MSG!"

rem ---------- 7. Envoi ----------
echo  Envoi sur GitHub...
git push -q origin HEAD:%BRANCHE%
if errorlevel 1 (
  echo.
  echo  [ERREUR] L'envoi a echoue. Causes possibles :
  echo      - connexion GitHub refusee : relancez et connectez-vous dans la fenetre qui s'ouvre ;
  echo      - quelqu'un a modifie GitHub entre-temps : relancez simplement envoyer.bat.
  goto :fin
)
echo.
echo  ==================================================
echo    Envoye : GitHub a la nouvelle version.
echo  ==================================================
echo  Si le deploiement automatique est actif, Render met le site
echo  a jour tout seul dans quelques minutes. Sinon, sur Render :
echo  Manual Deploy puis Deploy latest commit.

:fin
echo.
pause
endlocal
