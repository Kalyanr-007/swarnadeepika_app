# Swarna Deepika — Offline Windows Desktop App

This folder builds a **fully offline, self-contained Windows `.exe`** for the billing app.
It bundles:
- The React UI (built to static files)
- A FastAPI backend packaged into `backend.exe` (via PyInstaller)
- A local **SQLite** database (no MongoDB, no internet, no setup needed by the shop)

The cloud/web version of the app is unchanged and keeps using MongoDB.

---

## What you need on the build PC (one time)
Install these on any **Windows 10/11** machine:
1. **Node.js LTS** — https://nodejs.org  (includes npm)
2. **Yarn** — after Node, run: `npm install -g yarn`
3. **Python 3.10+** — https://www.python.org/downloads/  (tick "Add Python to PATH" during install)

You only need these on the machine that BUILDS the installer. The shop PC that runs the
final app needs nothing installed.

---

## How to build (one command)
1. Copy the whole project folder to the Windows PC.
2. Open **Command Prompt**, go into the `desktop` folder:
   ```
   cd path\to\app\desktop
   ```
3. Run:
   ```
   build.bat
   ```
4. When it finishes, the installer is here:
   ```
   desktop\dist\Swarna Deepika Billing Setup 1.0.0.exe
   ```

Double-click that installer on any Windows PC to install the app. A desktop shortcut
"Swarna Deepika Billing" is created.

---

## First login
- **Username:** `admin`
- **Password:** `swarna123`

(You can add more users from the app / register endpoint. Change this default after setup.)

---

## Where is the data stored?
All shop data (products, customers, bills, loans) lives in a single SQLite file inside the
Windows user profile:
```
C:\Users\<YourUser>\AppData\Roaming\Swarna Deepika Billing\swarna_deepika.db
```
**Back this file up** (copy to a pen drive) to keep your records safe. Restoring is just
copying the file back.

---

## Notes / limitations
- Single-PC use. For multiple PCs sharing the same data, use the cloud/web version instead.
- The `.exe` build must be produced on Windows (PyInstaller + electron-builder are OS-specific).
  It cannot be built on the Linux cloud server.
- To release an update: bump `version` in `desktop/package.json` and re-run `build.bat`.

---

## Folder contents
- `main.js` — Electron entry: starts `backend.exe`, waits for it, opens the app window.
- `package.json` — Electron + electron-builder config (produces the NSIS installer).
- `backend/app.py` — self-contained FastAPI + SQLite backend that also serves the UI.
- `backend/requirements.txt` — backend Python deps.
- `build.bat` — the one-shot build script (frontend → backend.exe → installer).
