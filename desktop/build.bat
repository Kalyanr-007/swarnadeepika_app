@echo off
REM =====================================================================
REM  Swarna Deepika - Offline Windows .exe build script
REM  Run this ONCE on a Windows PC that has Node.js, Yarn and Python 3.
REM  Produces: desktop\dist\Swarna Deepika Billing Setup <version>.exe
REM =====================================================================
setlocal

echo.
echo [1/5] Building the React frontend...
cd ..\frontend
call yarn install || goto :error
REM Empty backend URL -> frontend calls the SAME origin (the local backend).
set "REACT_APP_BACKEND_URL="
call yarn build || goto :error

echo.
echo [2/5] Copying frontend build into the desktop backend...
cd ..\desktop
if exist backend\static rmdir /s /q backend\static
xcopy /E /I /Y ..\frontend\build backend\static || goto :error

echo.
echo [3/5] Packaging the FastAPI backend into backend.exe (PyInstaller)...
cd backend
python -m venv venv || goto :error
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt pyinstaller || goto :error
pyinstaller --noconfirm --onefile --name backend --add-data "static;static" app.py || goto :error
call deactivate

echo.
echo [4/5] Placing backend.exe into Electron resources...
cd ..
if not exist resources\backend mkdir resources\backend
copy /Y backend\dist\backend.exe resources\backend\backend.exe || goto :error

echo.
echo [5/5] Building the Windows installer (electron-builder)...
call yarn install || goto :error
call yarn dist || goto :error

echo.
echo ============================================================
echo  DONE! Installer is in:  desktop\dist\
echo  Default login -> username: admin   password: swarna123
echo ============================================================
goto :eof

:error
echo.
echo BUILD FAILED. See the error above.
exit /b 1
