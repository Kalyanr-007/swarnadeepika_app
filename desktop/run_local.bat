@echo off
REM =====================================================================
REM  Swarna Deepika - ONE-CLICK OFFLINE LOCAL RUN (no installer needed)
REM  Requires: Python 3 + Node.js/Yarn installed once on this PC.
REM  Starts the offline backend (serves the UI + API at 127.0.0.1:8756)
REM  and opens your browser. All data is saved locally in SQLite.
REM =====================================================================
setlocal
cd /d "%~dp0"

REM 1. Build the frontend once (only if not already built into backend\static)
if not exist backend\static\index.html (
  echo Building the app for the first time... this may take a few minutes.
  pushd ..\frontend
  call yarn install || goto :error
  set "REACT_APP_BACKEND_URL="
  call yarn build || goto :error
  popd
  if exist backend\static rmdir /s /q backend\static
  xcopy /E /I /Y ..\frontend\build backend\static || goto :error
)

REM 2. Set up Python backend deps (once)
cd backend
if not exist venv (
  python -m venv venv || goto :error
  call venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  pip install -r requirements.txt || goto :error
) else (
  call venv\Scripts\activate.bat
)

REM 3. Start server and open browser
echo.
echo ============================================================
echo  Swarna Deepika is starting at  http://127.0.0.1:8756
echo  Login -> username: admin   password: swarna123
echo  Keep this window open while using the app.
echo ============================================================
start "" http://127.0.0.1:8756
set SDB_PORT=8756
python app.py
goto :eof

:error
echo.
echo SETUP FAILED. See the error above.
pause
exit /b 1
