@echo off
setlocal
cd /d "%~dp0"

echo === KEYIMA: push admin UI restore (Render will auto-redeploy) ===
echo.

git add -A
if errorlevel 1 goto repair

git commit -m "restore fe/ (store+admin static sites) + serve same-origin /admin from API (explicit CSP)"
git push
if errorlevel 1 goto pushfail
goto done

:repair
echo.
echo [!] git index looks corrupt - rebuilding it (safe; index is derived state)...
if exist ".git\index" del /q ".git\index"
git reset
git add -A
git commit -m "restore fe/ (store+admin static sites) + serve same-origin /admin from API (explicit CSP)"
git push
if errorlevel 1 goto pushfail
goto done

:pushfail
echo.
echo [X] push failed. Check that git is logged in and 'origin' points to your repo:
echo     git remote -v
goto end

:done
echo.
echo [OK] Pushed. Watch Render deploy: https://dashboard.render.com  (keyima-api)
echo Then open: https://keyima-api.onrender.com/admin/login.html

:end
echo.
pause
