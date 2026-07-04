@echo off
REM =====================================================================
REM  Swarna Deepika - ONE-CLICK OFFLINE LOCAL RUN (no installer needed)
REM  Requires: Python 3 + Node.js/Yarn installed once on this PC.
REM  Starts the offline backend (serves the UI + API at 127.0.0.1:8756)
REM  and opens your browser. All data is saved locally in SQLite.
REM =====================================================================
setlocal enableextensions
cd /d "%~dp0"

REM -- Prerequisite checks -----------------------------------------------
where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Python 3 is not installed or not in PATH.
  echo Install from https://www.python.org/downloads/ ^(tick "Add Python to PATH"^).
  pause & exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install from https://nodejs.org
  pause & exit /b 1
)
where yarn >nul 2>nul
if errorlevel 1 (
  echo.
  echo Yarn is missing. Installing globally via npm...
  call npm install -g yarn || goto :error
)

REM -- 1. Build the frontend once (only if not already built) ------------
if not exist backend\static\index.html (
  echo.
  echo [1/3] Building the app for the first time... this may take a few minutes.
  pushd ..\frontend
  call yarn install || goto :error
  REM Empty backend URL -> the UI calls the SAME origin as itself (localhost:8756).
  set "REACT_APP_BACKEND_URL="
  call yarn build || goto :error
  popd
  if exist backend\static rmdir /s /q backend\static
  xcopy /E /I /Y ..\frontend\build backend\static || goto :error
) else (
  echo [1/3] Frontend already built - skipping.
)

REM -- 2. Set up Python virtualenv + deps (once) --------------------------
cd backend
if not exist venv (
  echo.
  echo [2/3] Setting up Python virtualenv and dependencies...
  python -m venv venv || goto :error
  call venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  pip install -r requirements.txt || goto :error
) else (
  echo [2/3] Python venv already set up - skipping.
  call venv\Scripts\activate.bat
)

REM -- 3. Start server and open browser ----------------------------------
echo.
echo ============================================================
echo  Swarna Deepika is starting at  http://127.0.0.1:8756
echo  Login -^> username: admin   password: swarna123
echo  Keep this window open while using the app.
echo  Press Ctrl+C in this window to stop the server.
echo ============================================================
set SDB_PORT=8756
start "" http://127.0.0.1:8756
python app.py
goto :eof

:error
echo.
echo SETUP FAILED. See the error above.
pause
exit /b 1
