@echo off
setlocal
cd /d "%~dp0"

echo.
echo === KEYIMA - push to GitHub ===
echo (need: git installed + logged in to GitHub on this PC)
echo.

if not exist ".git" (
  git init
  git branch -M main
)

git add .
git commit -m "KEYIMA: storefront + admin + backend (Turso-ready)"

echo.
echo Create an EMPTY private repo first at https://github.com/new  (name: keyima)
echo Do NOT add README or .gitignore - keep it empty.
echo.
set /p URL="Paste repo URL (e.g. https://github.com/USER/keyima.git): "

git remote remove origin 2>nul
git remote add origin %URL%
git push -u origin main

echo.
echo Done. Open the repo on GitHub and check files are there
echo (must NOT contain node_modules / .env / *.db)
pause
