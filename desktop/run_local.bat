@echo off
REM =====================================================================
REM  Swarna Deepika - ONE-CLICK OFFLINE LOCAL RUN (no installer needed)
REM  Requires: Python 3.10-3.13 + Node.js/Yarn installed once on this PC.
REM  Starts the offline backend (serves the UI + API at 127.0.0.1:8756)
REM  and opens your browser. All data is saved locally in SQLite.
REM
REM  IMPORTANT: Python 3.14 on Windows still lacks pre-built wheels for
REM  some packages, so this script tries to use Python 3.12 first (via the
REM  "py" launcher) and only falls back to whatever `python` resolves to
REM  if a 3.12 install isn't found. Install Python 3.12 from
REM  https://www.python.org/downloads/release/python-3120/ if you hit
REM  build errors about Rust or link.exe.
REM =====================================================================
setlocal enableextensions
cd /d "%~dp0"

REM -- Pick a Python interpreter: prefer 3.12, then 3.11, then any 3.x, then plain python
set "PYCMD="
py -3.12 -c "import sys; sys.exit(0)" 1>nul 2>nul && set "PYCMD=py -3.12"
if not defined PYCMD (
  py -3.11 -c "import sys; sys.exit(0)" 1>nul 2>nul && set "PYCMD=py -3.11"
)
if not defined PYCMD (
  py -3.13 -c "import sys; sys.exit(0)" 1>nul 2>nul && set "PYCMD=py -3.13"
)
if not defined PYCMD (
  py -3.10 -c "import sys; sys.exit(0)" 1>nul 2>nul && set "PYCMD=py -3.10"
)
if not defined PYCMD (
  where python >nul 2>nul && set "PYCMD=python"
)
if not defined PYCMD (
  echo.
  echo [ERROR] No usable Python 3.x found.
  echo Install Python 3.12 from https://www.python.org/downloads/release/python-3120/
  echo Make sure to tick "Add Python to PATH" during install.
  pause & exit /b 1
)
echo Using interpreter: %PYCMD%
%PYCMD% -c "import sys; print('Python', sys.version.split()[0])"

REM -- Node.js prerequisite
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js LTS from https://nodejs.org and re-run.
  pause & exit /b 1
)
where yarn >nul 2>nul
if errorlevel 1 (
  echo Yarn is missing. Installing globally via npm...
  call npm install -g yarn || goto :error
)

REM -- 1. Build the frontend once (only if not already built) ------------
if not exist backend\static\index.html (
  echo.
  echo [1/3] Building the app for the first time... this may take a few minutes.
  pushd ..\frontend
  call yarn install || goto :error
  REM Empty backend URL -^> the UI calls the SAME origin as itself (localhost:8756).
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
  %PYCMD% -m venv venv || goto :error
  call venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt || goto :pip_error
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

:pip_error
echo.
echo ============================================================
echo  ERROR while installing Python dependencies.
echo  If you see a message about "Rust", "link.exe" or "maturin",
echo  your Python version is too new and no pre-built wheel exists.
echo.
echo  FIX: install Python 3.12 from
echo    https://www.python.org/downloads/release/python-3120/
echo  (tick "Add Python to PATH"), then DELETE the folder
echo    desktop\backend\venv
echo  and run this script again.
echo ============================================================
pause
exit /b 1

:error
echo.
echo SETUP FAILED. See the error above.
pause
exit /b 1
