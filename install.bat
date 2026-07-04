@echo off
REM =====================================================================
REM  Swarna Deepika - One-Click Windows Installer + Launcher
REM
REM  What this does:
REM    1. Checks for Python 3.12, Node.js, Yarn on your PC.
REM    2. If Python 3.12 is missing, installs it via winget (Win 10 1809+/11).
REM       We pin Python 3.12 because 3.14 currently lacks pre-built wheels
REM       for some packages (pydantic-core, bcrypt) that would otherwise
REM       force a Rust + MSVC compile.
REM    3. Delegates to desktop\run_local.bat which builds the frontend once
REM       and starts the offline SQLite backend on http://127.0.0.1:8756.
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
if errorlevel 1 ( set "HAS_WINGET=0" ) else ( set "HAS_WINGET=1" )

REM -- Python 3.12 specifically -------------------------------------------
REM  We check via the "py" launcher because it can find 3.12 even if the
REM  default `python` command points at a newer version like 3.14.
py -3.12 -c "import sys" 1>nul 2>nul
if errorlevel 1 (
  echo [!] Python 3.12 not found.
  if "%HAS_WINGET%"=="1" (
    echo Installing Python 3.12 via winget...
    winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
    REM Refresh PATH by re-checking after install (winget updates it)
    py -3.12 -c "import sys" 1>nul 2>nul
    if errorlevel 1 (
      echo Python 3.12 install did not complete. Please install manually and re-run.
      goto :need_manual_python
    )
  ) else (
    goto :need_manual_python
  )
) else (
  for /f "delims=" %%v in ('py -3.12 --version') do echo [OK] %%v (via py launcher)
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

REM -- If a stale venv exists that was built with the wrong Python,
REM    delete it so run_local.bat can rebuild with Python 3.12.
if exist desktop\backend\venv (
  desktop\backend\venv\Scripts\python.exe -c "import sys; assert sys.version_info[:2]==(3,12)" 1>nul 2>nul
  if errorlevel 1 (
    echo [i] Removing stale venv that was created with a different Python...
    rmdir /s /q desktop\backend\venv
  )
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
echo Please install Python 3.12 manually from:
echo    https://www.python.org/downloads/release/python-3120/
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
