@echo off
REM =====================================================================
REM  Swarna Deepika - One-Click Windows Installer + Launcher
REM
REM  What this does:
REM    1. Checks for Python 3, Node.js, Yarn.
REM    2. If missing, tries to install them via winget (Windows 10 v1809+/11)
REM       or falls back to a clear "please install" message.
REM    3. Delegates to desktop\run_local.bat which builds the frontend once
REM       and starts the offline SQLite backend on http://127.0.0.1:8756.
REM       All data lives locally, no MongoDB, no config, and it works
REM       fully offline.
REM
REM  Just double-click me from Explorer. No admin required for winget itself,
REM  but Python/Node installers may prompt for elevation.
REM =====================================================================
setlocal enableextensions
cd /d "%~dp0"

echo.
echo ============================================================
echo   Swarna Deepika Billing - Windows one-click setup
echo ============================================================
echo.

REM -- Winget availability ------------------------------------------------
where winget >nul 2>nul
if errorlevel 1 (
  set "HAS_WINGET=0"
) else (
  set "HAS_WINGET=1"
)

REM -- Python ------------------------------------------------------------
where python >nul 2>nul
if errorlevel 1 (
  echo [!] Python is not installed.
  if "%HAS_WINGET%"=="1" (
    echo Installing Python 3.12 via winget...
    winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements || goto :need_manual_python
    echo Python installed. You may need to close this window and re-run to refresh PATH.
  ) else (
    goto :need_manual_python
  )
) else (
  for /f "delims=" %%v in ('python --version') do echo [OK] %%v
)

REM -- Node.js -----------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed.
  if "%HAS_WINGET%"=="1" (
    echo Installing Node.js LTS via winget...
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements || goto :need_manual_node
  ) else (
    goto :need_manual_node
  )
) else (
  for /f "delims=" %%v in ('node --version') do echo [OK] Node %%v
)

REM -- Yarn --------------------------------------------------------------
where yarn >nul 2>nul
if errorlevel 1 (
  echo Installing Yarn via npm...
  call npm install -g yarn || goto :error
) else (
  for /f "delims=" %%v in ('yarn --version') do echo [OK] Yarn %%v
)

REM -- .env from templates ------------------------------------------------
if not exist backend\.env if exist backend\.env.example (
  copy /Y backend\.env.example backend\.env >nul
  echo [OK] Created backend\.env from template
)
if not exist frontend\.env if exist frontend\.env.example (
  copy /Y frontend\.env.example frontend\.env >nul
  echo [OK] Created frontend\.env from template
)

echo.
echo ============================================================
echo  Handing over to the offline launcher (desktop\run_local.bat)
echo  This will build the UI once and start the app on
echo  http://127.0.0.1:8756  (login: admin / swarna123)
echo ============================================================
echo.
cd desktop
call run_local.bat
goto :eof

:need_manual_python
echo.
echo Please install Python 3.10+ manually from:
echo    https://www.python.org/downloads/
echo Make sure to tick "Add Python to PATH" during install. Then re-run me.
pause
exit /b 1

:need_manual_node
echo.
echo Please install Node.js LTS manually from:
echo    https://nodejs.org
echo Then re-run me.
pause
exit /b 1

:error
echo.
echo INSTALL FAILED. See the error above.
pause
exit /b 1
